import { PLAN_ID_VALUES, SUBSCRIPTION_ACCESS_STATUSES } from '@holalocal/firebase-contract'

const RECOVERABLE_CODES = new Set([
  'unavailable',
  'internal',
  'deadline-exceeded',
  'resource-exhausted',
  'unknown',
])

function normalizedCode(error) {
  return String(error?.code ?? '').replace(/^functions\//, '')
}

export function safeSubscriptionPlanId(value, fallback = 'early_access') {
  return PLAN_ID_VALUES.includes(value) ? value : fallback
}

export function safeSubscriptionAccessStatus(value, fallback = 'active') {
  return SUBSCRIPTION_ACCESS_STATUSES.includes(value) ? value : fallback
}

export function isRecoverableOwnerSubscriptionError(error) {
  return RECOVERABLE_CODES.has(normalizedCode(error))
}

export async function loadOwnerSubscriptionProjection(loadProjection) {
  try {
    return { projection: await loadProjection(), unavailable: false }
  } catch (error) {
    if (isRecoverableOwnerSubscriptionError(error)) {
      return { projection: null, unavailable: true }
    }
    throw error
  }
}
