import test from 'node:test'
import assert from 'node:assert/strict'
import {
  businessEntitlementLimit,
  buildEarlyAccessSubscriptionState,
  DEFAULT_ARRAY_BOUNDS,
  ENTITLEMENT_FEATURE_KEYS,
  ENTITLEMENT_LIMIT_KEYS,
  hasBusinessEntitlement,
  ISSUE_CODES,
  normalizeBusinessSubscription,
  PLAN_CATALOGUE_VERSION,
  PLAN_DEFINITIONS,
  PLAN_IDS,
  PLAN_ID_VALUES,
  resolveBusinessEntitlements,
  resolveAuthoritativeBusinessEntitlements,
  resolveAuthoritativeBusinessSubscription,
  SUBSCRIPTION_ACCESS_STATUSES,
  SUBSCRIPTION_ASSIGNMENT_SOURCES,
  SUBSCRIPTION_FALLBACK_REASONS,
  SUBSCRIPTION_LIMIT_UNLIMITED,
  SUBSCRIPTION_SCHEMA_VERSION,
} from '../index.js'

const expectedPlanIds = ['early_access', 'starter', 'growth', 'pro']
const featureKeys = Object.values(ENTITLEMENT_FEATURE_KEYS).sort()
const limitKeys = Object.values(ENTITLEMENT_LIMIT_KEYS).sort()

test('subscription identifiers and schema versions are stable', () => {
  assert.equal(SUBSCRIPTION_SCHEMA_VERSION, 1)
  assert.equal(PLAN_CATALOGUE_VERSION, 1)
  assert.deepEqual(PLAN_ID_VALUES, expectedPlanIds)
  assert.deepEqual(PLAN_IDS, {
    EARLY_ACCESS: 'early_access',
    STARTER: 'starter',
    GROWTH: 'growth',
    PRO: 'pro',
  })
  assert.deepEqual(SUBSCRIPTION_ACCESS_STATUSES, ['scheduled', 'active', 'ended'])
  assert.deepEqual(SUBSCRIPTION_ASSIGNMENT_SOURCES, ['system', 'admin', 'billing_provider'])
  assert.equal(SUBSCRIPTION_LIMIT_UNLIMITED, 'unlimited')
})

test('every approved plan defines the complete feature and limit contract', () => {
  assert.deepEqual(Object.keys(PLAN_DEFINITIONS), expectedPlanIds)

  for (const planId of expectedPlanIds) {
    const plan = PLAN_DEFINITIONS[planId]

    assert.equal(plan.id, planId)
    assert.equal(plan.revision, 1)
    assert.deepEqual(Object.keys(plan.features).sort(), featureKeys)
    assert.deepEqual(Object.keys(plan.limits).sort(), limitKeys)

    for (const value of Object.values(plan.features)) {
      assert.equal(typeof value, 'boolean')
    }

    for (const value of Object.values(plan.limits)) {
      assert.equal(
        value === SUBSCRIPTION_LIMIT_UNLIMITED ||
          (Number.isInteger(value) && value >= 0),
        true,
      )
    }
  }
})

test('early access and pro are distinct plans with equal Pro-level entitlements', () => {
  const earlyAccess = PLAN_DEFINITIONS[PLAN_IDS.EARLY_ACCESS]
  const pro = PLAN_DEFINITIONS[PLAN_IDS.PRO]

  assert.notEqual(earlyAccess.id, pro.id)
  assert.notStrictEqual(earlyAccess, pro)
  assert.notStrictEqual(earlyAccess.features, pro.features)
  assert.notStrictEqual(earlyAccess.limits, pro.limits)
  assert.deepEqual(earlyAccess.features, pro.features)
  assert.deepEqual(earlyAccess.limits, pro.limits)
  assert.equal(earlyAccess.limits.insightHistoryDays, 365)
  assert.equal(
    earlyAccess.limits.translatedMessagesPerMonth,
    SUBSCRIPTION_LIMIT_UNLIMITED,
  )
  assert.equal(earlyAccess.limits.additionalManagers, 5)

  const subscriptionFor = (planId) => ({
    schemaVersion: 1,
    planId,
    planRevision: 1,
    accessStatus: 'active',
    assignmentSource: 'system',
  })
  const effectiveEarlyAccess = resolveBusinessEntitlements(
    subscriptionFor(PLAN_IDS.EARLY_ACCESS),
  )
  const effectivePro = resolveBusinessEntitlements(subscriptionFor(PLAN_IDS.PRO))

  assert.notEqual(effectiveEarlyAccess.effectivePlanId, effectivePro.effectivePlanId)
  assert.deepEqual(effectiveEarlyAccess.features, effectivePro.features)
  assert.deepEqual(effectiveEarlyAccess.limits, effectivePro.limits)
})

test('starter and growth retain their approved feature and limit definitions', () => {
  assert.deepEqual(PLAN_DEFINITIONS[PLAN_IDS.STARTER].limits, {
    galleryImages: 4,
    categoryIds: 3,
    serviceAreas: 5,
    languages: 20,
    insightHistoryDays: 30,
    translatedMessagesPerMonth: 50,
    additionalManagers: 1,
  })
  assert.deepEqual(PLAN_DEFINITIONS[PLAN_IDS.GROWTH].limits, {
    galleryImages: 8,
    categoryIds: 10,
    serviceAreas: 20,
    languages: 20,
    insightHistoryDays: 90,
    translatedMessagesPerMonth: 500,
    additionalManagers: 3,
  })
  assert.equal(PLAN_DEFINITIONS[PLAN_IDS.STARTER].features.advancedInsights, false)
  assert.equal(PLAN_DEFINITIONS[PLAN_IDS.STARTER].features.enhancedProfile, false)
  assert.equal(PLAN_DEFINITIONS[PLAN_IDS.GROWTH].features.advancedInsights, true)
  assert.equal(PLAN_DEFINITIONS[PLAN_IDS.GROWTH].features.prioritySupport, false)
})

test('commercial plan limits remain within defensive document bounds', () => {
  for (const plan of Object.values(PLAN_DEFINITIONS)) {
    assert.equal(plan.limits.galleryImages <= DEFAULT_ARRAY_BOUNDS.galleryImages, true)
    assert.equal(plan.limits.categoryIds <= DEFAULT_ARRAY_BOUNDS.categoryIds, true)
    assert.equal(plan.limits.serviceAreas <= DEFAULT_ARRAY_BOUNDS.serviceAreas, true)
    assert.equal(plan.limits.languages <= DEFAULT_ARRAY_BOUNDS.languages, true)
    assert.equal(
      plan.limits.additionalManagers + 1 <= DEFAULT_ARRAY_BOUNDS.managerIds,
      true,
    )
  }
})

test('plan definitions contain no prices or billing-provider identifiers', () => {
  const serialized = JSON.stringify(PLAN_DEFINITIONS)

  for (const forbidden of [
    'price',
    'currency',
    'stripe',
    'customerId',
    'subscriptionId',
    'priceId',
    'billingInterval',
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden)
  }
})

test('catalogue objects are immutable', () => {
  assert.equal(Object.isFrozen(PLAN_DEFINITIONS), true)

  for (const plan of Object.values(PLAN_DEFINITIONS)) {
    assert.equal(Object.isFrozen(plan), true)
    assert.equal(Object.isFrozen(plan.features), true)
    assert.equal(Object.isFrozen(plan.limits), true)
  }
})


test('early access state builder creates the canonical trusted shape', () => {
  const timestamp = { seconds: 123, nanoseconds: 0 }
  const state = buildEarlyAccessSubscriptionState({
    timestamp,
    updatedBy: 'admin-uid',
  })

  assert.deepEqual(state, {
    schemaVersion: 1,
    planId: 'early_access',
    planRevision: 1,
    accessStatus: 'active',
    assignmentSource: 'system',
    assignedAt: timestamp,
    startsAt: timestamp,
    endsAt: null,
    updatedAt: timestamp,
    updatedBy: 'admin-uid',
  })
})

test('canonical subscriptions normalize without fallback issues', () => {
  const raw = {
    schemaVersion: 1,
    planId: 'growth',
    planRevision: 1,
    accessStatus: 'active',
    assignmentSource: 'admin',
    assignedAt: { seconds: 1 },
    startsAt: { seconds: 1 },
    endsAt: null,
    updatedAt: { seconds: 2 },
    updatedBy: 'admin-uid',
  }
  const normalized = normalizeBusinessSubscription(raw)

  assert.equal(normalized.source, 'canonical')
  assert.equal(normalized.fallbackReason, null)
  assert.deepEqual(normalized.issues, [])
  assert.deepEqual(normalized.subscription, raw)
  assert.equal(Object.isFrozen(normalized), true)
  assert.equal(Object.isFrozen(normalized.subscription), true)
})

test('legacy nested free tier maps to early access without promoting legacy premium fields', () => {
  const normalized = normalizeBusinessSubscription({
    tier: 'free',
    status: 'none',
    isPremium: true,
    subscriptionTier: 'paid',
  })

  assert.equal(normalized.source, 'legacy_compatibility')
  assert.equal(normalized.subscription.planId, 'early_access')
  assert.equal(normalized.subscription.accessStatus, 'active')
  assert.deepEqual(
    normalized.issues.map(({ code }) => code),
    [ISSUE_CODES.SUBSCRIPTION_LEGACY_TIER],
  )
})

test('missing malformed and unknown subscriptions fail safely', () => {
  const cases = [
    [null, ISSUE_CODES.SUBSCRIPTION_MISSING, SUBSCRIPTION_FALLBACK_REASONS.MISSING],
    ['free', ISSUE_CODES.SUBSCRIPTION_INVALID_STRUCTURE, SUBSCRIPTION_FALLBACK_REASONS.INVALID_STRUCTURE],
    [{ schemaVersion: 99 }, ISSUE_CODES.SUBSCRIPTION_UNSUPPORTED_SCHEMA_VERSION, SUBSCRIPTION_FALLBACK_REASONS.UNSUPPORTED_SCHEMA_VERSION],
    [{
      schemaVersion: 1,
      planId: 'enterprise',
      planRevision: 1,
      accessStatus: 'active',
      assignmentSource: 'admin',
    }, ISSUE_CODES.SUBSCRIPTION_UNKNOWN_PLAN, SUBSCRIPTION_FALLBACK_REASONS.UNKNOWN_PLAN],
    [{
      schemaVersion: 1,
      planId: 'starter',
      planRevision: 99,
      accessStatus: 'active',
      assignmentSource: 'admin',
    }, ISSUE_CODES.SUBSCRIPTION_UNKNOWN_PLAN_REVISION, SUBSCRIPTION_FALLBACK_REASONS.UNKNOWN_PLAN_REVISION],
    [{
      schemaVersion: 1,
      planId: 'starter',
      planRevision: 1,
      accessStatus: 'paused',
      assignmentSource: 'admin',
    }, ISSUE_CODES.SUBSCRIPTION_INVALID_ACCESS_STATUS, SUBSCRIPTION_FALLBACK_REASONS.INVALID_ACCESS_STATUS],
    [{
      schemaVersion: 1,
      planId: 'starter',
      planRevision: 1,
      accessStatus: 'active',
      assignmentSource: 'moderator',
    }, ISSUE_CODES.SUBSCRIPTION_INVALID_ASSIGNMENT_SOURCE, SUBSCRIPTION_FALLBACK_REASONS.INVALID_ASSIGNMENT_SOURCE],
  ]

  for (const [raw, issueCode, fallbackReason] of cases) {
    const normalized = normalizeBusinessSubscription(raw)

    assert.equal(normalized.subscription, null)
    assert.equal(normalized.source, 'fallback')
    assert.equal(normalized.fallbackReason, fallbackReason)
    assert.equal(normalized.issues[0].code, issueCode)
  }
})

test('early access baseline prevents current feature and limit loss', () => {
  const resolved = resolveBusinessEntitlements({
    schemaVersion: 1,
    planId: 'starter',
    planRevision: 1,
    accessStatus: 'active',
    assignmentSource: 'admin',
  })

  assert.equal(resolved.assignedPlanId, 'starter')
  assert.equal(resolved.effectivePlanId, 'starter')
  assert.equal(resolved.baselineApplied, true)
  assert.equal(resolved.features.contactActionBreakdown, true)
  assert.equal(resolved.features.enhancedProfile, true)
  assert.equal(resolved.limits.galleryImages, 8)
  assert.equal(resolved.limits.categoryIds, 30)
  assert.equal(resolved.limits.translatedMessagesPerMonth, SUBSCRIPTION_LIMIT_UNLIMITED)
})

test('inactive or malformed subscriptions resolve to early access during early access', () => {
  const inactive = resolveBusinessEntitlements({
    schemaVersion: 1,
    planId: 'pro',
    planRevision: 1,
    accessStatus: 'ended',
    assignmentSource: 'billing_provider',
  })
  const malformed = resolveBusinessEntitlements({ planId: 'pro' })

  for (const resolved of [inactive, malformed]) {
    assert.equal(resolved.effectivePlanId, 'early_access')
    assert.equal(resolved.resolutionSource, 'fallback')
    assert.equal(resolved.baselineApplied, true)
    assert.equal(resolved.features.publicListing, true)
    assert.equal(resolved.limits.galleryImages, 8)
  }

  assert.equal(
    inactive.fallbackReason,
    SUBSCRIPTION_FALLBACK_REASONS.NOT_ACTIVE,
  )
  assert.equal(
    malformed.fallbackReason,
    SUBSCRIPTION_FALLBACK_REASONS.UNSUPPORTED_SCHEMA_VERSION,
  )
})

test('baseline can be disabled for future post-early-access enforcement', () => {
  const resolved = resolveBusinessEntitlements({
    schemaVersion: 1,
    planId: 'starter',
    planRevision: 1,
    accessStatus: 'ended',
    assignmentSource: 'admin',
  }, { earlyAccessBaseline: false })

  assert.equal(resolved.effectivePlanId, null)
  assert.equal(resolved.baselineApplied, false)
  assert.equal(resolved.features.publicListing, false)
  assert.equal(resolved.limits.galleryImages, 0)
})

test('feature and limit helpers reject unknown entitlement keys', () => {
  const resolved = resolveBusinessEntitlements(
    buildEarlyAccessSubscriptionState(),
  )

  assert.equal(
    hasBusinessEntitlement(resolved, ENTITLEMENT_FEATURE_KEYS.BUSINESS_INSIGHTS),
    true,
  )
  assert.equal(hasBusinessEntitlement(resolved, 'unknownFeature'), false)
  assert.equal(
    businessEntitlementLimit(resolved, ENTITLEMENT_LIMIT_KEYS.GALLERY_IMAGES),
    8,
  )
  assert.equal(businessEntitlementLimit(resolved, 'unknownLimit'), null)
})

test('authoritative subscription resolution is private-first and never revives legacy state', () => {
  const legacy = buildEarlyAccessSubscriptionState()
  const privateGrowth = { ...legacy, planId: 'growth', planRevision: PLAN_DEFINITIONS.growth.revision, assignmentSource: 'admin' }
  const resolved = resolveAuthoritativeBusinessEntitlements(privateGrowth, legacy)
  assert.equal(resolved.effectivePlanId, 'growth')
  assert.equal(resolved.authoritySource, 'private_authoritative')

  const malformed = resolveAuthoritativeBusinessSubscription(
    { schemaVersion: 1, planId: 'invalid' },
    privateGrowth,
    { privateRecordExists: true },
  )
  assert.equal(malformed.authoritySource, 'malformed_fallback')
  assert.equal(malformed.normalized.subscription, null)
})

test('authoritative subscription resolution uses legacy only while private state is absent', () => {
  const legacy = { tier: 'free' }
  const resolved = resolveAuthoritativeBusinessEntitlements(null, legacy, { privateRecordExists: false })
  assert.equal(resolved.effectivePlanId, 'early_access')
  assert.equal(resolved.authoritySource, 'legacy_fallback')
  assert.equal(resolved.isLegacyFallback, true)
})
