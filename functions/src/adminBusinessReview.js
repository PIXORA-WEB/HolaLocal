import { HttpsError } from 'firebase-functions/v2/https'
import { loadSubscriptionProjection } from './subscriptionPlanAssignment.js'

const HISTORY_LIMIT = 10

function isTrustedModerator(claims = {}) {
  return claims.moderator === true || claims.admin === true
}

function safeBusinessId(value) {
  if (typeof value !== 'string' || !value.trim() || value.includes('/')) {
    throw new HttpsError('invalid-argument', 'invalid-business-id')
  }
  return value.trim()
}

function timestampValue(value) {
  return typeof value?.toDate === 'function' ? value.toDate().toISOString() : value ?? null
}

function serialize(value) {
  if (Array.isArray(value)) return value.map(serialize)
  if (value && typeof value === 'object') {
    if (typeof value.toDate === 'function') return timestampValue(value)
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]))
  }
  return value
}

export async function getAdminBusinessReview({ uid, claims, businessId, db }) {
  if (typeof uid !== 'string' || !uid.trim()) throw new HttpsError('unauthenticated', 'auth-required')
  if (!isTrustedModerator(claims)) throw new HttpsError('permission-denied', 'moderator-claim-required')
  const safeId = safeBusinessId(businessId)
  const businessRef = db.doc(`businesses/${safeId}`)
  const privateRef = db.doc(`businessPrivate/${safeId}`)
  const [businessSnapshot, privateSnapshot, historySnapshot] = await Promise.all([
    businessRef.get(),
    privateRef.get(),
    businessRef.collection('moderationEvents').orderBy('createdAt', 'desc').limit(HISTORY_LIMIT).get(),
  ])
  if (!businessSnapshot.exists) throw new HttpsError('not-found', 'business-not-found')
  const business = businessSnapshot.data()
  const [ownerSnapshot, subscription] = await Promise.all([
    db.doc(`users/${business.ownerId}`).get(),
    loadSubscriptionProjection({
      businessId: safeId, legacyRecord: business.subscription, claims, db,
    }),
  ])
  const owner = ownerSnapshot.exists ? ownerSnapshot.data() : {}
  const managedBusiness = { ...business }
  delete managedBusiness.subscription

  return serialize({
    business: { businessId: safeId, ...managedBusiness },
    subscription,
    privateModeration: {
      currentRejection: privateSnapshot.exists
        ? privateSnapshot.data().currentRejection ?? null
        : null,
    },
    owner: {
      uid: business.ownerId,
      displayName: owner.displayName ?? '',
      email: owner.email ?? '',
      preferredLocale: owner.preferredLocale ?? '',
    },
    history: historySnapshot.docs.map((snapshot) => ({
      eventId: snapshot.id,
      ...snapshot.data(),
    })),
  })
}
