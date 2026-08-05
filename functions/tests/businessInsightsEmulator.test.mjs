import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { after, before, test } from 'node:test'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { recordBusinessInsight } from '../src/businessInsights.js'
import {
  BUSINESS_INSIGHT_GLOBAL_HOURLY_LIMIT,
  BUSINESS_INSIGHT_PER_BUSINESS_HOURLY_LIMIT,
  businessInsightRateLimitReferences,
} from '../src/businessInsightRateLimit.js'

const enabled = process.env.HOLALOCAL_CALLABLE_BOUNDARY === '1'
const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT
let db
let rulesEnvironment

function timestamp(value) {
  return Timestamp.fromDate(new Date(value))
}

function token(index) {
  return `token${String(index).padStart(20, '0')}`
}

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
    status: 'active', publishedAt: timestamp('2026-08-01T00:00:00Z'),
    deletedAt: null, deletionRequestedAt: null,
    ...overrides,
  }
}

function rateDocument({ scope, businessId, count, current }) {
  const { window } = businessInsightRateLimitReferences(db, businessId, current)
  return {
    schemaVersion: 1,
    scope,
    ...(scope === 'business' ? { businessId } : {}),
    windowStartedAt: window.windowStartedAt,
    windowEndsAt: window.windowEndsAt,
    count,
    createdAt: current,
    updatedAt: current,
    expiresAt: window.expiresAt,
  }
}

async function seedBusiness(businessId) {
  await db.doc(`businesses/${businessId}`).set(eligibleBusiness())
}

async function record(businessId, eventToken, current) {
  return recordBusinessInsight({
    data: { businessId, eventType: 'profile_view', eventToken },
    db,
    now: () => current,
  })
}

function counted(results) {
  return results.filter((result) => result.status === 'fulfilled' && result.value.counted).length
}

function resourceExhausted(results) {
  return results.filter(
    (result) => result.status === 'rejected' && result.reason?.code === 'resource-exhausted',
  ).length
}

if (enabled) {
  before(async () => {
    assert.match(projectId ?? '', /^demo-/)
    const app = getApps().find((candidate) => candidate.name === 'business-insight-emulator')
      ?? initializeApp({ projectId }, 'business-insight-emulator')
    db = getFirestore(app)
  })

  after(async () => {
    await rulesEnvironment?.cleanup()
  })
}

test('real transaction counts concurrent identical tokens exactly once', { skip: !enabled }, async () => {
  const businessId = 'concurrent-identical'
  const current = timestamp('2026-08-11T10:15:00Z')
  await seedBusiness(businessId)

  const results = await Promise.all(
    Array.from({ length: 10 }, () => record(businessId, token(1), current)),
  )
  assert.equal(results.filter((result) => result.counted).length, 1)
  assert.equal(results.filter((result) => !result.counted).length, 9)
  assert.equal((await db.doc(`businessInsights/${businessId}`).get()).data().profileViews, 1)
  assert.equal((await db.collection(`businessInsights/${businessId}/insightDedupe`).get()).size, 1)
})

test('ten simulated callers share one business limit and final slot', { skip: !enabled }, async () => {
  const businessId = 'concurrent-business-limit'
  const current = timestamp('2026-08-12T11:15:00Z')
  await seedBusiness(businessId)
  const { businessRef } = businessInsightRateLimitReferences(db, businessId, current)
  await businessRef.set(rateDocument({
    scope: 'business', businessId,
    count: BUSINESS_INSIGHT_PER_BUSINESS_HOURLY_LIMIT - 1,
    current,
  }))
  await db.doc(`businessInsights/${businessId}`).set({ profileViews: 299 })
  await db.doc(`businessInsights/${businessId}/days/2026-08-12`).set({ profileViews: 299 })

  const results = await Promise.allSettled(
    Array.from({ length: 10 }, (_, index) => record(businessId, token(index + 100), current)),
  )
  assert.equal(counted(results), 1)
  assert.equal(resourceExhausted(results), 9)
  assert.equal((await businessRef.get()).data().count, BUSINESS_INSIGHT_PER_BUSINESS_HOURLY_LIMIT)
  assert.equal((await db.doc(`businessInsights/${businessId}`).get()).data().profileViews, 300)
  assert.equal((await db.doc(`businessInsights/${businessId}/days/2026-08-12`).get()).data().profileViews, 300)
  assert.equal((await db.collection(`businessInsights/${businessId}/insightDedupe`).get()).size, 1)
})

test('requests across businesses stop at the global limit', { skip: !enabled }, async () => {
  const current = timestamp('2026-08-13T12:15:00Z')
  const businessIds = Array.from({ length: 20 }, (_, index) => `global-business-${index}`)
  await Promise.all(businessIds.map(seedBusiness))
  const { globalRef } = businessInsightRateLimitReferences(db, businessIds[0], current)
  await globalRef.set(rateDocument({
    scope: 'global', businessId: businessIds[0],
    count: BUSINESS_INSIGHT_GLOBAL_HOURLY_LIMIT - 10,
    current,
  }))

  const acceptedResults = []
  for (let index = 0; index < 10; index += 2) {
    acceptedResults.push(...await Promise.allSettled(
      businessIds.slice(index, index + 2).map(
        (businessId, offset) => record(businessId, token(index + offset + 200), current),
      ),
    ))
  }
  const limitedResults = await Promise.allSettled(
    businessIds.slice(10).map(
      (businessId, index) => record(businessId, token(index + 210), current),
    ),
  )
  assert.equal(counted(acceptedResults), 10)
  assert.equal(resourceExhausted(limitedResults), 10)
  assert.equal((await globalRef.get()).data().count, BUSINESS_INSIGHT_GLOBAL_HOURLY_LIMIT)
  const totalAggregates = (await Promise.all(businessIds.map(
    (businessId) => db.doc(`businessInsights/${businessId}`).get(),
  ))).filter((snapshot) => snapshot.exists).length
  assert.equal(totalAggregates, 10)
})

test('limited and malformed-counter failures leave no partial state', { skip: !enabled }, async () => {
  const businessId = 'atomic-failure'
  const current = timestamp('2026-08-14T13:15:00Z')
  await seedBusiness(businessId)
  const { globalRef, businessRef } = businessInsightRateLimitReferences(db, businessId, current)
  await globalRef.set({ count: 1, expiresAt: current })

  await assert.rejects(record(businessId, token(300), current), (error) => (
    error?.code === 'failed-precondition'
  ))
  assert.equal((await businessRef.get()).exists, false)
  assert.equal((await db.doc(`businessInsights/${businessId}`).get()).exists, false)
  assert.equal((await db.doc(`businessInsights/${businessId}/days/2026-08-14`).get()).exists, false)
  assert.equal((await db.collection(`businessInsights/${businessId}/insightDedupe`).get()).empty, true)
})

test('counter and dedupe expiry fields are Firestore timestamps', { skip: !enabled }, async () => {
  const businessId = 'timestamp-fields'
  const current = timestamp('2026-08-15T14:15:00Z')
  await seedBusiness(businessId)
  assert.equal((await record(businessId, token(400), current)).counted, true)
  const { globalRef, businessRef } = businessInsightRateLimitReferences(db, businessId, current)
  const dedupe = (await db.collection(`businessInsights/${businessId}/insightDedupe`).get()).docs[0].data()
  for (const value of [
    (await globalRef.get()).data().expiresAt,
    (await businessRef.get()).data().expiresAt,
    dedupe.expiresAt,
  ]) {
    assert.equal(value instanceof Timestamp, true)
  }
})

test('existing catch-all Rules deny direct rate-limit access', { skip: !enabled }, async () => {
  const websiteRequire = createRequire(
    new URL('../../apps/holalocal-website/package.json', import.meta.url),
  )
  const { assertFails, initializeTestEnvironment } = websiteRequire('@firebase/rules-unit-testing')
  const { doc, getDoc, setDoc } = websiteRequire('firebase/firestore')
  rulesEnvironment = await initializeTestEnvironment({ projectId })
  const clientDb = rulesEnvironment.unauthenticatedContext().firestore()
  const reference = doc(clientDb, 'businessInsightRateLimitHours/client-attempt')
  await assertFails(getDoc(reference))
  await assertFails(setDoc(reference, { count: 1 }))
})
