import test from 'node:test'
import assert from 'node:assert/strict'
import { FakeFirestore } from './fakeFirestore.mjs'
import { ensureOwnerBusiness } from '../src/ownerBusinessCreation.js'

const completeBusinessUser = Object.freeze({
  uid: 'owner',
  email: 'owner@example.invalid',
  accountStatus: 'active',
  roles: ['business'],
  firstName: 'Olivia',
  lastName: 'Owner',
  displayName: 'Olivia Owner',
  preferredLocale: 'en',
  city: 'Marbella',
  country: 'Spain',
  deletionRequestedAt: null,
})

function codeFrom(error) {
  return error?.code
}

test('ensureOwnerBusiness creates one deterministic owner business and converges on retry', async () => {
  const db = new FakeFirestore({ 'users/owner': completeBusinessUser })
  const first = await ensureOwnerBusiness({ uid: 'owner', emailVerified: true, db })
  const retry = await ensureOwnerBusiness({ uid: 'owner', emailVerified: true, db })

  assert.equal(first.businessId, 'owner')
  assert.equal(first.created, true)
  assert.equal(retry.businessId, 'owner')
  assert.equal(retry.created, false)
  assert.equal(db.data('users/owner').businessId, 'owner')
  assert.equal(db.data('businesses/owner').ownerId, 'owner')
  assert.deepEqual(db.data('businesses/owner').managerIds, ['owner'])
  assert.equal(db.data('businessPrivate/owner').contact.email, 'owner@example.invalid')
  assert.equal(db.data('users/owner').businessProfileCompleted, undefined)
})

test('ensureOwnerBusiness returns an existing owned legacy auto-ID business and repairs a null pointer', async () => {
  const db = new FakeFirestore({
    'users/owner': { ...completeBusinessUser, businessId: null, businessProfileCompleted: false },
    'businesses/legacy-auto-id': { ownerId: 'owner', managerIds: ['owner'], status: 'draft' },
  })
  const result = await ensureOwnerBusiness({ uid: 'owner', emailVerified: true, db })

  assert.equal(result.businessId, 'legacy-auto-id')
  assert.equal(result.created, false)
  assert.equal(db.data('users/owner').businessId, 'legacy-auto-id')
  assert.equal(db.data('users/owner').businessProfileCompleted, false)
  assert.equal(db.data('businesses/owner'), undefined)
})

test('ensureOwnerBusiness keeps matching pointers idempotent and rejects conflicting pointers', async () => {
  const matchingDb = new FakeFirestore({
    'users/owner': { ...completeBusinessUser, businessId: 'legacy-auto-id' },
    'businesses/legacy-auto-id': { ownerId: 'owner', managerIds: ['owner'], status: 'draft' },
  })
  const result = await ensureOwnerBusiness({ uid: 'owner', emailVerified: true, db: matchingDb })
  assert.equal(result.businessId, 'legacy-auto-id')
  assert.equal(result.created, false)
  assert.equal(matchingDb.data('users/owner').businessId, 'legacy-auto-id')

  const conflictingDb = new FakeFirestore({
    'users/owner': { ...completeBusinessUser, businessId: 'other-business' },
    'businesses/legacy-auto-id': { ownerId: 'owner', managerIds: ['owner'], status: 'draft' },
  })
  await assert.rejects(() => ensureOwnerBusiness({
    uid: 'owner',
    emailVerified: true,
    db: conflictingDb,
  }), (error) => codeFrom(error) === 'failed-precondition' && error.message === 'business-pointer-conflict')
})

test('ensureOwnerBusiness repairs the user pointer for an existing deterministic owner business', async () => {
  const db = new FakeFirestore({
    'users/owner': { ...completeBusinessUser, businessId: null },
    'businesses/owner': { ownerId: 'owner', managerIds: ['owner'], status: 'draft' },
    'businessPrivate/owner': { ownerId: 'owner', managerIds: ['owner'], contact: {} },
  })
  const result = await ensureOwnerBusiness({ uid: 'owner', emailVerified: true, db })

  assert.equal(result.businessId, 'owner')
  assert.equal(result.created, false)
  assert.equal(db.data('users/owner').businessId, 'owner')
  assert.equal(db.data('businessPrivate/owner').ownerId, 'owner')
})

test('ensureOwnerBusiness rejects ambiguous owner businesses', async () => {
  const db = new FakeFirestore({
    'users/owner': completeBusinessUser,
    'businesses/legacy-one': { ownerId: 'owner', managerIds: ['owner'], status: 'draft' },
    'businesses/legacy-two': { ownerId: 'owner', managerIds: ['owner'], status: 'draft' },
  })

  await assert.rejects(() => ensureOwnerBusiness({
    uid: 'owner',
    emailVerified: true,
    db,
  }), (error) => codeFrom(error) === 'failed-precondition' && error.message === 'ambiguous-business-ownership')
})

test('ensureOwnerBusiness rejects manager-only users and ineligible profile states', async () => {
  const managerDb = new FakeFirestore({
    'users/manager': { ...completeBusinessUser, uid: 'manager', email: 'manager@example.invalid' },
    'businesses/managed-business': { ownerId: 'owner', managerIds: ['owner', 'manager'], status: 'draft' },
  })
  await assert.rejects(() => ensureOwnerBusiness({
    uid: 'manager',
    emailVerified: true,
    db: managerDb,
  }), (error) => codeFrom(error) === 'failed-precondition')

  const customerDb = new FakeFirestore({
    'users/customer': { ...completeBusinessUser, uid: 'customer', roles: ['customer'] },
  })
  await assert.rejects(() => ensureOwnerBusiness({
    uid: 'customer',
    emailVerified: true,
    db: customerDb,
  }), (error) => codeFrom(error) === 'failed-precondition')

  await assert.rejects(() => ensureOwnerBusiness({
    uid: 'owner',
    emailVerified: false,
    db: new FakeFirestore({ 'users/owner': completeBusinessUser }),
  }), (error) => codeFrom(error) === 'failed-precondition')
})
