import { HttpsError } from 'firebase-functions/v2/https'
import { resolveAuthoritativeBusinessEntitlements } from '@holalocal/firebase-contract'

function safeBusinessId(value) {
  if (typeof value !== 'string' || !value.trim() || value.includes('/') || value.length > 128) {
    throw new HttpsError('invalid-argument', 'invalid-business-id')
  }
  return value.trim()
}

export async function getOwnerSubscriptionStatus({ uid, businessId, db }) {
  const safeId = safeBusinessId(businessId)
  const business = await db.doc(`businesses/${safeId}`).get()
  if (!business.exists) throw new HttpsError('not-found', 'business-not-found')
  const businessData = business.data()
  const managers = Array.isArray(businessData.managerIds) ? businessData.managerIds : []
  if (businessData.ownerId !== uid && !managers.includes(uid)) {
    throw new HttpsError('permission-denied', 'business-management-required')
  }
  const subscription = await db.doc(`businessSubscriptions/${safeId}`).get()
  const resolved = resolveAuthoritativeBusinessEntitlements(
    subscription.exists ? subscription.data() : null,
    businessData.subscription,
    { privateRecordExists: subscription.exists },
  )
  return {
    businessId: safeId,
    effectivePlanId: resolved.effectivePlanId,
    effectivePlanRevision: resolved.effectivePlanRevision,
    accessStatus: resolved.accessStatus,
    sourceType: resolved.authoritySource,
    fallbackReason: resolved.fallbackReason,
    features: resolved.features,
    limits: resolved.limits,
  }
}
