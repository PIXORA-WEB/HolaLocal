import { ISSUE_CODES, issue } from './issues.js'

export const SUBSCRIPTION_SCHEMA_VERSION = 1
export const PLAN_CATALOGUE_VERSION = 1
export const SUBSCRIPTION_LIMIT_UNLIMITED = 'unlimited'

export const PLAN_IDS = Object.freeze({
  EARLY_ACCESS: 'early_access',
  STARTER: 'starter',
  GROWTH: 'growth',
  PRO: 'pro',
})

export const PLAN_ID_VALUES = Object.freeze(Object.values(PLAN_IDS))

export const SUBSCRIPTION_ACCESS_STATUSES = Object.freeze([
  'scheduled',
  'active',
  'ended',
])

export const SUBSCRIPTION_ASSIGNMENT_SOURCES = Object.freeze([
  'system',
  'admin',
  'billing_provider',
])

export const SUBSCRIPTION_RESOLUTION_SOURCES = Object.freeze([
  'canonical',
  'legacy_compatibility',
  'fallback',
])

export const SUBSCRIPTION_FALLBACK_REASONS = Object.freeze({
  MISSING: 'subscription_missing',
  INVALID_STRUCTURE: 'subscription_invalid_structure',
  UNSUPPORTED_SCHEMA_VERSION: 'subscription_unsupported_schema_version',
  UNKNOWN_PLAN: 'subscription_unknown_plan',
  UNKNOWN_PLAN_REVISION: 'subscription_unknown_plan_revision',
  INVALID_ACCESS_STATUS: 'subscription_invalid_access_status',
  INVALID_ASSIGNMENT_SOURCE: 'subscription_invalid_assignment_source',
  NOT_ACTIVE: 'subscription_not_active',
})

export const ENTITLEMENT_FEATURE_KEYS = Object.freeze({
  PUBLIC_LISTING: 'publicListing',
  PRIVATE_MESSAGING: 'privateMessaging',
  BUSINESS_INSIGHTS: 'businessInsights',
  ADVANCED_INSIGHTS: 'advancedInsights',
  CONTACT_ACTION_BREAKDOWN: 'contactActionBreakdown',
  MESSAGE_TRANSLATION: 'messageTranslation',
  ENHANCED_PROFILE: 'enhancedProfile',
  DATA_EXPORT: 'dataExport',
  ENHANCED_DIRECTORY_VISIBILITY: 'enhancedDirectoryVisibility',
  PRIORITY_DIRECTORY_VISIBILITY: 'priorityDirectoryVisibility',
  PRIORITY_SUPPORT: 'prioritySupport',
})

export const ENTITLEMENT_LIMIT_KEYS = Object.freeze({
  GALLERY_IMAGES: 'galleryImages',
  CATEGORY_IDS: 'categoryIds',
  SERVICE_AREAS: 'serviceAreas',
  LANGUAGES: 'languages',
  INSIGHT_HISTORY_DAYS: 'insightHistoryDays',
  TRANSLATED_MESSAGES_PER_MONTH: 'translatedMessagesPerMonth',
  ADDITIONAL_MANAGERS: 'additionalManagers',
})

function freezePlan({ id, revision = 1, features, limits }) {
  return Object.freeze({
    id,
    revision,
    features: Object.freeze({ ...features }),
    limits: Object.freeze({ ...limits }),
  })
}

const PRO_LEVEL_FEATURES = Object.freeze({
  publicListing: true,
  privateMessaging: true,
  businessInsights: true,
  advancedInsights: true,
  contactActionBreakdown: true,
  messageTranslation: true,
  enhancedProfile: true,
  dataExport: true,
  enhancedDirectoryVisibility: true,
  priorityDirectoryVisibility: true,
  prioritySupport: true,
})

const PRO_LEVEL_LIMITS = Object.freeze({
  galleryImages: 8,
  categoryIds: 30,
  serviceAreas: 50,
  languages: 20,
  insightHistoryDays: 365,
  translatedMessagesPerMonth: SUBSCRIPTION_LIMIT_UNLIMITED,
  additionalManagers: 5,
})

export const PLAN_DEFINITIONS = Object.freeze({
  [PLAN_IDS.EARLY_ACCESS]: freezePlan({
    id: PLAN_IDS.EARLY_ACCESS,
    features: PRO_LEVEL_FEATURES,
    limits: PRO_LEVEL_LIMITS,
  }),

  [PLAN_IDS.STARTER]: freezePlan({
    id: PLAN_IDS.STARTER,
    features: {
      publicListing: true,
      privateMessaging: true,
      businessInsights: true,
      advancedInsights: false,
      contactActionBreakdown: false,
      messageTranslation: true,
      enhancedProfile: false,
      dataExport: false,
      enhancedDirectoryVisibility: false,
      priorityDirectoryVisibility: false,
      prioritySupport: false,
    },
    limits: {
      galleryImages: 4,
      categoryIds: 3,
      serviceAreas: 5,
      languages: 20,
      insightHistoryDays: 30,
      translatedMessagesPerMonth: 50,
      additionalManagers: 1,
    },
  }),

  [PLAN_IDS.GROWTH]: freezePlan({
    id: PLAN_IDS.GROWTH,
    features: {
      publicListing: true,
      privateMessaging: true,
      businessInsights: true,
      advancedInsights: true,
      contactActionBreakdown: true,
      messageTranslation: true,
      enhancedProfile: true,
      dataExport: false,
      enhancedDirectoryVisibility: true,
      priorityDirectoryVisibility: false,
      prioritySupport: false,
    },
    limits: {
      galleryImages: 8,
      categoryIds: 10,
      serviceAreas: 20,
      languages: 20,
      insightHistoryDays: 90,
      translatedMessagesPerMonth: 500,
      additionalManagers: 3,
    },
  }),

  [PLAN_IDS.PRO]: freezePlan({
    id: PLAN_IDS.PRO,
    features: PRO_LEVEL_FEATURES,
    limits: PRO_LEVEL_LIMITS,
  }),
})

const FEATURE_KEYS = Object.freeze(Object.values(ENTITLEMENT_FEATURE_KEYS))
const LIMIT_KEYS = Object.freeze(Object.values(ENTITLEMENT_LIMIT_KEYS))

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function frozenIssues(values) {
  return Object.freeze(values.map((value) => Object.freeze({ ...value })))
}

function normalizationResult({ subscription = null, source, fallbackReason = null, issues = [] }) {
  return Object.freeze({
    subscription,
    source,
    fallbackReason,
    issues: frozenIssues(issues),
  })
}

function invalidSubscription(code, fallbackReason, details = {}) {
  return normalizationResult({
    source: 'fallback',
    fallbackReason,
    issues: [issue(code, details)],
  })
}

function normalizedSubscription(rawSubscription) {
  return Object.freeze({
    schemaVersion: rawSubscription.schemaVersion,
    planId: rawSubscription.planId,
    planRevision: rawSubscription.planRevision,
    accessStatus: rawSubscription.accessStatus,
    assignmentSource: rawSubscription.assignmentSource,
    assignedAt: rawSubscription.assignedAt ?? null,
    startsAt: rawSubscription.startsAt ?? null,
    endsAt: rawSubscription.endsAt ?? null,
    updatedAt: rawSubscription.updatedAt ?? null,
    updatedBy: typeof rawSubscription.updatedBy === 'string'
      ? rawSubscription.updatedBy
      : null,
  })
}

export function buildEarlyAccessSubscriptionState({
  timestamp = null,
  updatedBy = 'system',
} = {}) {
  return {
    schemaVersion: SUBSCRIPTION_SCHEMA_VERSION,
    planId: PLAN_IDS.EARLY_ACCESS,
    planRevision: PLAN_DEFINITIONS[PLAN_IDS.EARLY_ACCESS].revision,
    accessStatus: 'active',
    assignmentSource: 'system',
    assignedAt: timestamp,
    startsAt: timestamp,
    endsAt: null,
    updatedAt: timestamp,
    updatedBy,
  }
}

export function normalizeBusinessSubscription(rawSubscription) {
  if (rawSubscription == null) {
    return invalidSubscription(
      ISSUE_CODES.SUBSCRIPTION_MISSING,
      SUBSCRIPTION_FALLBACK_REASONS.MISSING,
    )
  }

  if (!isPlainObject(rawSubscription)) {
    return invalidSubscription(
      ISSUE_CODES.SUBSCRIPTION_INVALID_STRUCTURE,
      SUBSCRIPTION_FALLBACK_REASONS.INVALID_STRUCTURE,
    )
  }

  if (rawSubscription.schemaVersion == null && rawSubscription.tier === 'free') {
    return normalizationResult({
      subscription: Object.freeze(buildEarlyAccessSubscriptionState()),
      source: 'legacy_compatibility',
      issues: [issue(ISSUE_CODES.SUBSCRIPTION_LEGACY_TIER, {
        legacyTier: 'free',
      })],
    })
  }

  if (rawSubscription.schemaVersion !== SUBSCRIPTION_SCHEMA_VERSION) {
    return invalidSubscription(
      ISSUE_CODES.SUBSCRIPTION_UNSUPPORTED_SCHEMA_VERSION,
      SUBSCRIPTION_FALLBACK_REASONS.UNSUPPORTED_SCHEMA_VERSION,
      { actual: rawSubscription.schemaVersion ?? null },
    )
  }

  const plan = PLAN_DEFINITIONS[rawSubscription.planId]
  if (!plan) {
    return invalidSubscription(
      ISSUE_CODES.SUBSCRIPTION_UNKNOWN_PLAN,
      SUBSCRIPTION_FALLBACK_REASONS.UNKNOWN_PLAN,
      { planId: rawSubscription.planId ?? null },
    )
  }

  if (rawSubscription.planRevision !== plan.revision) {
    return invalidSubscription(
      ISSUE_CODES.SUBSCRIPTION_UNKNOWN_PLAN_REVISION,
      SUBSCRIPTION_FALLBACK_REASONS.UNKNOWN_PLAN_REVISION,
      {
        planId: plan.id,
        actual: rawSubscription.planRevision ?? null,
        expected: plan.revision,
      },
    )
  }

  if (!SUBSCRIPTION_ACCESS_STATUSES.includes(rawSubscription.accessStatus)) {
    return invalidSubscription(
      ISSUE_CODES.SUBSCRIPTION_INVALID_ACCESS_STATUS,
      SUBSCRIPTION_FALLBACK_REASONS.INVALID_ACCESS_STATUS,
      { actual: rawSubscription.accessStatus ?? null },
    )
  }

  if (!SUBSCRIPTION_ASSIGNMENT_SOURCES.includes(rawSubscription.assignmentSource)) {
    return invalidSubscription(
      ISSUE_CODES.SUBSCRIPTION_INVALID_ASSIGNMENT_SOURCE,
      SUBSCRIPTION_FALLBACK_REASONS.INVALID_ASSIGNMENT_SOURCE,
      { actual: rawSubscription.assignmentSource ?? null },
    )
  }

  return normalizationResult({
    subscription: normalizedSubscription(rawSubscription),
    source: 'canonical',
  })
}

// A private document, once present, is authoritative even when malformed. This
// prevents an invalid trusted record from silently reviving a legacy public
// assignment. Legacy data is consulted only while no private record exists.
export function resolveAuthoritativeBusinessSubscription(
  privateSubscription,
  legacySubscription,
  { privateRecordExists = privateSubscription != null } = {},
) {
  const rawSubscription = privateRecordExists ? privateSubscription : legacySubscription
  const normalized = normalizeBusinessSubscription(rawSubscription)
  return Object.freeze({
    rawSubscription,
    normalized,
    authoritySource: privateRecordExists
      ? normalized.source === 'fallback' ? 'malformed_fallback' : 'private_authoritative'
      : normalized.source === 'fallback'
        ? 'early_access_fallback'
        : 'legacy_fallback',
    isPrivateAuthoritative: privateRecordExists,
    isLegacyFallback: !privateRecordExists && normalized.source !== 'fallback',
    isMalformed: normalized.source === 'fallback',
  })
}

export function resolveAuthoritativeBusinessEntitlements(
  privateSubscription,
  legacySubscription,
  options = {},
) {
  const authority = resolveAuthoritativeBusinessSubscription(
    privateSubscription,
    legacySubscription,
    options,
  )
  return Object.freeze({
    ...resolveBusinessEntitlements(authority.rawSubscription),
    authoritySource: authority.authoritySource,
    isPrivateAuthoritative: authority.isPrivateAuthoritative,
    isLegacyFallback: authority.isLegacyFallback,
    isMalformed: authority.isMalformed,
  })
}

function emptyFeatures() {
  return Object.fromEntries(FEATURE_KEYS.map((key) => [key, false]))
}

function emptyLimits() {
  return Object.fromEntries(LIMIT_KEYS.map((key) => [key, 0]))
}

function mergeLimit(primary, baseline) {
  if (
    primary === SUBSCRIPTION_LIMIT_UNLIMITED ||
    baseline === SUBSCRIPTION_LIMIT_UNLIMITED
  ) return SUBSCRIPTION_LIMIT_UNLIMITED
  return Math.max(primary, baseline)
}

function entitlementsForPlan(plan, baseline = null) {
  const features = baseline
    ? Object.fromEntries(FEATURE_KEYS.map((key) => [
        key,
        plan.features[key] === true || baseline.features[key] === true,
      ]))
    : { ...plan.features }

  const limits = baseline
    ? Object.fromEntries(LIMIT_KEYS.map((key) => [
        key,
        mergeLimit(plan.limits[key], baseline.limits[key]),
      ]))
    : { ...plan.limits }

  return {
    features: Object.freeze(features),
    limits: Object.freeze(limits),
  }
}

export function resolveBusinessEntitlements(
  rawSubscription,
  { earlyAccessBaseline = true } = {},
) {
  const normalized = normalizeBusinessSubscription(rawSubscription)
  const assignedPlan = normalized.subscription
    ? PLAN_DEFINITIONS[normalized.subscription.planId]
    : null
  const assignedActive = normalized.subscription?.accessStatus === 'active'
  const earlyAccessPlan = PLAN_DEFINITIONS[PLAN_IDS.EARLY_ACCESS]

  let effectivePlan = null
  let resolutionSource = normalized.source
  let fallbackReason = normalized.fallbackReason
  let baselineApplied = false
  let entitlements

  if (assignedPlan && assignedActive) {
    effectivePlan = assignedPlan
    const applyBaseline = earlyAccessBaseline && assignedPlan.id !== PLAN_IDS.EARLY_ACCESS
    entitlements = entitlementsForPlan(
      assignedPlan,
      applyBaseline ? earlyAccessPlan : null,
    )
    baselineApplied = applyBaseline
  } else if (earlyAccessBaseline) {
    effectivePlan = earlyAccessPlan
    entitlements = entitlementsForPlan(earlyAccessPlan)
    resolutionSource = 'fallback'
    fallbackReason ??= SUBSCRIPTION_FALLBACK_REASONS.NOT_ACTIVE
    baselineApplied = true
  } else {
    entitlements = {
      features: Object.freeze(emptyFeatures()),
      limits: Object.freeze(emptyLimits()),
    }
    resolutionSource = 'fallback'
    fallbackReason ??= SUBSCRIPTION_FALLBACK_REASONS.NOT_ACTIVE
  }

  return Object.freeze({
    catalogueVersion: PLAN_CATALOGUE_VERSION,
    assignedPlanId: assignedPlan?.id ?? null,
    assignedPlanRevision: assignedPlan?.revision ?? null,
    effectivePlanId: effectivePlan?.id ?? null,
    effectivePlanRevision: effectivePlan?.revision ?? null,
    accessStatus: normalized.subscription?.accessStatus ?? null,
    assignmentSource: normalized.subscription?.assignmentSource ?? null,
    resolutionSource,
    fallbackReason,
    baselineApplied,
    features: entitlements.features,
    limits: entitlements.limits,
    issues: normalized.issues,
  })
}

export function hasBusinessEntitlement(resolvedEntitlements, featureKey) {
  return FEATURE_KEYS.includes(featureKey)
    && resolvedEntitlements?.features?.[featureKey] === true
}

export function businessEntitlementLimit(resolvedEntitlements, limitKey) {
  if (!LIMIT_KEYS.includes(limitKey)) return null
  const value = resolvedEntitlements?.limits?.[limitKey]
  return value === SUBSCRIPTION_LIMIT_UNLIMITED || Number.isInteger(value)
    ? value
    : null
}
