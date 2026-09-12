import { Timestamp } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'

export function requireRetentionAdmin(actorUid, claims) {
  if (typeof actorUid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(actorUid) || claims?.admin !== true) {
    throw new HttpsError('permission-denied', 'admin-required')
  }
}

export function retentionText(value) {
  if (typeof value !== 'string' || value.trim().length < 3 || value.length > 500) throw new HttpsError('invalid-argument', 'invalid-retention-description')
  return value.trim()
}

export function validRetentionDecision(value) {
  return value != null && ['held', 'released'].includes(value.state)
    && Number.isSafeInteger(value.revision) && value.revision > 0
    && typeof value.reason === 'string' && value.reason.length >= 3
    && typeof value.reviewerId === 'string' && value.reviewerId.length > 0
    && typeof value.endingCondition === 'string' && value.endingCondition.length >= 3
    && value.reviewAt instanceof Timestamp && value.recordedAt instanceof Timestamp
    && (value.state !== 'released' || (value.releasedAt instanceof Timestamp && typeof value.releaseReason === 'string' && value.releaseReason.length >= 3))
}

// A review date is a reminder, never an expiry of a preservation requirement.
export function retentionReviewStatus(value, now = Timestamp.now()) {
  if (!validRetentionDecision(value)) return 'needs-assessment'
  if (value.state === 'released') return 'released'
  return value.reviewAt.toMillis() <= now.toMillis() ? 'overdue' : 'held'
}

export function initialDeletionEvidenceRetention({ reviewerId, now }) {
  return { state: 'held', revision: 1, reviewerId, reason: 'Verify the already-authorised account erasure',
    endingCondition: 'Erasure verification and any necessary backup reconciliation are complete',
    reviewAt: now, recordedAt: now }
}

export function nextRetentionDecision({ previous, expectedRevision, actorUid, action, reason, endingCondition, reviewAt, now = Timestamp.now() }) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision !== (previous?.revision ?? 0)) {
    throw new HttpsError('aborted', 'stale-retention-decision')
  }
  if (!(now instanceof Timestamp)) throw new HttpsError('invalid-argument', 'invalid-retention-time')
  if (action === 'hold') {
    if (!(reviewAt instanceof Timestamp) || reviewAt.toMillis() <= now.toMillis()) throw new HttpsError('invalid-argument', 'future-review-date-required')
    return { state: 'held', revision: expectedRevision + 1, reviewerId: actorUid, reason: retentionText(reason),
      endingCondition: retentionText(endingCondition), reviewAt, recordedAt: now }
  }
  if (action === 'release' && validRetentionDecision(previous) && previous.state === 'held') {
    return { ...previous, state: 'released', revision: expectedRevision + 1, reviewerId: actorUid,
      releasedAt: now, releaseReason: retentionText(reason) }
  }
  throw new HttpsError('failed-precondition', 'retention-assessment-required')
}
