import assert from 'node:assert/strict'
import test from 'node:test'
import { Timestamp } from 'firebase-admin/firestore'
import { SAVED_BUSINESSES_DEFAULT_PAGE_SIZE, SAVED_BUSINESSES_MAX_PAGE_SIZE } from '@holalocal/firebase-contract'
import { handleListSavedBusinesses } from '../src/index.js'
import { listSavedBusinesses } from '../src/savedBusinesses.js'
import { FakeFirestore } from './fakeFirestore.mjs'

function user(overrides = {}) {
  return {
    accountStatus: 'active', deletionRequestedAt: null, roles: ['customer'], ...overrides,
  }
}

function eligibleBusiness(overrides = {}) {
  return {
    ownerId: 'private-owner',
    managerIds: ['private-owner'],
    name: 'Safe public business',
    description: 'A complete public profile.',
    tagline: 'Trusted local help',
    primaryCategoryId: 'Cleaning',
    categoryIds: ['Cleaning'],
    serviceAreas: ['marbella'],
    languages: ['en'],
    primaryLanguage: 'en',
    location: { locality: 'Marbella', region: 'Málaga', countryCode: 'ES' },
    contact: {
      phone: '', phoneVisible: false, email: '', emailVisible: false,
      whatsappNumber: '', whatsappVisible: false,
      website: '', websiteVisible: false, preferredContactMethod: 'holalocal',
      allowCallbackRequests: false,
    },
    status: 'active',
    verificationStatus: 'unverified',
    subscription: { tier: 'private-legacy', status: 'none' },
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    deletionRequestedAt: null,
    deletedAt: null,
    ratingAverage: 0,
    ratingCount: 0,
    privateNote: 'must not escape',
    ...overrides,
  }
}

function database({ account = user(), saves = [], businesses = {} } = {}) {
  const db = new FakeFirestore({
    'users/customer': account,
    ...Object.fromEntries(Object.entries(businesses).map(([id, business]) => [`businesses/${id}`, business])),
  })
  for (const { businessId, millis } of saves) {
    db.store.set(`users/customer/savedBusinesses/${businessId}`, {
      businessId,
      createdAt: Timestamp.fromMillis(millis),
    })
  }
  return db
}

function codeFrom(error) {
  return error?.code
}

test('saved-list authentication and customer capability are required', async () => {
  await assert.rejects(
    () => handleListSavedBusinesses({ data: {} }, new FakeFirestore()),
    (error) => codeFrom(error) === 'unauthenticated',
  )
  for (const account of [
    user({ roles: ['business'] }),
    user({ accountStatus: 'suspended' }),
    user({ accountStatus: 'deletion_pending', deletionRequestedAt: Timestamp.fromMillis(1) }),
  ]) {
    await assert.rejects(
      () => listSavedBusinesses({ uid: 'customer', db: database({ account }) }),
      (error) => ['permission-denied', 'failed-precondition'].includes(codeFrom(error)),
    )
  }
  for (const roles of [['customer'], ['customer', 'business']]) {
    const result = await listSavedBusinesses({ uid: 'customer', db: database({ account: user({ roles }) }) })
    assert.deepEqual(result, { items: [], nextCursor: null })
  }
})

test('saved-list page size uses shared bounds and rejects invalid input', async () => {
  const saves = Array.from({ length: SAVED_BUSINESSES_MAX_PAGE_SIZE + 1 }, (_, index) => ({
    businessId: `business-${String(index).padStart(2, '0')}`,
    millis: 1_000 + index,
  }))
  const db = database({ saves })
  const result = await listSavedBusinesses({ uid: 'customer', db })
  assert.equal(result.items.length, SAVED_BUSINESSES_DEFAULT_PAGE_SIZE)
  assert.ok(result.nextCursor)
  assert.equal(SAVED_BUSINESSES_MAX_PAGE_SIZE, 50)
  const maximum = await listSavedBusinesses({
    uid: 'customer', pageSize: SAVED_BUSINESSES_MAX_PAGE_SIZE, db: database({ saves }),
  })
  assert.equal(maximum.items.length, SAVED_BUSINESSES_MAX_PAGE_SIZE)
  assert.ok(maximum.nextCursor)
  for (const pageSize of [0, -1, 1.5, '20', SAVED_BUSINESSES_MAX_PAGE_SIZE + 1]) {
    await assert.rejects(
      () => listSavedBusinesses({ uid: 'customer', pageSize, db: database() }),
      (error) => codeFrom(error) === 'invalid-argument',
    )
  }
})

test('saved-list ordering and cursor pagination are stable without duplicates', async () => {
  const saves = [
    { businessId: 'alpha', millis: 3_000 },
    { businessId: 'charlie', millis: 2_000 },
    { businessId: 'bravo', millis: 2_000 },
    { businessId: 'delta', millis: 1_000 },
  ]
  const db = database({ saves })
  const first = await listSavedBusinesses({ uid: 'customer', pageSize: 2, db })
  const second = await listSavedBusinesses({ uid: 'customer', pageSize: 2, cursor: first.nextCursor, db })
  assert.deepEqual(first.items.map(({ businessId }) => businessId), ['alpha', 'charlie'])
  assert.deepEqual(second.items.map(({ businessId }) => businessId), ['bravo', 'delta'])
  assert.equal(second.nextCursor, null)
  assert.equal(new Set([...first.items, ...second.items].map(({ businessId }) => businessId)).size, 4)
})

test('eligible businesses reuse the safe projection and unavailable entries expose no stale data', async () => {
  const db = database({
    saves: [
      { businessId: 'eligible', millis: 3_000 },
      { businessId: 'unpublished', millis: 2_000 },
      { businessId: 'missing', millis: 1_000 },
    ],
    businesses: {
      eligible: eligibleBusiness(),
      unpublished: eligibleBusiness({ status: 'draft', publishedAt: null, name: 'Private old name' }),
    },
  })
  const result = await listSavedBusinesses({ uid: 'customer', pageSize: 10, db })
  assert.deepEqual(result.items.map(({ businessId }) => businessId), ['eligible', 'unpublished', 'missing'])
  const eligible = result.items[0]
  assert.equal(eligible.available, true)
  assert.equal(eligible.business.name, 'Safe public business')
  for (const privateField of ['ownerId', 'managerIds', 'privateNote']) {
    assert.equal(Object.hasOwn(eligible.business, privateField), false)
  }
  for (const unavailable of result.items.slice(1)) {
    assert.deepEqual(Object.keys(unavailable), ['businessId', 'savedAtMillis', 'available', 'business'])
    assert.equal(unavailable.available, false)
    assert.equal(unavailable.business, null)
    assert.equal(JSON.stringify(unavailable).includes('Private old name'), false)
  }
  assert.deepEqual(db.writePaths, [])
})

test('callable input cannot select another user and performs no writes', async () => {
  const db = database({ saves: [{ businessId: 'missing', millis: 1_000 }] })
  await assert.rejects(
    () => handleListSavedBusinesses({
      auth: { uid: 'customer' }, data: { userId: 'other' },
    }, db),
    (error) => codeFrom(error) === 'invalid-argument',
  )
  const result = await handleListSavedBusinesses({ auth: { uid: 'customer' }, data: {} }, db)
  assert.equal(result.items.length, 1)
  assert.deepEqual(db.writePaths, [])
})
