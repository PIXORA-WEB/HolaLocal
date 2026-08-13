import assert from 'node:assert/strict'
import test from 'node:test'
import { Timestamp } from 'firebase-admin/firestore'
import { finalizeAccountDeletion } from '../src/accountDeletionFinalizer.js'
import { FakeFirestore } from './fakeFirestore.mjs'

function database({ state = 'requested', requestVersion = 1, request = {}, user = { businessId: null } } = {}) {
  const db = new FakeFirestore({
    'accountDeletionRequests/target': { uid: 'target', state, requestVersion, ...request },
  })
  if (user) db.store.set('users/target', user)
  return db
}

function successfulPrimitives(order = []) {
  let version = 1
  return {
    assertNoOwnedBusinesses: async () => { order.push('ownership-check') },
    acquireLease: async ({ expectedRequestVersion }) => {
      version = expectedRequestVersion + 1; order.push('lease'); return { acquired: true, leaseId: 'lease', requestVersion: version }
    },
    recordCheckpoint: async ({ checkpoint }) => {
      order.push(`checkpoint:${checkpoint}`); version += 1
      return { checkpoint, requestVersion: version, idempotent: false }
    },
    removeManagerRelationships: async () => { order.push('manager-cleanup'); return { removed: 1 } },
    tombstoneConversations: async () => { order.push('conversation-tombstone'); return { tombstoned: 1 } },
    cleanupMedia: async () => { order.push('media-cleanup'); return { ok: true, counts: { attempted: 1, deleted: 1, alreadyMissing: 0, failed: 0 } } },
    minimizeEvidenceAndRemoveUser: async () => { order.push('user-removal'); version += 1; return { requestVersion: version } },
    deleteAuthUser: async () => { order.push('auth-delete'); return { ok: true } },
    completeWorkflow: async () => { order.push('complete'); version += 1; return { state: 'completed', requestVersion: version, idempotent: false } },
    markRetryable: async ({ failureCode }) => { order.push(`failed:${failureCode}`); version += 1; return { state: 'failed_retryable', failureCode, requestVersion: version } },
  }
}

const invoke = (db, primitives, overrides = {}) => finalizeAccountDeletion({
  adminUid: 'admin', claims: { admin: true }, uid: 'target', expectedRequestVersion: 1,
  db, primitives, ...overrides,
})

test('admin finalizer runs the approved order and Auth is the last external destructive action', async () => {
  const order = []; const result = await invoke(database(), successfulPrimitives(order))
  assert.equal(result.state, 'completed')
  assert.equal(result.lastCompletedStep, 'completed')
  assert.deepEqual(order, [
    'ownership-check', 'lease', 'ownership-check', 'checkpoint:ownership_verified',
    'manager-cleanup', 'checkpoint:manager_relationships_cleaned',
    'conversation-tombstone', 'checkpoint:conversations_tombstoned',
    'media-cleanup', 'checkpoint:profile_media_cleaned', 'user-removal',
    'auth-delete', 'checkpoint:firebase_auth_removed', 'complete',
  ])
  assert.ok(order.indexOf('auth-delete') > order.indexOf('user-removal'))
  assert.deepEqual(Object.keys(result), ['state', 'requestVersion', 'lastCompletedStep', 'failureCode', 'blockerCode', 'cleanupCounts', 'idempotent'])
  assert.equal(JSON.stringify(result).includes('email'), false)
  assert.equal(JSON.stringify(result).includes('path'), false)
})

test('owned business and ownership mirror conflicts block before lease or destruction', async () => {
  for (const message of ['owned-businesses-block-account-deletion', 'business-ownership-integrity-conflict']) {
    const order = []; const primitives = successfulPrimitives(order)
    primitives.assertNoOwnedBusinesses = async () => { order.push('ownership-check'); throw new Error(message) }
    const result = await invoke(database(), primitives)
    assert.match(result.blockerCode, /owned-businesses|ownership-integrity/)
    assert.deepEqual(order, ['ownership-check'])
    assert.equal(result.state, 'requested')
  }
})

test('media partial failure records sanitized retry state and stops user/Auth deletion', async () => {
  const order = []; const primitives = successfulPrimitives(order)
  primitives.cleanupMedia = async () => {
    order.push('media-cleanup')
    return { ok: false, retryable: true, counts: { attempted: 3, deleted: 2, alreadyMissing: 0, failed: 1 } }
  }
  const result = await invoke(database(), primitives)
  assert.equal(result.state, 'failed_retryable')
  assert.equal(result.failureCode, 'profile_media_cleanup_failed')
  assert.deepEqual(result.cleanupCounts, { attempted: 3, deleted: 2, alreadyMissing: 0, failed: 1 })
  assert.equal(order.includes('user-removal'), false)
  assert.equal(order.includes('auth-delete'), false)
})

test('consent/user failure stops before Auth and persists only a fixed failure code', async () => {
  const order = []; const primitives = successfulPrimitives(order)
  primitives.minimizeEvidenceAndRemoveUser = async () => { order.push('user-removal'); throw new Error('consent-evidence-invalid') }
  const result = await invoke(database(), primitives)
  assert.equal(result.failureCode, 'consent_evidence_invalid')
  assert.equal(order.includes('auth-delete'), false)
  assert.equal(JSON.stringify(result).includes('consent-evidence-invalid'), false)
})

test('manager and conversation integrity failures stop later helpers', async () => {
  for (const [key, message, expected] of [
    ['removeManagerRelationships', 'manager-relationship-integrity-conflict', 'manager_relationship_integrity_conflict'],
    ['tombstoneConversations', 'conversation-deletion-integrity-conflict', 'conversation_integrity_conflict'],
  ]) {
    const order = []; const primitives = successfulPrimitives(order)
    primitives[key] = async () => { order.push(key); throw new Error(message) }
    const result = await invoke(database(), primitives)
    assert.equal(result.failureCode, expected)
    assert.equal(order.includes('auth-delete'), false)
  }
})

test('Auth failure occurs last, is retryable, and contains no provider detail', async () => {
  const order = []; const primitives = successfulPrimitives(order)
  primitives.deleteAuthUser = async () => { order.push('auth-delete'); return { ok: false, retryable: true, failureCode: 'firebase_auth_deletion_failed', private: 'must-not-return' } }
  const result = await invoke(database(), primitives)
  assert.equal(result.failureCode, 'firebase_auth_deletion_failed')
  assert.equal(result.state, 'failed_retryable')
  assert.equal(JSON.stringify(result).includes('must-not-return'), false)
  assert.equal(order.includes('complete'), false)
})

test('completed request is idempotent and invokes no primitive', async () => {
  const order = []
  const result = await invoke(database({ state: 'completed', request: { lastCompletedStep: 'completed' } }), successfulPrimitives(order))
  assert.equal(result.state, 'completed'); assert.equal(result.idempotent, true); assert.deepEqual(order, [])
})

test('cancelled, missing, stale, and malformed requests are denied safely', async () => {
  await assert.rejects(() => invoke(database({ state: 'cancelled' }), successfulPrimitives()), /account-deletion-cancelled/)
  await assert.rejects(() => invoke(new FakeFirestore(), successfulPrimitives()), /request-not-found/)
  await assert.rejects(() => invoke(database({ requestVersion: 2 }), successfulPrimitives()), /stale-request-version/)
  await assert.rejects(() => invoke(database(), successfulPrimitives(), { uid: '../other' }), /invalid-target-uid/)
  await assert.rejects(() => invoke(database(), successfulPrimitives(), { expectedRequestVersion: '1' }), /invalid-request-version/)
})

test('failed_retryable and expired finalizing requests can resume with the supplied lease primitive', async () => {
  for (const state of ['failed_retryable', 'finalizing']) {
    const order = []
    const request = state === 'finalizing'
      ? { leaseId: 'expired', leaseExpiresAt: Timestamp.fromMillis(1), lastCompletedStep: 'conversations_tombstoned' }
      : { lastCompletedStep: 'manager_relationships_cleaned' }
    const db = database({ state, request })
    if (state === 'finalizing') db.store.get('accountDeletionRequests/target').leaseExpiresAt = Timestamp.fromMillis(1)
    const result = await invoke(db, successfulPrimitives(order))
    assert.equal(result.state, 'completed')
    assert.ok(order.includes('lease'))
  }
})

test('active competing lease and stale lease errors are not converted into workflow failure', async () => {
  for (const message of ['account-deletion-lease-active', 'stale-request-version']) {
    const primitives = successfulPrimitives()
    primitives.acquireLease = async () => { throw new Error(message) }
    await assert.rejects(() => invoke(database(), primitives), new RegExp(message))
  }
})

test('active finalizing request is rejected before ownership or destructive helpers run', async () => {
  const order = []
  const db = database({ state: 'finalizing', request: {
    leaseId: 'active', leaseExpiresAt: Timestamp.fromMillis(Date.now() + 60_000),
    lastCompletedStep: 'manager_relationships_cleaned',
  } })
  db.store.get('accountDeletionRequests/target').leaseExpiresAt = Timestamp.fromMillis(Date.now() + 60_000)
  await assert.rejects(() => invoke(db, successfulPrimitives(order)), /account-deletion-lease-active/)
  assert.deepEqual(order, [])
})

test('stale version on expired finalizing request runs no destructive helper', async () => {
  const order = []
  const db = database({ state: 'finalizing', requestVersion: 2, request: {
    leaseId: 'expired', leaseExpiresAt: Timestamp.fromMillis(1),
  } })
  db.store.get('accountDeletionRequests/target').leaseExpiresAt = Timestamp.fromMillis(1)
  await assert.rejects(() => invoke(db, successfulPrimitives(order)), /stale-request-version/)
  assert.deepEqual(order, [])
})

test('retry after Auth deletion re-verifies idempotent prerequisites and completes on user/auth absence', async () => {
  const order = []; const primitives = successfulPrimitives(order)
  primitives.deleteAuthUser = async () => { order.push('auth-delete:user-not-found'); return { ok: true, alreadyMissing: true } }
  primitives.minimizeEvidenceAndRemoveUser = async () => { order.push('user-removal:already-complete'); return { requestVersion: 8, idempotent: true } }
  const db = database({ state: 'failed_retryable', requestVersion: 7, user: null, request: {
    lastCompletedStep: 'user_evidence_minimized', retainedConsentEvidence: { termsVersion: '1.0' },
  } })
  const result = await invoke(db, primitives, { expectedRequestVersion: 7 })
  assert.equal(result.state, 'completed')
  assert.ok(order.includes('manager-cleanup'))
  assert.ok(order.includes('conversation-tombstone'))
  assert.ok(order.includes('media-cleanup'))
  assert.ok(order.includes('auth-delete:user-not-found'))
})
