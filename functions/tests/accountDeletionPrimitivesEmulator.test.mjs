import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import {
  acquireAccountDeletionLease,
  cleanupUserSavedBusinesses,
  minimizeConsentEvidenceAndRemoveUser,
} from '../src/accountDeletionPrimitives.js'

const enabled = process.env.HOLALOCAL_CALLABLE_BOUNDARY === '1'
const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT
let db

if (enabled) {
  before(() => {
    assert.match(projectId ?? '', /^demo-/)
    const app = getApps().find((candidate) => candidate.name === 'account-deletion-primitives-emulator')
      ?? initializeApp({ projectId }, 'account-deletion-primitives-emulator')
    db = getFirestore(app)
  })
}

async function seedSavedBusinesses(uid, count, prefix) {
  const batch = db.batch()
  for (let index = 0; index < count; index += 1) {
    const businessId = `${prefix}-${String(index).padStart(3, '0')}`
    batch.set(db.doc(`users/${uid}/savedBusinesses/${businessId}`), {
      businessId,
      createdAt: Timestamp.fromMillis(1_700_000_000_000 + index),
    })
  }
  await batch.commit()
}

async function savedBusinessIds(uid) {
  const snapshot = await db.collection(`users/${uid}/savedBusinesses`).get()
  return snapshot.docs.map((document) => document.id).sort()
}

test('real Firestore transaction atomically minimizes consent evidence and removes profile', { skip: !enabled }, async () => {
  const uid = 'deletion-evidence-user'
  const acceptedAt = Timestamp.fromMillis(1_700_000_000_000)
  await Promise.all([
    db.doc(`users/${uid}`).set({
      uid, email: 'must-not-survive@example.test', displayName: 'Must Not Survive',
      termsAccepted: true, termsAcceptedAt: acceptedAt, termsVersion: '1.0',
      privacyAccepted: true, privacyAcceptedAt: acceptedAt, privacyVersion: '1.0',
    }),
    db.doc(`accountDeletionRequests/${uid}`).set({
      uid, state: 'finalizing', requestVersion: 4, lastCompletedStep: 'profile_media_cleaned',
    }),
  ])
  await db.doc(`accountDeletionRequests/${uid}/customerReviewCleanup/state`).set({complete:true})
  await minimizeConsentEvidenceAndRemoveUser({ uid, db, expectedRequestVersion: 4 })
  const [user, request] = await Promise.all([
    db.doc(`users/${uid}`).get(), db.doc(`accountDeletionRequests/${uid}`).get(),
  ])
  assert.equal(user.exists, false)
  assert.deepEqual(Object.keys(request.data().retainedConsentEvidence).sort(), [
    'privacyAcceptedAt', 'privacyVersion', 'termsAcceptedAt', 'termsVersion',
  ])
  assert.equal(JSON.stringify(request.data()).includes('must-not-survive'), false)
})

test('real Firestore transaction allows only one administrator to recover an expired lease', { skip: !enabled }, async () => {
  const uid = 'deletion-lease-user'
  const clock = Timestamp.fromMillis(1_700_000_000_000)
  await db.doc(`accountDeletionRequests/${uid}`).set({
    uid, state: 'finalizing', requestVersion: 4, retryCount: 0,
    leaseId: 'expired-lease', leaseExpiresAt: Timestamp.fromMillis(clock.toMillis() - 1),
  })
  const results = await Promise.allSettled([
    acquireAccountDeletionLease({ uid, adminUid: 'admin-a', expectedRequestVersion: 4, db, now: clock, leaseIdFactory: () => 'lease-a' }),
    acquireAccountDeletionLease({ uid, adminUid: 'admin-b', expectedRequestVersion: 4, db, now: clock, leaseIdFactory: () => 'lease-b' }),
  ])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1)
  const request = (await db.doc(`accountDeletionRequests/${uid}`).get()).data()
  assert.equal(request.requestVersion, 5)
  assert.ok(['lease-a', 'lease-b'].includes(request.leaseId))
})

test('real Firestore saved-business cleanup completes safely with zero target records', { skip: !enabled }, async () => {
  const targetUid = 'saved-cleanup-zero-user'
  const controlUid = 'saved-cleanup-zero-control'
  await seedSavedBusinesses(controlUid, 1, 'saved-cleanup-zero-control-business')

  assert.deepEqual(await cleanupUserSavedBusinesses({ uid: targetUid, db }), { deleted: 0 })
  assert.deepEqual(await savedBusinessIds(targetUid), [])
  assert.deepEqual(await savedBusinessIds(controlUid), ['saved-cleanup-zero-control-business-000'])
})

test('real Firestore saved-business cleanup removes one target record and is idempotent', { skip: !enabled }, async () => {
  const targetUid = 'saved-cleanup-one-user'
  const controlUid = 'saved-cleanup-one-control'
  await Promise.all([
    seedSavedBusinesses(targetUid, 1, 'saved-cleanup-one-business'),
    seedSavedBusinesses(controlUid, 1, 'saved-cleanup-one-control-business'),
  ])

  assert.deepEqual(await cleanupUserSavedBusinesses({ uid: targetUid, db }), { deleted: 1 })
  assert.deepEqual(await savedBusinessIds(targetUid), [])
  assert.deepEqual(await savedBusinessIds(controlUid), ['saved-cleanup-one-control-business-000'])
  assert.deepEqual(await cleanupUserSavedBusinesses({ uid: targetUid, db }), { deleted: 0 })
  assert.deepEqual(await savedBusinessIds(controlUid), ['saved-cleanup-one-control-business-000'])
})

test('real Firestore saved-business cleanup crosses its bounded batch and preserves unrelated data', { skip: !enabled }, async () => {
  const targetUid = 'saved-cleanup-many-user'
  const controlUid = 'saved-cleanup-many-control'
  const businessPath = 'businesses/saved-cleanup-business-sentinel'
  const userPath = 'users/saved-cleanup-unrelated-user'
  const requestPath = 'accountDeletionRequests/saved-cleanup-unrelated-request'
  const businessData = { name: 'Cleanup sentinel business', status: 'active' }
  const userData = { uid: 'saved-cleanup-unrelated-user', marker: 'unchanged' }
  const requestData = { uid: 'saved-cleanup-unrelated-request', state: 'requested', requestVersion: 1 }

  await Promise.all([
    seedSavedBusinesses(targetUid, 201, 'saved-cleanup-many-business'),
    seedSavedBusinesses(controlUid, 2, 'saved-cleanup-many-control-business'),
    db.doc(businessPath).set(businessData),
    db.doc(userPath).set(userData),
    db.doc(requestPath).set(requestData),
  ])

  assert.deepEqual(await cleanupUserSavedBusinesses({ uid: targetUid, db }), { deleted: 201 })
  assert.deepEqual(await savedBusinessIds(targetUid), [])
  assert.deepEqual(await savedBusinessIds(controlUid), [
    'saved-cleanup-many-control-business-000',
    'saved-cleanup-many-control-business-001',
  ])
  assert.deepEqual((await db.doc(businessPath).get()).data(), businessData)
  assert.deepEqual((await db.doc(userPath).get()).data(), userData)
  assert.deepEqual((await db.doc(requestPath).get()).data(), requestData)

  assert.deepEqual(await cleanupUserSavedBusinesses({ uid: targetUid, db }), { deleted: 0 })
  assert.deepEqual(await savedBusinessIds(controlUid), [
    'saved-cleanup-many-control-business-000',
    'saved-cleanup-many-control-business-001',
  ])
})
