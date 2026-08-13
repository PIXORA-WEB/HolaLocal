import assert from 'node:assert/strict'
import test from 'node:test'
import { Timestamp } from 'firebase-admin/firestore'
import { ADMIN_DELETION_HISTORY_STATE_LIMIT, ADMIN_DELETION_OPERATIONAL_STATE_LIMIT, listAdminAccountDeletionRequests, projectAdminAccountDeletionRequest } from '../src/adminAccountDeletion.js'

function database(documents) {
  return { collection(name) {
    assert.equal(name, 'accountDeletionRequests')
    return { where(field, operator, state) {
      assert.equal(field, 'state'); assert.equal(operator, '==')
      return { limit(bound) { return { async get() {
        const matches = documents.filter((document) => document.state === state).slice(0, bound)
        return { size: matches.length, docs: matches.map(({ id, ...data }) => ({ id, data: () => data })) }
      } } } }
    } }
  } }
}

test('admin deletion projection exposes only the operational allowlist', () => {
  const projected = projectAdminAccountDeletionRequest('user-1', { state: 'failed_retryable', requestVersion: 7, requestedAt: Timestamp.fromMillis(1000), updatedAt: Timestamp.fromMillis(2000), lastCompletedStep: 'profile_media_cleaned', failureCode: 'internal_retryable', cleanupCounts: { attempted: 2, deleted: 1, alreadyMissing: 0, failed: 1 }, email: 'private@example.test', retainedConsentEvidence: { termsVersion: '1.0' }, leaseId: 'private-lease', mediaPath: 'users/user-1/profile/avatar' })
  assert.deepEqual(Object.keys(projected), ['uid', 'state', 'requestedAt', 'updatedAt', 'requestVersion', 'lastCompletedStep', 'failureCode', 'cleanupCounts', 'canFinalize', 'actionReason'])
  for (const secret of ['private@example.test', 'private-lease', 'users/user-1', 'termsVersion']) assert.equal(JSON.stringify(projected).includes(secret), false)
})

test('projection exposes derived expired-lease recovery without lease internals', () => {
  const now = Timestamp.fromMillis(10_000)
  const active = projectAdminAccountDeletionRequest('active', {
    state: 'finalizing', requestVersion: 2, leaseId: 'secret-active', leaseExpiresAt: Timestamp.fromMillis(10_001),
  }, now)
  const expired = projectAdminAccountDeletionRequest('expired', {
    state: 'finalizing', requestVersion: 3, leaseId: 'secret-expired', leaseExpiresAt: Timestamp.fromMillis(10_000),
  }, now)
  assert.equal(active.canFinalize, false)
  assert.equal(active.actionReason, 'finalization-in-progress')
  assert.equal(expired.canFinalize, true)
  assert.equal(expired.actionReason, 'expired-finalizer-lease')
  assert.equal(JSON.stringify([active, expired]).includes('secret-'), false)
})

test('admin-only bounded queue excludes history by default and allows explicit history', async () => {
  const docs = ['requested', 'failed_retryable', 'finalizing', 'completed', 'cancelled'].map((state, index) => ({ id: state, state, requestVersion: index + 1 }))
  const operational = await listAdminAccountDeletionRequests({ adminUid: 'admin', claims: { admin: true }, db: database(docs) })
  assert.deepEqual(operational.requests.map(({ uid }) => uid), ['failed_retryable', 'finalizing', 'requested'])
  const history = await listAdminAccountDeletionRequests({ adminUid: 'admin', claims: { admin: true }, includeHistory: true, db: database(docs) })
  assert.equal(history.requests.length, 5)
  assert.equal(history.operationalHasMore, false)
  assert.equal(history.historyHasMore, false)
})

test('newer terminal history cannot starve older operational requests', async () => {
  const recentHistory = Array.from({ length: 120 }, (_, index) => ({
    id: `history-${index}`, state: index % 2 ? 'completed' : 'cancelled', requestVersion: 1,
    requestedAt: Timestamp.fromMillis(10_000 + index), updatedAt: Timestamp.fromMillis(20_000 + index),
  }))
  const operational = [
    { id: 'old-requested', state: 'requested', requestVersion: 2, requestedAt: Timestamp.fromMillis(1) },
    { id: 'old-retry', state: 'failed_retryable', requestVersion: 3, requestedAt: Timestamp.fromMillis(2) },
    { id: 'active-finalizing', state: 'finalizing', requestVersion: 4, requestedAt: Timestamp.fromMillis(3), leaseExpiresAt: Timestamp.fromMillis(Date.now() + 60_000) },
    { id: 'expired-finalizing', state: 'finalizing', requestVersion: 5, requestedAt: Timestamp.fromMillis(4), leaseExpiresAt: Timestamp.fromMillis(1) },
  ]
  const result = await listAdminAccountDeletionRequests({ adminUid: 'admin', claims: { admin: true }, db: database([...recentHistory, ...operational]) })
  assert.deepEqual(result.requests.map(({ uid }) => uid), operational.map(({ id }) => id))
  assert.equal(result.requests.find(({ uid }) => uid === 'active-finalizing').canFinalize, false)
  assert.equal(result.requests.find(({ uid }) => uid === 'expired-finalizing').canFinalize, true)
  assert.equal(result.requests.some(({ state }) => state === 'completed' || state === 'cancelled'), false)
})

test('operational and history bounds are independent and explicit', async () => {
  const requested = Array.from({ length: ADMIN_DELETION_OPERATIONAL_STATE_LIMIT + 1 }, (_, index) => ({ id: `r-${index}`, state: 'requested', requestVersion: 1 }))
  const completed = Array.from({ length: ADMIN_DELETION_HISTORY_STATE_LIMIT + 1 }, (_, index) => ({ id: `h-${index}`, state: 'completed', requestVersion: 1 }))
  const operationalOnly = await listAdminAccountDeletionRequests({ adminUid: 'admin', claims: { admin: true }, db: database([...completed, ...requested]) })
  assert.equal(operationalOnly.requests.length, ADMIN_DELETION_OPERATIONAL_STATE_LIMIT)
  assert.equal(operationalOnly.operationalHasMore, true)
  assert.equal(operationalOnly.historyHasMore, false)
  const withHistory = await listAdminAccountDeletionRequests({ adminUid: 'admin', claims: { admin: true }, includeHistory: true, db: database([...completed, ...requested]) })
  assert.equal(withHistory.requests.filter(({ state }) => state === 'requested').length, ADMIN_DELETION_OPERATIONAL_STATE_LIMIT)
  assert.equal(withHistory.requests.filter(({ state }) => state === 'completed').length, ADMIN_DELETION_HISTORY_STATE_LIMIT)
  assert.equal(withHistory.operationalHasMore, true)
  assert.equal(withHistory.historyHasMore, true)
})

test('moderators and ordinary users cannot read the deletion queue', async () => {
  for (const claims of [{}, { moderator: true }, { admin: false }]) await assert.rejects(() => listAdminAccountDeletionRequests({ adminUid: 'caller', claims, db: database([]) }), (error) => error.code === 'permission-denied')
})
