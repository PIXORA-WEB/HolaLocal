import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAccountRoleTransition, transitionAccountRole } from '../src/accountRoleTransition.js'

const completeProfile = Object.freeze({
  uid: 'user-1',
  email: 'user@example.invalid',
  accountStatus: 'active',
  firstName: 'Casey',
  lastName: 'Customer',
  displayName: 'Casey Customer',
  preferredLocale: 'en',
  city: 'Marbella',
  country: 'Spain',
  businessProfileCompleted: false,
  deletionRequestedAt: null,
})

function codeFrom(error) {
  return error?.code
}

test('trusted account role transition grants only the requested supported account role', () => {
  const update = buildAccountRoleTransition({
    uid: 'user-1',
    emailVerified: true,
    profile: completeProfile,
    accountType: 'both',
  })

  assert.equal(update.accountType, 'both')
  assert.deepEqual(update.roles, ['customer', 'business'])
  assert.equal(update.onboardingCompleted, true)
  assert.equal(update.businessProfileRequired, true)
  assert.equal(update.businessProfileCompleted, false)
  assert.equal(typeof update.updatedAt, 'object')
})

test('trusted account role transition supports customer business and both states idempotently', () => {
  const customer = buildAccountRoleTransition({
    uid: 'user-1',
    emailVerified: true,
    profile: { ...completeProfile, accountType: 'customer', roles: ['customer'] },
    accountType: 'customer',
  })
  assert.equal(customer.accountType, 'customer')
  assert.deepEqual(customer.roles, ['customer'])
  assert.equal(customer.businessProfileRequired, false)

  const business = buildAccountRoleTransition({
    uid: 'user-1',
    emailVerified: true,
    profile: completeProfile,
    accountType: 'business',
  })
  assert.equal(business.accountType, 'business')
  assert.deepEqual(business.roles, ['business'])
  assert.equal(business.businessProfileRequired, true)

  const retry = buildAccountRoleTransition({
    uid: 'user-1',
    emailVerified: true,
    profile: { ...completeProfile, accountType: 'business', roles: ['business'] },
    accountType: 'business',
  })
  assert.deepEqual(retry.roles, ['business'])
})

test('trusted account role transition rejects unauthenticated and unverified requests', () => {
  assert.throws(() => buildAccountRoleTransition({
    uid: '',
    emailVerified: true,
    profile: completeProfile,
    accountType: 'customer',
  }), (error) => codeFrom(error) === 'unauthenticated')

  assert.throws(() => buildAccountRoleTransition({
    uid: 'user-1',
    emailVerified: false,
    profile: completeProfile,
    accountType: 'customer',
  }), (error) => codeFrom(error) === 'failed-precondition')
})

test('trusted account role transition never queries managed businesses without a valid uid', async () => {
  const db = {
    doc() {
      throw new Error('doc() should not be reached with an invalid uid.')
    },
    collection() {
      throw new Error('collection() should not be reached with an invalid uid.')
    },
    runTransaction() {
      throw new Error('transaction should not be reached with an invalid uid.')
    },
  }

  await assert.rejects(() => transitionAccountRole({
    uid: undefined,
    emailVerified: true,
    accountType: 'customer',
    db,
  }), (error) => codeFrom(error) === 'unauthenticated')

  await assert.rejects(() => transitionAccountRole({
    uid: 'bad/user',
    emailVerified: true,
    accountType: 'customer',
    db,
  }), (error) => codeFrom(error) === 'unauthenticated')
})

test('trusted account role transition rejects arbitrary roles and invalid account state', () => {
  assert.throws(() => buildAccountRoleTransition({
    uid: 'user-1',
    emailVerified: true,
    profile: null,
    accountType: 'business',
  }), (error) => codeFrom(error) === 'failed-precondition')

  assert.throws(() => buildAccountRoleTransition({
    uid: 'user-1',
    emailVerified: true,
    profile: completeProfile,
    accountType: 'admin',
  }), (error) => codeFrom(error) === 'invalid-argument')

  assert.throws(() => buildAccountRoleTransition({
    uid: 'user-1',
    emailVerified: true,
    profile: { ...completeProfile, city: '' },
    accountType: 'business',
  }), (error) => codeFrom(error) === 'failed-precondition')

  assert.throws(() => buildAccountRoleTransition({
    uid: 'user-1',
    emailVerified: true,
    profile: { ...completeProfile, accountStatus: 'suspended' },
    accountType: 'business',
  }), (error) => codeFrom(error) === 'failed-precondition')

  assert.throws(() => buildAccountRoleTransition({
    uid: 'user-1',
    emailVerified: true,
    profile: { ...completeProfile, accountType: 'business', roles: ['business'] },
    accountType: 'customer',
    hasManagedBusiness: true,
  }), (error) => codeFrom(error) === 'failed-precondition')
})
