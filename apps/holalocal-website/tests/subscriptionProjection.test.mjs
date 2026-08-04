import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  loadOwnerSubscriptionProjection,
  safeSubscriptionAccessStatus,
  safeSubscriptionPlanId,
} from '../src/utils/subscriptionProjection.js'

test('admin plan selection defaults to stable effective plans and safely falls back', () => {
  assert.equal(safeSubscriptionPlanId('growth'), 'growth')
  assert.equal(safeSubscriptionPlanId('pro'), 'pro')
  assert.equal(safeSubscriptionPlanId('unknown'), 'early_access')
  assert.equal(safeSubscriptionPlanId(null), 'early_access')
})

test('temporary projection failure is non-blocking while secure failures propagate', async () => {
  for (const code of ['functions/unavailable', 'functions/internal', 'functions/deadline-exceeded']) {
    const result = await loadOwnerSubscriptionProjection(async () => {
      throw Object.assign(new Error('temporary'), { code })
    })
    assert.deepEqual(result, { projection: null, unavailable: true })
  }
  for (const code of ['functions/unauthenticated', 'functions/permission-denied']) {
    await assert.rejects(
      () => loadOwnerSubscriptionProjection(async () => { throw Object.assign(new Error('secure'), { code }) }),
      (error) => error?.code === code,
    )
  }
})

test('legacy Growth remains selected when projection is unavailable and retry can replace it', async () => {
  const legacyPlan = safeSubscriptionPlanId('growth')
  const unavailable = await loadOwnerSubscriptionProjection(async () => {
    throw Object.assign(new Error('temporary'), { code: 'functions/unavailable' })
  })
  assert.equal(safeSubscriptionPlanId(unavailable.projection?.effectivePlanId, legacyPlan), 'growth')
  const retried = await loadOwnerSubscriptionProjection(async () => ({
    effectivePlanId: 'pro', accessStatus: 'active', sourceType: 'private_authoritative',
  }))
  assert.equal(safeSubscriptionPlanId(retried.projection.effectivePlanId, legacyPlan), 'pro')
  assert.equal(safeSubscriptionAccessStatus(retried.projection.accessStatus, 'ended'), 'active')
})

test('owner pages preserve managed profiles and expose a non-blocking retry notice', async () => {
  const [dashboard, subscription] = await Promise.all([
    readFile(new URL('../src/pages/business/BusinessDashboardPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/business/SubscriptionPage.jsx', import.meta.url), 'utf8'),
  ])
  for (const source of [dashboard, subscription]) {
    assert.match(source, /setBusinessProfile\(profile\)/)
    assert.match(source, /loadOwnerSubscriptionProjection/)
    assert.match(source, /subscriptionProjectionUnavailable/)
    assert.match(source, /retrySubscriptionProjection/)
    assert.match(source, /subscriptionProjection\.unavailable/)
  }
})
