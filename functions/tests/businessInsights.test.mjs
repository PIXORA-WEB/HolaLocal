import test from 'node:test'
import assert from 'node:assert/strict'
import { Timestamp } from 'firebase-admin/firestore'
import { FakeFirestore } from './fakeFirestore.mjs'
import {
  countCreatedConversation,
  getOwnerBusinessInsights,
  recordBusinessInsight,
} from '../src/businessInsights.js'

const fixedNow = Timestamp.fromDate(new Date('2026-08-01T12:00:00Z'))
const now = () => fixedNow

function eligibleBusiness(overrides = {}) {
  return {
    ownerId: 'owner', managerIds: ['owner'], name: 'Business', description: 'Description',
    primaryCategoryId: 'Cleaning', categoryIds: ['Cleaning'], serviceAreas: ['Marbella'],
    languages: ['en'], primaryLanguage: 'en',
    location: { locality: 'Marbella', region: 'Malaga', countryCode: 'ES' },
    contact: {
      phone: '123', phoneVisible: true, email: '', emailVisible: false,
      whatsappNumber: '', whatsappVisible: false, website: 'example.test', websiteVisible: true,
      preferredContactMethod: 'holalocal', allowCallbackRequests: false,
    },
    status: 'active', publishedAt: fixedNow, deletedAt: null, deletionRequestedAt: null,
    ...overrides,
  }
}

function code(error) { return error?.code }

function timestamp(value) { return Timestamp.fromDate(new Date(value)) }

function dedupePath(db, businessId = 'biz') {
  return [...db.store.keys()].find((path) => path.startsWith(`businessInsights/${businessId}/insightDedupe/`))
}

const profileRequest = (businessId = 'biz') => ({
  businessId,
  eventType: 'profile_view',
  eventToken: 'abcdefghijklmnop',
})

test('valid public profile view aggregates once and stores no private values', async () => {
  const db = new FakeFirestore({ 'businesses/biz': eligibleBusiness() })
  const request = profileRequest()
  assert.deepEqual(await recordBusinessInsight({ data: request, db, now }), { ok: true, counted: true })
  assert.deepEqual(await recordBusinessInsight({ data: request, db, now }), { ok: true, counted: false })
  assert.equal(db.data('businessInsights/biz').profileViews, 1)
  assert.equal(db.data('businessInsights/biz/days/2026-08-01').profileViews, 1)
  assert.equal(JSON.stringify([...db.store.values()]).includes('123'), true)
  assert.equal(JSON.stringify(db.data('businessInsights/biz')).includes('123'), false)
})

test('identical profile token remains deduplicated across UTC midnight within 24 hours', async () => {
  const db = new FakeFirestore({ 'businesses/biz': eligibleBusiness() })
  const beforeMidnight = () => timestamp('2026-08-01T23:59:59Z')
  const afterMidnight = () => timestamp('2026-08-02T00:00:01Z')

  assert.equal((await recordBusinessInsight({ data: profileRequest(), db, now: beforeMidnight })).counted, true)
  assert.equal((await recordBusinessInsight({ data: profileRequest(), db, now: afterMidnight })).counted, false)
  assert.equal(db.data('businessInsights/biz').profileViews, 1)
  assert.equal(db.data('businessInsights/biz/days/2026-08-02'), undefined)
})

test('identical token is countable after 24 hours while the expired document still exists', async () => {
  const db = new FakeFirestore({ 'businesses/biz': eligibleBusiness() })
  await recordBusinessInsight({ data: profileRequest(), db, now: () => timestamp('2026-08-01T10:00:00Z') })
  const path = dedupePath(db)
  const originalDedupe = db.data(path)

  assert.equal((await recordBusinessInsight({ data: profileRequest(), db, now: () => timestamp('2026-08-02T10:00:00Z') })).counted, true)
  assert.equal(db.data('businessInsights/biz').profileViews, 2)
  assert.equal(db.data(path).createdAt.toMillis(), timestamp('2026-08-02T10:00:00Z').toMillis())
  assert.equal(db.data(path).expiresAt.toMillis(), timestamp('2026-08-03T10:00:00Z').toMillis())
  assert.notEqual(db.data(path).expiresAt.toMillis(), originalDedupe.expiresAt.toMillis())
})

test('unexpired dedupe document remains uncounted', async () => {
  const db = new FakeFirestore({ 'businesses/biz': eligibleBusiness() })
  await recordBusinessInsight({ data: profileRequest(), db, now: () => timestamp('2026-08-01T10:00:00Z') })
  const path = dedupePath(db)
  const original = db.data(path)

  assert.equal((await recordBusinessInsight({ data: profileRequest(), db, now: () => timestamp('2026-08-02T09:59:59Z') })).counted, false)
  assert.equal(db.data('businessInsights/biz').profileViews, 1)
  assert.equal(db.data(path).createdAt.toMillis(), original.createdAt.toMillis())
})

test('malformed or missing dedupe expiry is safely overwritten and counted', async () => {
  for (const malformedExpiry of [undefined, null, '2026-08-03T10:00:00Z', { seconds: 1 }]) {
    const db = new FakeFirestore({ 'businesses/biz': eligibleBusiness() })
    await recordBusinessInsight({ data: profileRequest(), db, now: () => timestamp('2026-08-01T10:00:00Z') })
    const path = dedupePath(db)
    db.store.set(path, malformedExpiry === undefined ? { createdAt: fixedNow } : { createdAt: fixedNow, expiresAt: malformedExpiry })

    assert.equal((await recordBusinessInsight({ data: profileRequest(), db, now: () => timestamp('2026-08-01T11:00:00Z') })).counted, true)
    assert.equal(db.data('businessInsights/biz').profileViews, 2)
    assert.equal(db.data(path).expiresAt.toMillis(), timestamp('2026-08-02T11:00:00Z').toMillis())
  }
})

test('dedupe identity is isolated by business, event type and contact action', async () => {
  const db = new FakeFirestore({
    'businesses/biz': eligibleBusiness(),
    'businesses/other-biz': eligibleBusiness({ ownerId: 'other-owner', managerIds: ['other-owner'] }),
  })
  const token = 'abcdefghijklmnop'
  const events = [
    profileRequest('biz'),
    profileRequest('other-biz'),
    { businessId: 'biz', eventType: 'contact_action', contactAction: 'phone', eventToken: token },
    { businessId: 'biz', eventType: 'contact_action', contactAction: 'website', eventToken: token },
  ]
  for (const data of events) assert.equal((await recordBusinessInsight({ data, db, now })).counted, true)

  assert.equal(db.data('businessInsights/biz').profileViews, 1)
  assert.equal(db.data('businessInsights/other-biz').profileViews, 1)
  assert.equal(db.data('businessInsights/biz').contactActions, 2)
  assert.equal(db.data('businessInsights/biz').contactActionBreakdown.phone, 1)
  assert.equal(db.data('businessInsights/biz').contactActionBreakdown.website, 1)
  assert.equal([...db.store.keys()].filter((path) => path.includes('/insightDedupe/')).length, 4)
})

test('non-public and inactive businesses cannot record insights', async () => {
  for (const status of ['draft', 'pending_review', 'rejected', 'suspended', 'archived']) {
    const db = new FakeFirestore({ 'businesses/biz': eligibleBusiness({ status }) })
    await assert.rejects(recordBusinessInsight({ data: { businessId: 'biz', eventType: 'profile_view', eventToken: 'abcdefghijklmnop' }, db, now }), (error) => code(error) === 'failed-precondition')
  }
})

test('unsupported events, extra fields, unavailable and unsupported contacts are rejected', async () => {
  const db = new FakeFirestore({ 'businesses/biz': eligibleBusiness() })
  await assert.rejects(recordBusinessInsight({ data: { businessId: 'biz', eventType: 'review', eventToken: 'abcdefghijklmnop' }, db, now }), (error) => code(error) === 'invalid-argument')
  await assert.rejects(recordBusinessInsight({ data: { businessId: 'biz', eventType: 'profile_view', eventToken: 'abcdefghijklmnop', email: 'private@example.test' }, db, now }), (error) => code(error) === 'invalid-argument')
  await assert.rejects(recordBusinessInsight({ data: { businessId: 'biz', eventType: 'contact_action', contactAction: 'email', eventToken: 'abcdefghijklmnop' }, db, now }), (error) => code(error) === 'failed-precondition')
  await assert.rejects(recordBusinessInsight({ data: { businessId: 'biz', eventType: 'contact_action', contactAction: 'revenue', eventToken: 'abcdefghijklmnop' }, db, now }), (error) => code(error) === 'invalid-argument')
})

test('available contact action aggregates category without destination', async () => {
  const db = new FakeFirestore({ 'businesses/biz': eligibleBusiness() })
  await recordBusinessInsight({ data: { businessId: 'biz', eventType: 'contact_action', contactAction: 'website', eventToken: 'abcdefghijklmnop' }, db, now })
  assert.equal(db.data('businessInsights/biz').contactActions, 1)
  assert.equal(db.data('businessInsights/biz').contactActionBreakdown.website, 1)
  assert.equal(JSON.stringify(db.data('businessInsights/biz')).includes('example.test'), false)
})

test('conversation creation counts one enquiry and retry or messages do not count again', async () => {
  const conversation = { businessId: 'biz', customerId: 'customer' }
  const db = new FakeFirestore({ 'conversations/customer__biz': conversation })
  assert.deepEqual(await countCreatedConversation({ conversationId: 'customer__biz', conversation, db, now }), { counted: true })
  db.store.set('conversations/customer__biz/messages/one', { text: 'private message' })
  assert.deepEqual(await countCreatedConversation({ conversationId: 'customer__biz', conversation, db, now }), { counted: false })
  assert.equal(db.data('businessInsights/biz').enquiries, 1)
})

test('owner reader authorizes exact active owner and returns empty 30-day boundaries', async () => {
  const db = new FakeFirestore({
    'users/owner': { accountStatus: 'active', businessId: 'biz' },
    'users/other': { accountStatus: 'active', businessId: 'other-biz' },
    'businesses/biz': eligibleBusiness(),
  })
  const result = await getOwnerBusinessInsights({ uid: 'owner', data: { businessId: 'biz' }, db, now })
  assert.equal(result.days.length, 30)
  assert.equal(result.days[0].date, '2026-07-03')
  assert.equal(result.days.at(-1).date, '2026-08-01')
  assert.equal(result.trackingStartedAt, null)
  assert.deepEqual(result.allTime, { profileViews: 0, enquiries: 0, contactActions: 0 })
  await assert.rejects(getOwnerBusinessInsights({ uid: 'other', data: { businessId: 'biz' }, db, now }), (error) => code(error) === 'permission-denied')
})
