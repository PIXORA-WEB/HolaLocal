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

export const REJECTION_REASON_CODES = Object.freeze([
  'incomplete_profile',
  'unclear_service_information',
  'location_or_service_area',
  'contact_information',
  'logo_or_gallery',
  'unsupported_or_inappropriate_content',
  'other',
])

const MIN_GUIDANCE_LENGTH = 20
const MAX_GUIDANCE_LENGTH = 2000

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

function safeRequestId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(value)) {
    throw new HttpsError('invalid-argument', 'invalid-request-id')
  }
  return value
}

function rejectionInput(operation, reasonCode, guidance) {
  if (operation !== 'reject') return { reasonCode: null, guidance: null }
  const safeReasonCode = typeof reasonCode === 'string' ? reasonCode.trim() : ''
  const safeGuidance = typeof guidance === 'string' ? guidance.trim() : ''
  if (!REJECTION_REASON_CODES.includes(safeReasonCode)) {
    throw new HttpsError('invalid-argument', 'invalid-rejection-reason')
  }
  if (safeGuidance.length < MIN_GUIDANCE_LENGTH || safeGuidance.length > MAX_GUIDANCE_LENGTH) {
    throw new HttpsError('invalid-argument', 'invalid-rejection-guidance')
  }
  return { reasonCode: safeReasonCode, guidance: safeGuidance }
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

export async function moderateBusiness({
  uid, claims, businessId, operation, reasonCode, guidance, requestId, db,
}) {
  const moderatorUid = requireValidUid(uid)
  if (!isTrustedModerator(claims)) throw new HttpsError('permission-denied', 'moderator-claim-required')
  const safeId = safeBusinessId(businessId)
  const safeIdempotencyKey = safeRequestId(requestId)
  const rejection = rejectionInput(operation, reasonCode, guidance)
  const businessRef = db.doc(`businesses/${safeId}`)
  const privateRef = db.doc(`businessPrivate/${safeId}`)
  const eventRef = db.doc(`businesses/${safeId}/moderationEvents/${safeIdempotencyKey}`)
  let nextStatus

  await db.runTransaction(async (transaction) => {
    const [snapshot, privateSnapshot, eventSnapshot] = await Promise.all([
      transaction.get(businessRef),
      transaction.get(privateRef),
      transaction.get(eventRef),
    ])
    if (eventSnapshot.exists) {
      const event = eventSnapshot.data()
      const payloadMatches = event.businessId === safeId
        && event.moderatorUid === moderatorUid
        && event.action === operation
        && (event.reasonCode ?? null) === rejection.reasonCode
        && (event.guidance ?? null) === rejection.guidance
      if (payloadMatches) {
        nextStatus = event.newStatus
        return
      }
      throw new HttpsError('already-exists', 'moderation-request-id-conflict')
    }
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
    if (operation === 'reject') {
      transaction.set(privateRef, {
        ownerId: business.ownerId,
        managerIds: business.managerIds,
        ...(!privateSnapshot.exists ? {
          contact: business.contact,
          createdAt: FieldValue.serverTimestamp(),
        } : {}),
        currentRejection: {
          reasonCode: rejection.reasonCode,
          guidance: rejection.guidance,
          createdAt: FieldValue.serverTimestamp(),
          moderationEventId: safeIdempotencyKey,
        },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true })
    }
    transaction.set(eventRef, {
      businessId: safeId,
      action: operation,
      previousStatus: business.status,
      newStatus: transition.to,
      moderatorUid,
      reasonCode: rejection.reasonCode,
      guidance: rejection.guidance,
      createdAt: FieldValue.serverTimestamp(),
      requestId: safeIdempotencyKey,
      schemaVersion: 1,
    })
    nextStatus = transition.to
  })

  return { ok: true, businessId: safeId, status: nextStatus, requestId: safeIdempotencyKey }
}
