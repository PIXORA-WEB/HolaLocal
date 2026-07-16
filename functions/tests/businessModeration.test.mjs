import test from 'node:test'
import assert from 'node:assert/strict'
import { FakeFirestore } from './fakeFirestore.mjs'
import { moderateBusiness } from '../src/businessModeration.js'

function eligibleBusiness(overrides = {}) {
  return {
    ownerId: 'owner',
    managerIds: ['owner'],
    name: 'Eligible business',
    description: 'A complete profile.',
    primaryCategoryId: 'cleaning',
    categoryIds: ['cleaning'],
    serviceAreas: ['marbella'],
    languages: ['en'],
    primaryLanguage: 'en',
    location: { locality: 'Marbella', region: 'Malaga', countryCode: 'ES' },
    contact: {
      phone: '', phoneVisible: false, email: '', emailVisible: false,
      whatsappNumber: '', whatsappVisible: false, website: '', websiteVisible: false,
      preferredContactMethod: 'holalocal', allowCallbackRequests: false,
    },
    status: 'pending_review',
    publishedAt: null,
    deletedAt: null,
    deletionRequestedAt: null,
    ...overrides,
  }
}

function codeFrom(error) {
  return error?.code
}

test('moderateBusiness publishes only eligible pending businesses for moderator or admin claims', async () => {
  const db = new FakeFirestore({
    'businesses/business-1': eligibleBusiness(),
    'businesses/business-2': eligibleBusiness({ name: '' }),
  })
  const result = await moderateBusiness({
    uid: 'moderator',
    claims: { moderator: true },
    businessId: 'business-1',
    operation: 'publish',
    db,
  })

  assert.equal(result.status, 'active')
  assert.equal(db.data('businesses/business-1').status, 'active')
  assert.ok(db.data('businesses/business-1').publishedAt)
  await assert.rejects(() => moderateBusiness({
    uid: 'admin',
    claims: { admin: true },
    businessId: 'business-2',
    operation: 'publish',
    db,
  }), (error) => codeFrom(error) === 'failed-precondition')
})

test('moderateBusiness supports explicit lifecycle operations only', async () => {
  const db = new FakeFirestore({
    'businesses/pending': eligibleBusiness(),
    'businesses/active': eligibleBusiness({ status: 'active', publishedAt: new Date() }),
    'businesses/suspended': eligibleBusiness({ status: 'suspended', publishedAt: new Date() }),
    'businesses/deleted': eligibleBusiness({ status: 'deleted', publishedAt: null }),
  })

  assert.equal((await moderateBusiness({
    uid: 'moderator',
    claims: { moderator: true },
    businessId: 'pending',
    operation: 'reject',
    db,
  })).status, 'rejected')
  assert.equal((await moderateBusiness({
    uid: 'moderator',
    claims: { moderator: true },
    businessId: 'active',
    operation: 'suspend',
    db,
  })).status, 'suspended')
  assert.equal((await moderateBusiness({
    uid: 'admin',
    claims: { admin: true },
    businessId: 'suspended',
    operation: 'restore',
    db,
  })).status, 'active')
  await assert.rejects(() => moderateBusiness({
    uid: 'moderator',
    claims: { moderator: true },
    businessId: 'deleted',
    operation: 'restore',
    db,
  }), (error) => codeFrom(error) === 'failed-precondition')
  await assert.rejects(() => moderateBusiness({
    uid: 'moderator',
    claims: { moderator: true },
    businessId: 'active',
    operation: 'draft',
    db,
  }), (error) => codeFrom(error) === 'invalid-argument')
})

test('moderateBusiness rejects unauthenticated ordinary callers and invalid identifiers', async () => {
  const db = new FakeFirestore({ 'businesses/business-1': eligibleBusiness() })
  await assert.rejects(() => moderateBusiness({
    uid: '',
    claims: { moderator: true },
    businessId: 'business-1',
    operation: 'publish',
    db,
  }), (error) => codeFrom(error) === 'unauthenticated')
  await assert.rejects(() => moderateBusiness({
    uid: 'owner',
    claims: {},
    businessId: 'business-1',
    operation: 'publish',
    db,
  }), (error) => codeFrom(error) === 'permission-denied')
  await assert.rejects(() => moderateBusiness({
    uid: 'moderator',
    claims: { moderator: true },
    businessId: '../business-1',
    operation: 'publish',
    db,
  }), (error) => codeFrom(error) === 'invalid-argument')
})
