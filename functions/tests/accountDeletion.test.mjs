import assert from 'node:assert/strict'
import test from 'node:test'
import { requestAccountDeletion, cancelAccountDeletion } from '../src/accountDeletion.js'
import { FakeFirestore } from './fakeFirestore.mjs'

const consentTimestamp = { seconds: 1_700_000_000, nanoseconds: 0, toMillis: () => 1_700_000_000_000 }
const nowSeconds = 1_800_000_000

function profile(overrides = {}) {
  return {
    uid: 'user-1', email: 'private@example.test', accountStatus: 'active',
    roles: ['customer'], businessId: null, deletionRequestedAt: null,
    deletionScheduledFor: null, anonymizedAt: null, displayName: 'Private', city: 'Private',
    termsAccepted: true, termsAcceptedAt: consentTimestamp, termsVersion: '1.0',
    privacyAccepted: true, privacyAcceptedAt: consentTimestamp, privacyVersion: '1.0',
    ...overrides,
  }
}

function database(userProfile = profile()) {
  const db = new FakeFirestore()
  if (userProfile) db.store.set('users/user-1', userProfile)
  return db
}

function request(db, overrides = {}) {
  return requestAccountDeletion({
    uid: 'user-1', emailVerified: true, authTime: nowSeconds - 30,
    claims: {}, db, nowSeconds, ...overrides,
  })
}

test('request requires verified email and authentication no older than five minutes', async () => {
  await assert.rejects(() => request(database(), { uid: '' }), (error) => error.code === 'unauthenticated')
  await assert.rejects(() => request(database(), { emailVerified: false }), (error) => error.message === 'email-verification-required')
  await assert.rejects(() => request(database(), { authTime: nowSeconds - 301 }), (error) => error.message === 'recent-authentication-required')
  await assert.doesNotReject(() => request(database(), { authTime: nowSeconds - 300 }))
})

test('request rejects missing inactive malformed-consent and privileged accounts', async () => {
  await assert.rejects(() => request(database(null)), (error) => error.message === 'profile-not-found')
  for (const accountStatus of ['suspended', 'deletion_pending', 'deleted']) {
    await assert.rejects(() => request(database(profile({ accountStatus }))), (error) => error.message === 'account-not-active')
  }
  await assert.rejects(() => request(database(profile({ termsAcceptedAt: null }))), (error) => error.message === 'legal-consent-required')
  await assert.rejects(() => request(database(), { claims: { admin: true } }), (error) => error.message === 'privileged-account-deletion-requires-support')
})

test('no-business request creates one trusted document and changes only deletion mirrors', async () => {
  const original = profile({ privateField: 'preserve', roles: ['customer'], updatedAt: 'old' })
  const db = database(original)
  const result = await request(db)
  const storedUser = db.data('users/user-1')
  const storedRequest = db.data('accountDeletionRequests/user-1')
  assert.equal(result.ok, true)
  assert.equal(result.idempotent, false)
  assert.equal(storedRequest.uid, 'user-1')
  assert.equal(storedRequest.requestedBy, 'user-1')
  assert.equal(storedRequest.state, 'requested')
  assert.equal(storedRequest.requestVersion, 1)
  assert.equal(storedRequest.cancelledAt, null)
  for (const field of ['roles', 'email', 'displayName', 'city', 'privateField', 'termsVersion', 'privacyVersion', 'accountStatus']) {
    assert.deepEqual(storedUser[field], original[field])
  }
  assert.notEqual(storedUser.deletionRequestedAt, null)
  assert.equal(storedUser.deletionScheduledFor, null)
  assert.deepEqual(db.writePaths.sort(), ['accountDeletionRequests/user-1', 'users/user-1'])
})

test('every owned business lifecycle blocks through the authoritative ownerId query', async () => {
  for (const status of ['draft', 'pending_review', 'rejected', 'active', 'suspended', 'archived']) {
    const db = database(profile({ businessId: 'business-1', roles: ['customer', 'business'] }))
    db.store.set('businesses/business-1', { ownerId: 'user-1', status })
    db.store.set('businessOwners/user-1', { ownerId: 'user-1', businessId: 'business-1' })
    const result = await request(db)
    assert.deepEqual(result, { ok: false, blocked: true, reason: 'owned-businesses', ownedBusinessCount: 1 })
    assert.equal(db.data('accountDeletionRequests/user-1'), undefined)
    assert.equal(db.data('users/user-1').deletionRequestedAt, null)
  }
})

test('contradictory ownership mirrors fail closed without repair', async () => {
  for (const setup of [
    (db) => { db.store.set('users/user-1', profile({ businessId: 'missing-business' })) },
    (db) => { db.store.set('businessOwners/user-1', { ownerId: 'user-1', businessId: 'missing-business' }) },
    (db) => { db.store.set('businessOwners/user-1', { ownerId: 'someone-else', businessId: 'missing-business' }) },
  ]) {
    const db = database()
    setup(db)
    await assert.rejects(() => request(db), (error) => error.message === 'business-ownership-integrity-conflict')
    assert.equal(db.writePaths.length, 0)
  }
})

test('repeated equivalent request is idempotent and does not duplicate or rewrite', async () => {
  const db = database(profile({ deletionRequestedAt: consentTimestamp }))
  db.store.set('accountDeletionRequests/user-1', {
    uid: 'user-1', state: 'requested', requestedAt: consentTimestamp, requestedBy: 'user-1',
    cancelledAt: null, updatedAt: consentTimestamp, requestVersion: 2,
  })
  const result = await request(db)
  assert.equal(result.idempotent, true)
  assert.equal(result.request.requestVersion, 2)
  assert.equal(db.writePaths.length, 0)
})

test('cancellation clears only pending mirrors, preserves profile data, and is idempotent', async () => {
  const original = profile({ deletionRequestedAt: consentTimestamp, roles: ['customer'], privateField: 'preserve' })
  const db = database(original)
  db.store.set('accountDeletionRequests/user-1', {
    uid: 'user-1', state: 'requested', requestedAt: consentTimestamp, requestedBy: 'user-1',
    cancelledAt: null, updatedAt: consentTimestamp, requestVersion: 1,
  })
  const first = await cancelAccountDeletion({ uid: 'user-1', db })
  assert.equal(first.idempotent, false)
  assert.equal(db.data('accountDeletionRequests/user-1').state, 'cancelled')
  assert.equal(db.data('accountDeletionRequests/user-1').requestVersion, 2)
  assert.equal(db.data('users/user-1').deletionRequestedAt, null)
  for (const field of ['roles', 'privateField', 'termsVersion', 'privacyVersion', 'accountStatus']) {
    assert.deepEqual(db.data('users/user-1')[field], original[field])
  }
  const second = await cancelAccountDeletion({ uid: 'user-1', db })
  assert.equal(second.idempotent, true)
})

test('cancellation rejects absent and future non-cancellable states', async () => {
  const db = database()
  await assert.rejects(() => cancelAccountDeletion({ uid: 'user-1', db }), (error) => error.message === 'account-deletion-request-not-found')
  db.store.set('accountDeletionRequests/user-1', { uid: 'user-1', state: 'finalizing', requestVersion: 2 })
  await assert.rejects(() => cancelAccountDeletion({ uid: 'user-1', db }), (error) => error.message === 'account-deletion-not-cancellable')
})
