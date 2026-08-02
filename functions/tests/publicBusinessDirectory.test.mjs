import test from 'node:test'
import assert from 'node:assert/strict'
import { FakeFirestore } from './fakeFirestore.mjs'
import { handleListPublicBusinesses } from '../src/index.js'
import {
  listPublicBusinesses,
  normalizePublicBusinessLimit,
  toPublicDirectoryBusiness,
} from '../src/publicBusinessDirectory.js'

function publishedAt(daysAgo) {
  return new Date(Date.UTC(2026, 0, 20 - daysAgo))
}

function eligibleBusiness(overrides = {}) {
  return {
    ownerId: 'owner',
    managerIds: ['owner'],
    name: 'Safe public business',
    description: 'A complete public profile.',
    tagline: 'Trusted local help',
    primaryCategoryId: 'Cleaning',
    categoryIds: ['Cleaning'],
    serviceAreas: ['marbella'],
    languages: ['en', 'es'],
    primaryLanguage: 'en',
    location: { locality: 'Marbella', region: 'Málaga', countryCode: 'ES' },
    contact: {
      phone: '', phoneVisible: false,
      email: '', emailVisible: false,
      whatsappNumber: '', whatsappVisible: false,
      website: 'https://example.invalid', websiteVisible: true,
      preferredContactMethod: 'holalocal',
      allowCallbackRequests: false,
    },
    profilePhoto: { downloadUrl: 'https://cdn.example.invalid/logo.png' },
    galleryImageURLs: ['https://cdn.example.invalid/work.png'],
    status: 'active',
    verificationStatus: 'unverified',
    subscription: { tier: 'free', status: 'none' },
    profileCompleted: true,
    publishedAt: publishedAt(0),
    deletedAt: null,
    deletionRequestedAt: null,
    ratingAverage: 4.5,
    ratingCount: 2,
    ...overrides,
  }
}

function codeFrom(error) {
  return error?.code
}

test('listPublicBusinesses callable allows unauthenticated callers and returns empty results', async () => {
  const result = await handleListPublicBusinesses({ data: {} }, new FakeFirestore())
  assert.deepEqual(result, { businesses: [] })
})

test('listPublicBusinesses returns safe public businesses in published order', async () => {
  const db = new FakeFirestore({
    'businesses/newer': eligibleBusiness({ name: 'Newer', publishedAt: publishedAt(0) }),
    'businesses/older': eligibleBusiness({ name: 'Older', publishedAt: publishedAt(5) }),
  })
  const result = await listPublicBusinesses({ maxResults: 10, db })

  assert.deepEqual(result.businesses.map((business) => business.businessId), ['newer', 'older'])
  assert.deepEqual(result.businesses.map((business) => business.name), ['Newer', 'Older'])
})

test('listPublicBusinesses excludes non-public lifecycle and malformed candidates', async () => {
  const db = new FakeFirestore({
    'businesses/draft': eligibleBusiness({ status: 'draft' }),
    'businesses/pending': eligibleBusiness({ status: 'pending_review' }),
    'businesses/suspended': eligibleBusiness({ status: 'suspended' }),
    'businesses/rejected': eligibleBusiness({ status: 'rejected' }),
    'businesses/archived': eligibleBusiness({ status: 'archived' }),
    'businesses/deleted': eligibleBusiness({ status: 'deleted', deletedAt: publishedAt(0) }),
    'businesses/no-published-at': eligibleBusiness({ publishedAt: null }),
    'businesses/incomplete': eligibleBusiness({ name: '' }),
    'businesses/deletion-pending': eligibleBusiness({ deletionRequestedAt: publishedAt(0) }),
    'businesses/unsafe-contact': eligibleBusiness({ contact: { ...eligibleBusiness().contact, phone: '600000000', phoneVisible: false } }),
    'businesses/legacy-contact': eligibleBusiness({ phone: '600000000' }),
    'businesses/eligible': eligibleBusiness({ name: 'Eligible', publishedAt: publishedAt(1) }),
  })
  const result = await listPublicBusinesses({ maxResults: 100, db })

  assert.deepEqual(result.businesses.map((business) => business.businessId), ['eligible'])
})

test('listPublicBusinesses response exposes only public directory fields', async () => {
  const raw = eligibleBusiness({
    ownerId: 'private-owner',
    managerIds: ['private-owner', 'manager'],
    moderationNote: 'internal',
    contact: {
      phone: '', phoneVisible: false,
      email: '', emailVisible: false,
      whatsappNumber: '', whatsappVisible: false,
      website: 'https://example.invalid', websiteVisible: true,
      preferredContactMethod: 'holalocal',
      allowCallbackRequests: false,
    },
  })
  const view = toPublicDirectoryBusiness('business-1', raw)

  assert.equal(view.businessId, 'business-1')
  assert.equal(view.contact.website, 'https://example.invalid')
  assert.equal(view.contact.phone, '')
  assert.equal(view.contact.email, '')
  assert.equal(view.contact.whatsappNumber, '')
  for (const privateField of ['ownerId', 'managerIds', 'moderationNote', 'compatibility']) {
    assert.equal(Object.hasOwn(view, privateField), false)
  }
})

test('listPublicBusinesses bounds and validates maxResults without query injection', async () => {
  assert.equal(normalizePublicBusinessLimit(undefined), 60)
  assert.equal(normalizePublicBusinessLimit(0), 1)
  assert.equal(normalizePublicBusinessLimit(250), 100)
  assert.equal(normalizePublicBusinessLimit('2'), 2)
  for (const invalid of ['', 'abc', { field: 'ownerId' }, ['status']]) {
    assert.throws(() => normalizePublicBusinessLimit(invalid), (error) => codeFrom(error) === 'invalid-argument')
  }

  const seed = Object.fromEntries(
    Array.from({ length: 105 }, (_, index) => [
      `businesses/business-${String(index).padStart(3, '0')}`,
      eligibleBusiness({ name: `Business ${index}`, publishedAt: publishedAt(index) }),
    ]),
  )
  const result = await listPublicBusinesses({ maxResults: 250, db: new FakeFirestore(seed) })
  assert.equal(result.businesses.length, 100)
})

test('authenticated and unauthenticated listPublicBusinesses handlers return the same public boundary', async () => {
  const db = new FakeFirestore({
    'businesses/public': eligibleBusiness(),
  })
  const unauthenticated = await handleListPublicBusinesses({ data: { maxResults: 5 } }, db)
  const authenticated = await handleListPublicBusinesses({
    auth: { uid: 'customer', token: { email_verified: true } },
    data: { maxResults: 5 },
  }, db)

  assert.deepEqual(authenticated, unauthenticated)
  assert.deepEqual(Object.keys(authenticated.businesses[0]).sort(), [
    'businessId',
    'category',
    'contact',
    'description',
    'galleryUrls',
    'languages',
    'logoUrl',
    'name',
    'primaryLanguage',
    'profileComplete',
    'ratingAverage',
    'ratingCount',
    'serviceArea',
    'serviceAreas',
    'services',
    'status',
    'subscriptionStatus',
    'subscriptionTier',
    'tagline',
    'verificationStatus',
  ].sort())
})

test('public directory safely resolves legacy, canonical and malformed subscription states', () => {
  const legacy = toPublicDirectoryBusiness('legacy', eligibleBusiness({
    subscription: { tier: 'free', status: 'none' },
  }))
  assert.equal(legacy.subscriptionTier, 'early_access')
  assert.equal(legacy.subscriptionStatus, 'active')

  const growth = toPublicDirectoryBusiness('growth', eligibleBusiness({
    subscription: {
      schemaVersion: 1,
      planId: 'growth',
      planRevision: 1,
      accessStatus: 'active',
      assignmentSource: 'admin',
      assignedAt: null,
      startsAt: null,
      endsAt: null,
      updatedAt: null,
      updatedBy: 'admin-user',
    },
  }))
  assert.equal(growth.subscriptionTier, 'growth')
  assert.equal(growth.subscriptionStatus, 'active')

  const malformed = toPublicDirectoryBusiness('malformed', eligibleBusiness({
    subscription: {
      schemaVersion: 1,
      planId: 'unknown-plan',
      planRevision: 1,
      accessStatus: 'active',
      assignmentSource: 'admin',
    },
  }))
  assert.equal(malformed.subscriptionTier, 'early_access')
  assert.equal(malformed.subscriptionStatus, 'active')

  for (const view of [legacy, growth, malformed]) {
    assert.equal(Object.hasOwn(view, 'subscription'), false)
    assert.equal(Object.hasOwn(view, 'entitlements'), false)
  }
})
