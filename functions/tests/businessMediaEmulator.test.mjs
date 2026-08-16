import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { BUSINESS_MEDIA_ACTIONS, manageBusinessMedia } from '../src/businessMedia.js'
import { recordFinalizedStagingGeneration } from '../src/mediaUploadSessions.js'

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
    db.doc(`businessSubscriptions/${businessId}`).set({
      schemaVersion: 1, planId: 'growth', planRevision: 1,
      accessStatus: 'active', assignmentSource: 'system',
    }),
  ])
  const bucket = { file: () => ({ getMetadata: async () => { const error = new Error('missing'); error.code = 404; throw error } }) }
  const prepare = (slot) => manageBusinessMedia({
    uid, action: BUSINESS_MEDIA_ACTIONS.PREPARE_GALLERY, businessId,
    storagePath: `businesses/${businessId}/photos/${slot}`, db, bucket,
  })
  const prepared = await Promise.all([prepare(2), prepare(5)])
  await Promise.all(prepared.map((session, index) => recordFinalizedStagingGeneration({
    db,
    parsedPath: { kind: 'gallery', businessId, slot: index === 0 ? 2 : 5 },
    path: session.stagingPath,
    generation: String((index === 0 ? 2 : 5) + 10),
    uploadSessionId: session.requestId,
  })))
  const finalize = (slot, requestId) => manageBusinessMedia({
    uid, action: BUSINESS_MEDIA_ACTIONS.FINALIZE_GALLERY, businessId,
    storagePath: `businesses/${businessId}/photos/${slot}`, requestId,
    stagingGeneration: String(slot + 10), db, bucket,
    clean: async () => ({ metageneration: '2' }),
    promote: async () => ({ generation: String(slot + 20) }),
    clearContext: async () => undefined,
    removeExact: async () => undefined,
  })
  await Promise.all([finalize(2, prepared[0].requestId), finalize(5, prepared[1].requestId)])
  const stored = (await db.doc(`businesses/${businessId}`).get()).data()
  assert.equal(stored.galleryStoragePaths.length, 2)
  assert.deepEqual(new Set(stored.galleryStoragePaths), new Set([
    `businesses/${businessId}/photos/2/a`,
    `businesses/${businessId}/photos/5/a`,
  ]))
  const establishedOrder = [...stored.galleryStoragePaths]
  assert.deepEqual((await db.doc(`businesses/${businessId}`).get()).data().galleryStoragePaths, establishedOrder)
  assert.equal(stored.privateField, 'preserved')
})
