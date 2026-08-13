import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { acquireAccountDeletionLease, minimizeConsentEvidenceAndRemoveUser } from '../src/accountDeletionPrimitives.js'

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
