import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { BUSINESS_MEDIA_ACTIONS, manageBusinessMedia } from '../src/businessMedia.js'

const enabled = process.env.HOLALOCAL_CALLABLE_BOUNDARY === '1'
const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT
let db

if (enabled) {
  before(() => {
    assert.match(projectId ?? '', /^demo-/)
    const app = getApps().find((candidate) => candidate.name === 'business-media-emulator')
      ?? initializeApp({ projectId }, 'business-media-emulator')
    db = getFirestore(app)
  })
}

test('real concurrent media transactions preserve different gallery additions', { skip: !enabled }, async () => {
  const uid = 'media-concurrency-owner'
  const businessId = 'media-concurrency-business'
  await Promise.all([
    db.doc(`users/${uid}`).set({ accountStatus: 'active', deletionRequestedAt: null }),
    db.doc(`businesses/${businessId}`).set({
      ownerId: uid,
      managerIds: [uid],
      status: 'draft',
      deletionRequestedAt: null,
      deletedAt: null,
      logoStoragePath: null,
      galleryStoragePaths: [],
      galleryImages: [],
      galleryImageURLs: [],
      subscription: {
        schemaVersion: 1, planId: 'growth', planRevision: 1,
        accessStatus: 'active', assignmentSource: 'system',
      },
      privateField: 'preserved',
    }),
  ])
  const invoke = (slot) => manageBusinessMedia({
    uid,
    action: BUSINESS_MEDIA_ACTIONS.ADD_GALLERY,
    businessId,
    storagePath: `businesses/${businessId}/photos/${slot}`,
    db,
    readObjectMetadata: async () => ({ contentType: 'image/webp', size: '1024', metadata: {} }),
  })
  await Promise.all([invoke(2), invoke(5)])
  const stored = (await db.doc(`businesses/${businessId}`).get()).data()
  assert.equal(stored.galleryStoragePaths.length, 2)
  assert.deepEqual(new Set(stored.galleryStoragePaths), new Set([
    `businesses/${businessId}/photos/2`,
    `businesses/${businessId}/photos/5`,
  ]))
  const establishedOrder = [...stored.galleryStoragePaths]
  await invoke(2)
  assert.deepEqual(
    (await db.doc(`businesses/${businessId}`).get()).data().galleryStoragePaths,
    establishedOrder,
  )
  assert.equal(stored.privateField, 'preserved')
})
