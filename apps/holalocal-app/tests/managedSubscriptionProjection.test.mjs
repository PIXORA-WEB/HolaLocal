import test from 'node:test'
import assert from 'node:assert/strict'
import { loadManagedBusinessSubscription } from '../src/services/managedSubscriptionProjection.js'

const managed = {
  businessId: 'business-1',
  name: 'Managed business',
  entitlements: { effectivePlanId: 'growth', sourceType: 'legacy_fallback' },
}

test('missing business returns null without requesting subscription projection', async () => {
  let projectionCalls = 0
  const result = await loadManagedBusinessSubscription({
    loadManagedBusiness: async () => null,
    loadSubscription: async () => { projectionCalls += 1 },
  })
  assert.equal(result, null)
  assert.equal(projectionCalls, 0)
})

test('authoritative projection overrides legacy entitlements after managed load', async () => {
  const result = await loadManagedBusinessSubscription({
    loadManagedBusiness: async () => managed,
    loadSubscription: async () => ({ effectivePlanId: 'pro', sourceType: 'private_authoritative' }),
  })
  assert.equal(result.effectivePlanId, undefined)
  assert.equal(result.entitlements.effectivePlanId, 'pro')
  assert.equal(result.entitlements.sourceType, 'private_authoritative')
})

test('temporary callable failure retains managed profile and legacy entitlement labelling', async () => {
  for (const code of ['functions/unavailable', 'functions/internal', 'functions/deadline-exceeded']) {
    const result = await loadManagedBusinessSubscription({
      loadManagedBusiness: async () => managed,
      loadSubscription: async () => { throw Object.assign(new Error('temporary'), { code }) },
    })
    assert.equal(result, managed)
    assert.equal(result.entitlements.effectivePlanId, 'growth')
    assert.equal(result.entitlements.sourceType, 'legacy_fallback')
  }
})

test('authentication and permission failures remain visible to the secure error journey', async () => {
  for (const code of ['functions/unauthenticated', 'functions/permission-denied']) {
    await assert.rejects(() => loadManagedBusinessSubscription({
      loadManagedBusiness: async () => managed,
      loadSubscription: async () => { throw Object.assign(new Error('denied'), { code }) },
    }), (error) => error?.code === code)
  }
})
