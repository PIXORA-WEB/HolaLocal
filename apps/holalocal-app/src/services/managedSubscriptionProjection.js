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

export function isRecoverableSubscriptionProjectionError(error) {
  return RECOVERABLE_CODES.has(normalizedCode(error))
}

export async function loadManagedBusinessSubscription({ loadManagedBusiness, loadSubscription }) {
  const managed = await loadManagedBusiness()
  if (!managed) return null
  try {
    const projection = await loadSubscription(managed.businessId)
    return {
      ...managed,
      entitlements: { ...managed.entitlements, ...projection },
    }
  } catch (error) {
    if (isRecoverableSubscriptionProjectionError(error)) return managed
    throw error
  }
}
