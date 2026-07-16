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
  assert.equal(db.data('businesses/owner').ownerId, 'owner')
  assert.deepEqual(db.data('businesses/owner').managerIds, ['owner'])
  assert.equal(db.data('businessPrivate/owner').contact.email, 'owner@example.invalid')
})

test('ensureOwnerBusiness returns an existing owned legacy auto-ID business instead of creating a duplicate', async () => {
  const db = new FakeFirestore({
    'users/owner': completeBusinessUser,
    'businesses/legacy-auto-id': { ownerId: 'owner', managerIds: ['owner'], status: 'draft' },
  })
  const result = await ensureOwnerBusiness({ uid: 'owner', emailVerified: true, db })

  assert.equal(result.businessId, 'legacy-auto-id')
  assert.equal(result.created, false)
  assert.equal(db.data('businesses/owner'), undefined)
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
