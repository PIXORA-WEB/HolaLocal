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
    requestId: 'request_publish_001',
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
    requestId: 'request_publish_002',
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
    reasonCode: 'incomplete_profile',
    guidance: 'Please complete every required profile section.',
    requestId: 'request_reject_001',
    db,
  })).status, 'rejected')
  assert.equal((await moderateBusiness({
    uid: 'moderator',
    claims: { moderator: true },
    businessId: 'active',
    operation: 'suspend',
    requestId: 'request_suspend_001',
    db,
  })).status, 'suspended')
  assert.equal((await moderateBusiness({
    uid: 'admin',
    claims: { admin: true },
    businessId: 'suspended',
    operation: 'restore',
    requestId: 'request_restore_001',
    db,
  })).status, 'active')
  await assert.rejects(() => moderateBusiness({
    uid: 'moderator',
    claims: { moderator: true },
    businessId: 'deleted',
    operation: 'restore',
    requestId: 'request_restore_002',
    db,
  }), (error) => codeFrom(error) === 'failed-precondition')
  await assert.rejects(() => moderateBusiness({
    uid: 'moderator',
    claims: { moderator: true },
    businessId: 'active',
    operation: 'draft',
    requestId: 'request_draft_0001',
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
    requestId: 'request_publish_003',
    db,
  }), (error) => codeFrom(error) === 'unauthenticated')
  await assert.rejects(() => moderateBusiness({
    uid: 'owner',
    claims: {},
    businessId: 'business-1',
    operation: 'publish',
    requestId: 'request_publish_004',
    db,
  }), (error) => codeFrom(error) === 'permission-denied')
  await assert.rejects(() => moderateBusiness({
    uid: 'moderator',
    claims: { moderator: true },
    businessId: '../business-1',
    operation: 'publish',
    requestId: 'request_publish_005',
    db,
  }), (error) => codeFrom(error) === 'invalid-argument')
})

test('moderateBusiness stores private rejection feedback and one idempotent event', async () => {
  const db = new FakeFirestore({
    'businesses/business-1': eligibleBusiness(),
    'businessPrivate/business-1': { ownerId: 'owner', managerIds: ['owner'], contact: {} },
  })
  const input = {
    uid: 'moderator-from-token',
    claims: { moderator: true },
    businessId: 'business-1',
    operation: 'reject',
    reasonCode: 'unclear_service_information',
    guidance: 'Please explain each service and what customers can expect.',
    requestId: 'request_rejection_once',
    db,
  }
  await moderateBusiness(input)
  await moderateBusiness(input)

  const event = db.data('businesses/business-1/moderationEvents/request_rejection_once')
  assert.equal(event.moderatorUid, 'moderator-from-token')
  assert.equal(event.previousStatus, 'pending_review')
  assert.equal(event.newStatus, 'rejected')
  assert.equal(event.schemaVersion, 1)
  assert.equal(db.data('businessPrivate/business-1').currentRejection.reasonCode, 'unclear_service_information')
})

test('moderateBusiness binds an idempotency key to the complete normalized decision payload', async () => {
  const db = new FakeFirestore({ 'businesses/business-1': eligibleBusiness() })
  const original = {
    uid: 'moderator',
    claims: { moderator: true },
    businessId: 'business-1',
    operation: 'reject',
    reasonCode: 'other',
    guidance: 'Please revise the profile using the guidance provided here.',
    requestId: 'payload_bound_request',
    db,
  }
  const first = await moderateBusiness(original)
  const replay = await moderateBusiness({ ...original, guidance: `  ${original.guidance}  ` })
  assert.deepEqual(replay, first)

  for (const changes of [
    { operation: 'publish', reasonCode: null, guidance: null },
    { reasonCode: 'incomplete_profile' },
    { guidance: 'This is different owner-facing guidance for the same request.' },
    { uid: 'different-moderator' },
  ]) {
    await assert.rejects(
      () => moderateBusiness({ ...original, ...changes }),
      (error) => codeFrom(error) === 'already-exists',
    )
  }
  assert.equal(db.data('businesses/business-1/moderationEvents/payload_bound_request').guidance, original.guidance)
})

test('moderateBusiness rejects stale concurrent decisions without a second event', async () => {
  const db = new FakeFirestore({ 'businesses/business-1': eligibleBusiness() })
  await moderateBusiness({
    uid: 'first-admin', claims: { admin: true }, businessId: 'business-1',
    operation: 'publish', requestId: 'concurrent_request_one', db,
  })
  await assert.rejects(() => moderateBusiness({
    uid: 'second-admin', claims: { admin: true }, businessId: 'business-1',
    operation: 'reject', reasonCode: 'other',
    guidance: 'Please contact support for details about this review.',
    requestId: 'concurrent_request_two', db,
  }), (error) => codeFrom(error) === 'failed-precondition')
  assert.equal(db.data('businesses/business-1/moderationEvents/concurrent_request_two'), undefined)
})
