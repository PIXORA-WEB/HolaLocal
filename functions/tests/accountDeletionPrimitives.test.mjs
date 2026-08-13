import assert from 'node:assert/strict'
import test from 'node:test'
import { Timestamp } from 'firebase-admin/firestore'
import {
  acquireAccountDeletionLease,
  assertNoAuthoritativeOwnedBusinesses,
  cleanupUserMedia,
  completeAccountDeletionWorkflow,
  deleteFirebaseAuthUser,
  getAccountDeletionFinalizationEligibility,
  markAccountDeletionRetryable,
  minimizeConsentEvidenceAndRemoveUser,
  recordAccountDeletionCheckpoint,
  removeUserManagerRelationships,
  tombstoneDeletedUserConversations,
} from '../src/accountDeletionPrimitives.js'
import { FakeFirestore } from './fakeFirestore.mjs'

const now = Timestamp.fromMillis(1_700_000_000_000)
const consentTimestamp = { seconds: 1_700_000_000, nanoseconds: 0, toMillis: () => 1_700_000_000_000 }
const currentConsent = { termsAccepted: true, termsAcceptedAt: consentTimestamp, termsVersion: '1.0', privacyAccepted: true, privacyAcceptedAt: consentTimestamp, privacyVersion: '1.0' }

test('finalization eligibility uses trusted lease time with an inclusive expiry boundary', () => {
  const before = Timestamp.fromMillis(now.toMillis() - 1)
  const exact = Timestamp.fromMillis(now.toMillis())
  const after = Timestamp.fromMillis(now.toMillis() + 1)
  assert.deepEqual(getAccountDeletionFinalizationEligibility({ state: 'requested' }, now), { canFinalize: true, actionReason: 'requested' })
  assert.deepEqual(getAccountDeletionFinalizationEligibility({ state: 'failed_retryable' }, now), { canFinalize: true, actionReason: 'retryable-failure' })
  assert.deepEqual(getAccountDeletionFinalizationEligibility({ state: 'finalizing', leaseExpiresAt: after }, now), { canFinalize: false, actionReason: 'finalization-in-progress' })
  assert.deepEqual(getAccountDeletionFinalizationEligibility({ state: 'finalizing', leaseExpiresAt: exact }, now), { canFinalize: true, actionReason: 'expired-finalizer-lease' })
  assert.deepEqual(getAccountDeletionFinalizationEligibility({ state: 'finalizing', leaseExpiresAt: before }, now), { canFinalize: true, actionReason: 'expired-finalizer-lease' })
  for (const state of ['completed', 'cancelled']) {
    assert.deepEqual(getAccountDeletionFinalizationEligibility({ state }, now), { canFinalize: false, actionReason: 'terminal' })
  }
})

test('lease acquisition prevents competition, rejects stale versions, and permits expiry/retry', async () => {
  const db = new FakeFirestore({ 'accountDeletionRequests/u1': { uid: 'u1', state: 'requested', requestVersion: 1, retryCount: 0 } })
  const acquired = await acquireAccountDeletionLease({ uid: 'u1', adminUid: 'admin', expectedRequestVersion: 1, db, now, leaseIdFactory: () => 'lease-1' })
  assert.deepEqual(acquired, { acquired: true, completed: false, leaseId: 'lease-1', requestVersion: 2 })
  await assert.rejects(() => acquireAccountDeletionLease({ uid: 'u1', adminUid: 'admin2', expectedRequestVersion: 2, db, now, leaseIdFactory: () => 'lease-2' }), /account-deletion-lease-active/)
  await assert.rejects(() => acquireAccountDeletionLease({ uid: 'u1', adminUid: 'admin', expectedRequestVersion: 1, db, now }), /stale-request-version/)
  db.store.get('accountDeletionRequests/u1').leaseExpiresAt = Timestamp.fromMillis(now.toMillis() - 1)
  const reacquired = await acquireAccountDeletionLease({ uid: 'u1', adminUid: 'admin2', expectedRequestVersion: 2, db, now, leaseIdFactory: () => 'lease-2' })
  assert.equal(reacquired.leaseId, 'lease-2')
  assert.equal(db.data('accountDeletionRequests/u1').finalizedBy, 'admin2')
})

test('only one administrator can reacquire the same expired finalizing lease', async () => {
  const db = new FakeFirestore({ 'accountDeletionRequests/u1': {
    uid: 'u1', state: 'finalizing', requestVersion: 4, leaseId: 'expired',
    leaseExpiresAt: null,
  } })
  db.store.get('accountDeletionRequests/u1').leaseExpiresAt = Timestamp.fromMillis(now.toMillis() - 1)
  const attempts = await Promise.allSettled([
    acquireAccountDeletionLease({ uid: 'u1', adminUid: 'admin1', expectedRequestVersion: 4, db, now, leaseIdFactory: () => 'lease-a' }),
    acquireAccountDeletionLease({ uid: 'u1', adminUid: 'admin2', expectedRequestVersion: 4, db, now, leaseIdFactory: () => 'lease-b' }),
  ])
  assert.equal(attempts.filter(({ status }) => status === 'fulfilled').length, 1)
  assert.equal(attempts.filter(({ status }) => status === 'rejected').length, 1)
  assert.match(attempts.find(({ status }) => status === 'rejected').reason.message, /stale-request-version/)
  assert.equal(db.data('accountDeletionRequests/u1').requestVersion, 5)
})

test('checkpoint progression and fixed retry failures reject stale or out-of-order work', async () => {
  const db = new FakeFirestore({ 'accountDeletionRequests/u1': { state: 'finalizing', leaseId: 'lease', requestVersion: 2 } })
  const step = await recordAccountDeletionCheckpoint({ uid: 'u1', leaseId: 'lease', expectedRequestVersion: 2, checkpoint: 'ownership_verified', db })
  assert.equal(step.requestVersion, 3)
  assert.equal((await recordAccountDeletionCheckpoint({ uid: 'u1', leaseId: 'lease', expectedRequestVersion: 3, checkpoint: 'ownership_verified', db })).idempotent, true)
  await assert.rejects(() => recordAccountDeletionCheckpoint({ uid: 'u1', leaseId: 'lease', expectedRequestVersion: 3, checkpoint: 'profile_media_cleaned', db }), /checkpoint-out-of-order/)
  await assert.rejects(() => markAccountDeletionRetryable({ uid: 'u1', leaseId: 'lease', failureCode: 'free-form', db }), /invalid-failure-code/)
  const failed = await markAccountDeletionRetryable({ uid: 'u1', leaseId: 'lease', failureCode: 'internal_retryable', db })
  assert.equal(failed.state, 'failed_retryable')
})

test('authoritative ownership query blocks every lifecycle and mirror contradictions', async () => {
  for (const status of ['draft', 'pending_review', 'rejected', 'active', 'suspended', 'archived']) {
    const db = new FakeFirestore({ [`businesses/b-${status}`]: { ownerId: 'u1', status } })
    await assert.rejects(() => assertNoAuthoritativeOwnedBusinesses({ uid: 'u1', profile: {}, db }), /owned-businesses-block/)
  }
  const clear = new FakeFirestore()
  assert.deepEqual(await assertNoAuthoritativeOwnedBusinesses({ uid: 'u1', profile: {}, db: clear }), { blocked: false, ownedBusinessCount: 0 })
  const conflict = new FakeFirestore({ 'businessOwners/u1': { ownerId: 'u1', businessId: 'missing' } })
  await assert.rejects(() => assertNoAuthoritativeOwnedBusinesses({ uid: 'u1', profile: {}, db: conflict }), /integrity-conflict/)
})

test('manager cleanup updates matched public/private arrays only and is idempotent', async () => {
  const seed = {
    'businesses/b1': { ownerId: 'owner', managerIds: ['u1', 'other'], status: 'active', subscription: { plan: 'pro' }, logoStoragePath: 'keep' },
    'businessPrivate/b1': { ownerId: 'owner', managerIds: ['u1', 'other'], secret: 'keep' },
    'businesses/b2': { ownerId: 'owner2', managerIds: ['other'], status: 'draft' },
  }
  const db = new FakeFirestore(seed)
  assert.deepEqual(await removeUserManagerRelationships({ uid: 'u1', db }), { matched: 1, removed: 1 })
  assert.deepEqual(db.data('businesses/b1').managerIds, ['other'])
  assert.deepEqual(db.data('businessPrivate/b1').managerIds, ['other'])
  assert.equal(db.data('businesses/b1').logoStoragePath, 'keep')
  assert.equal(db.data('businessPrivate/b1').secret, 'keep')
  assert.deepEqual(await removeUserManagerRelationships({ uid: 'u1', db }), { matched: 0, removed: 0 })
})

test('manager cleanup fails closed for owner and inconsistent mirrors', async () => {
  const ownerDb = new FakeFirestore({ 'businesses/b1': { ownerId: 'u1', managerIds: ['u1'] } })
  await assert.rejects(() => removeUserManagerRelationships({ uid: 'u1', db: ownerDb }), /owner-conflict/)
  const mismatch = new FakeFirestore({ 'businesses/b1': { ownerId: 'owner', managerIds: ['u1'] }, 'businessPrivate/b1': { ownerId: 'owner', managerIds: [] } })
  await assert.rejects(() => removeUserManagerRelationships({ uid: 'u1', db: mismatch }), /integrity-conflict/)
})

test('conversation tombstone is minimal, preserves structure/history, and is idempotent', async () => {
  const db = new FakeFirestore({ 'conversations/c1': { status: 'active', customerId: 'u1', participantIds: ['u1', 'business-owner'], lastMessage: { senderId: 'u1', text: 'kept' }, privateState: 'kept' } })
  assert.deepEqual(await tombstoneDeletedUserConversations({ uid: 'u1', db }), { matched: 1, tombstoned: 1 })
  const updated = db.data('conversations/c1')
  assert.equal(updated.status, 'participant_deleted')
  assert.deepEqual(updated.participantIds, ['u1', 'business-owner'])
  assert.deepEqual(updated.lastMessage, { senderId: 'u1', text: 'kept' })
  assert.deepEqual(Object.keys(updated.participantTombstones.u1), ['type', 'deletedAt'])
  assert.equal(JSON.stringify(updated).includes('email'), false)
  assert.deepEqual(await tombstoneDeletedUserConversations({ uid: 'u1', db }), { matched: 1, tombstoned: 0 })
  const invalid = new FakeFirestore({ 'conversations/c2': { status: 'active', customerId: 'customer', participantIds: ['u1', 'customer'] } })
  await assert.rejects(() => tombstoneDeletedUserConversations({ uid: 'u1', db: invalid }), /integrity-conflict/)
})

test('profile media cleanup scopes to exact UID prefix and sanitizes partial failures', async () => {
  const prefixes = []; const deleted = []
  const files = [
    { delete: async () => deleted.push('canonical') },
    { delete: async () => { const error = new Error('missing'); error.code = 404; throw error } },
    { delete: async () => { throw new Error('secret path must not leak') } },
  ]
  const bucket = { getFiles: async (query) => { prefixes.push(query.prefix); return [files] } }
  const result = await cleanupUserMedia({ uid: 'u1', bucket })
  assert.deepEqual(prefixes, ['users/u1/profile/'])
  assert.deepEqual(result, { ok: false, retryable: true, counts: { attempted: 3, deleted: 1, alreadyMissing: 1, failed: 1 } })
  assert.equal(JSON.stringify(result).includes('path'), false)
  assert.deepEqual(await cleanupUserMedia({ uid: 'u1', bucket: { getFiles: async () => [[]] } }), { ok: true, retryable: false, counts: { attempted: 0, deleted: 0, alreadyMissing: 0, failed: 0 } })
  await assert.rejects(() => cleanupUserMedia({ uid: '../u2', bucket }), /invalid-trusted-uid/)
})

test('evidence minimization atomically retains only consent evidence and removes user', async () => {
  const db = new FakeFirestore({
    'accountDeletionRequests/u1': { uid: 'u1', state: 'finalizing', requestVersion: 5, lastCompletedStep: 'profile_media_cleaned' },
    'reports/r1': { reporterId: 'u1', detail: 'unchanged' },
  })
  db.store.set('users/u1', { uid: 'u1', email: 'private@example.com', displayName: 'Private', roles: ['customer'], ...currentConsent })
  const result = await minimizeConsentEvidenceAndRemoveUser({ uid: 'u1', db, expectedRequestVersion: 5 })
  assert.equal(result.removed, true); assert.equal(db.data('users/u1'), undefined)
  const request = db.data('accountDeletionRequests/u1')
  assert.deepEqual(Object.keys(request.retainedConsentEvidence).sort(), ['privacyAcceptedAt', 'privacyVersion', 'termsAcceptedAt', 'termsVersion'])
  assert.equal(JSON.stringify(request.retainedConsentEvidence).includes('private@example.com'), false)
  assert.deepEqual(db.data('reports/r1'), { reporterId: 'u1', detail: 'unchanged' })
})

test('malformed consent is never fabricated and transaction leaves user intact', async () => {
  const db = new FakeFirestore({ 'users/u1': { termsAccepted: true }, 'accountDeletionRequests/u1': { state: 'finalizing', requestVersion: 1, lastCompletedStep: 'profile_media_cleaned' } })
  await assert.rejects(() => minimizeConsentEvidenceAndRemoveUser({ uid: 'u1', db, expectedRequestVersion: 1 }), /consent-evidence-invalid/)
  assert.ok(db.data('users/u1')); assert.equal(db.data('accountDeletionRequests/u1').retainedConsentEvidence, undefined)
})

test('Auth deletion is UID-only, idempotent for missing users, and sanitizes errors', async () => {
  const calls = []
  assert.deepEqual(await deleteFirebaseAuthUser({ uid: 'oldUid', auth: { deleteUser: async (uid) => calls.push(uid) } }), { ok: true, alreadyMissing: false })
  assert.deepEqual(calls, ['oldUid'])
  const missing = { deleteUser: async () => { const error = new Error('private email'); error.code = 'auth/user-not-found'; throw error } }
  assert.deepEqual(await deleteFirebaseAuthUser({ uid: 'oldUid', auth: missing }), { ok: true, alreadyMissing: true })
  const failed = await deleteFirebaseAuthUser({ uid: 'oldUid', auth: { deleteUser: async () => { throw new Error('private email') } } })
  assert.deepEqual(failed, { ok: false, retryable: true, failureCode: 'firebase_auth_deletion_failed' })
  assert.equal(JSON.stringify(failed).includes('email'), false)
})

test('workflow completion requires Auth checkpoint and is terminal/idempotent', async () => {
  const db = new FakeFirestore({ 'accountDeletionRequests/u1': { state: 'finalizing', leaseId: 'lease', requestVersion: 8, lastCompletedStep: 'firebase_auth_removed' } })
  const completed = await completeAccountDeletionWorkflow({ uid: 'u1', leaseId: 'lease', expectedRequestVersion: 8, db })
  assert.equal(completed.state, 'completed')
  assert.equal(db.data('accountDeletionRequests/u1').leaseId, null)
  assert.equal((await completeAccountDeletionWorkflow({ uid: 'u1', leaseId: 'ignored', expectedRequestVersion: 1, db })).idempotent, true)
})

test('same email cannot attach a different UID to old workflow/history', async () => {
  const db = new FakeFirestore({ 'accountDeletionRequests/oldUid': { state: 'requested', requestVersion: 1 }, 'conversations/c1': { customerId: 'oldUid', participantIds: ['oldUid', 'business'], status: 'active' } })
  await assert.rejects(() => acquireAccountDeletionLease({ uid: 'newUid', adminUid: 'admin', expectedRequestVersion: 1, db, now }), /request-not-found/)
  assert.equal(db.data('accountDeletionRequests/oldUid').state, 'requested')
  assert.equal(db.data('conversations/c1').customerId, 'oldUid')
})
