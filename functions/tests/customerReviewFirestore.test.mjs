import test from 'node:test'
import assert from 'node:assert/strict'
import { createCustomerReviewAuthAdapter, createCustomerReviewFirestoreDatabase,
  readCustomerReviewFirestoreEligibility } from '../src/customerReviewFirestore.js'

test('auth adapter checks revocation and current Auth user, not payload claims', async () => {
  const calls = []
  const user = { uid: 'auth:user.name', emailVerified: true, customClaims: { admin: true } }
  const adapter = createCustomerReviewAuthAdapter({
    verifyIdToken: async (...args) => { calls.push(args); return { uid: user.uid, admin: false } },
    getUser: async uid => { assert.equal(uid, user.uid); return user },
  })
  await assert.rejects(adapter.resolveActor({ uid: user.uid }))
  assert.deepEqual(await adapter.resolveActor('synthetic-token'), { uid: user.uid, emailVerified: true, admin: true })
  assert.deepEqual(calls, [['synthetic-token', true]])
  user.disabled = true
  await assert.rejects(adapter.loadAuthorIdentity(user.uid))
})

test('eligibility reads real collection paths and overrides stored document IDs', async () => {
  const paths = []
  const result = await readCustomerReviewFirestoreEligibility({ get: async path => {
    paths.push(path); return { uid: 'spoof', businessId: 'spoof', roles: ['customer'], managerIds: ['owner'] }
  } }, { authorUid: 'actual:user', businessId: 'actual-business' })
  assert.deepEqual(paths, ['users/actual:user', 'businesses/actual-business'])
  assert.equal(result.account.uid, 'actual:user'); assert.equal(result.business.businessId, 'actual-business')
})

test('adapter forwards transaction creates/deletes and enforces read phase', async () => {
  const operations = []
  const native = { get: async ref => ({ exists: true, data: () => ({ ref }) }),
    set: (...args) => operations.push(['set', ...args]), create: (...args) => operations.push(['create', ...args]),
    delete: (...args) => operations.push(['delete', ...args]) }
  const database = createCustomerReviewFirestoreDatabase({ doc: path => path, runTransaction: callback => callback(native) })
  await database.runTransaction(async tx => {
    assert.deepEqual(await tx.get('a/b'), { ref: 'a/b' })
    tx.create('a/c', { value: 1 }); tx.set('a/b', { value: 2 }); tx.delete('a/d')
    await assert.rejects(tx.get('a/e'), /read-after-write/)
  })
  assert.deepEqual(operations.map(row => row[0]), ['create', 'set', 'delete'])
})
