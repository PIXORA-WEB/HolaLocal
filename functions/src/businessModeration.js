import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { isPublicBusinessEligible } from '@holalocal/firebase-contract'

const OPERATIONS = Object.freeze({
  publish: Object.freeze({ from: 'pending_review', to: 'active' }),
  reject: Object.freeze({ from: 'pending_review', to: 'rejected' }),
  suspend: Object.freeze({ from: 'active', to: 'suspended' }),
  restore: Object.freeze({ from: 'suspended', to: 'active' }),
  archive: Object.freeze({ from: 'active', to: 'archived' }),
})

function isTrustedModerator(claims = {}) {
  return claims.moderator === true || claims.admin === true
}

function requireValidUid(uid) {
  if (typeof uid !== 'string' || !uid.trim() || uid.includes('/')) {
    throw new HttpsError('unauthenticated', 'auth-required')
  }
  return uid.trim()
}

function safeBusinessId(value) {
  if (typeof value !== 'string' || !value.trim() || value.includes('/')) {
    throw new HttpsError('invalid-argument', 'invalid-business-id')
  }
  return value.trim()
}

function assertTransition({ operation, business }) {
  const transition = OPERATIONS[operation]
  if (!transition) throw new HttpsError('invalid-argument', 'invalid-moderation-operation')
  if (business.status === 'deleted') throw new HttpsError('failed-precondition', 'deleted-business-terminal')
  if (business.status !== transition.from) {
    throw new HttpsError('failed-precondition', 'invalid-business-status-transition')
  }
  return transition
}

export async function moderateBusiness({ uid, claims, businessId, operation, db }) {
  requireValidUid(uid)
  if (!isTrustedModerator(claims)) throw new HttpsError('permission-denied', 'moderator-claim-required')
  const safeId = safeBusinessId(businessId)
  const businessRef = db.doc(`businesses/${safeId}`)
  let nextStatus

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(businessRef)
    if (!snapshot.exists) throw new HttpsError('not-found', 'business-not-found')
    const business = snapshot.data()
    const transition = assertTransition({ operation, business })
    const update = {
      status: transition.to,
      updatedAt: FieldValue.serverTimestamp(),
    }

    if (transition.to === 'active') {
      update.publishedAt = FieldValue.serverTimestamp()
      if (!isPublicBusinessEligible({ ...business, ...update, publishedAt: new Date() })) {
        throw new HttpsError('failed-precondition', 'business-publication-ineligible')
      }
    }

    transaction.update(businessRef, update)
    nextStatus = transition.to
  })

  return { ok: true, businessId: safeId, status: nextStatus }
}
