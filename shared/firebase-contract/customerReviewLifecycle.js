import { isPublicBusinessEligible } from './publication.js'
import {
  assertCustomerReviewSlot, customerReviewAssert, isCustomerReviewId, isCustomerReviewRecord,
  validateCustomerReviewSubmission, CUSTOMER_REVIEW_TEXT_BOUNDS,
} from './customerReviewContracts.js'

export const CUSTOMER_REVIEW_TRANSITIONS = Object.freeze({
  submit: Object.freeze(['empty', 'published', 'rejected', 'withdrawn']),
  approve: Object.freeze(['pending']), reject: Object.freeze(['pending']),
  withdraw: Object.freeze(['pending', 'published', 'rejected']),
  remove: Object.freeze(['pending', 'published', 'rejected']),
})

// All inputs must later come from trusted server reads/claims. This is a decision model only.
export function evaluateCustomerReviewEligibility({ identity, account, business } = {}) {
  if (!isCustomerReviewId(identity?.uid)) return { eligible: false, reason: 'authentication-required' }
  if (identity.emailVerified !== true) return { eligible: false, reason: 'verified-email-required' }
  if (!account || account.uid !== identity.uid || account.accountStatus !== 'active'
    || account.deletionRequestedAt != null) return { eligible: false, reason: 'active-account-required' }
  if (!Array.isArray(account.roles) || !account.roles.includes('customer')) return { eligible: false, reason: 'customer-role-required' }
  if (business?.ownerId === identity.uid || (Array.isArray(business?.managerIds) && business.managerIds.includes(identity.uid))) return { eligible: false, reason: 'self-review-forbidden' }
  if (!isPublicBusinessEligible(business)) return { eligible: false, reason: 'public-business-required' }
  return { eligible: true, reason: null }
}
export function isCustomerReviewAdmin(actor) {
  return isCustomerReviewId(actor?.uid) && actor.admin === true
}
export function transitionCustomerReview(slot, {
  action, expectedVersion, submission, actor, authorIdentity, authorAccount, business,
} = {}, bounds = CUSTOMER_REVIEW_TEXT_BOUNDS) {
  assertCustomerReviewSlot(slot)
  customerReviewAssert(Number.isSafeInteger(expectedVersion) && expectedVersion === slot.version, 'review-version-conflict')
  customerReviewAssert(Object.hasOwn(CUSTOMER_REVIEW_TRANSITIONS, action ?? '')
    && CUSTOMER_REVIEW_TRANSITIONS[action].includes(slot.status), 'invalid-review-transition')
  if (['approve', 'reject', 'remove'].includes(action)) customerReviewAssert(isCustomerReviewAdmin(actor), 'admin-required')
  else customerReviewAssert(isCustomerReviewId(actor?.uid) && actor.uid === slot.authorUid, 'author-required')
  if (action === 'submit' || action === 'approve') {
    customerReviewAssert(authorIdentity?.uid === slot.authorUid && business?.businessId === slot.businessId, 'review-context-mismatch')
    const eligibility = evaluateCustomerReviewEligibility({ identity: authorIdentity, account: authorAccount, business })
    customerReviewAssert(eligibility.eligible, eligibility.reason)
  }
  customerReviewAssert(slot.version < Number.MAX_SAFE_INTEGER, 'version-overflow')
  // Copy before freezing: do not mutate or freeze caller-owned input.
  const revisions = slot.revisions.map(revision => Object.freeze({
    revision: revision.revision, rating: revision.rating, originalText: revision.originalText,
    declaredSourceLanguage: revision.declaredSourceLanguage,
  }))
  let pendingRevision = slot.pendingRevision
  let publishedRevision = slot.publishedRevision
  let status
  if (action === 'submit') {
    const result = validateCustomerReviewSubmission(submission, bounds)
    customerReviewAssert(result.valid, result.issues[0])
    pendingRevision = revisions.length + 1
    revisions.push(Object.freeze({ revision: pendingRevision, ...result.value }))
    status = 'pending'
  } else if (action === 'approve') {
    publishedRevision = pendingRevision; pendingRevision = null; status = 'published'
  } else if (action === 'reject') {
    pendingRevision = null; status = 'rejected'
  } else {
    pendingRevision = null; publishedRevision = null
    status = action === 'withdraw' ? 'withdrawn' : 'removed'
  }
  const next = { schemaVersion: slot.schemaVersion, businessId: slot.businessId, authorUid: slot.authorUid,
    publicReviewId: slot.publicReviewId, version: slot.version + 1, status,
    revisions: Object.freeze(revisions), pendingRevision, publishedRevision }
  assertCustomerReviewSlot(next)
  return Object.freeze(next)
}

export function customerReviewRatingContribution(slot) {
  assertCustomerReviewSlot(slot)
  return Object.freeze(slot.publishedRevision === null ? { sum: 0, count: 0 }
    : { sum: slot.revisions[slot.publishedRevision - 1].rating, count: 1 })
}
export function customerReviewRatingDelta(before, after) {
  const oldContribution = customerReviewRatingContribution(before)
  const nextContribution = customerReviewRatingContribution(after)
  customerReviewAssert(before.businessId === after.businessId && before.authorUid === after.authorUid
    && before.publicReviewId === after.publicReviewId, 'review-identity-mismatch')
  return Object.freeze({ sum: nextContribution.sum - oldContribution.sum, count: nextContribution.count - oldContribution.count })
}
export function assertCustomerReviewAggregate(aggregate) {
  customerReviewAssert(isCustomerReviewRecord(aggregate), 'invalid-review-aggregate')
  const { sum, count } = aggregate
  customerReviewAssert(Number.isSafeInteger(sum) && Number.isSafeInteger(count)
    && count >= 0 && sum >= 0 && (count === 0 ? sum === 0 : sum >= count && sum / count <= 5), 'invalid-review-aggregate')
  return { sum, count }
}
export function applyCustomerReviewRatingDelta(aggregate, delta) {
  const current = assertCustomerReviewAggregate(aggregate)
  customerReviewAssert(delta && Number.isSafeInteger(delta.sum) && Number.isSafeInteger(delta.count)
    && (delta.count === 1 ? delta.sum >= 1 && delta.sum <= 5
      : delta.count === -1 ? delta.sum <= -1 && delta.sum >= -5
        : delta.count === 0 && Math.abs(delta.sum) <= 4), 'invalid-review-delta')
  const next = assertCustomerReviewAggregate({ sum: current.sum + delta.sum, count: current.count + delta.count })
  return Object.freeze(next)
}
export function customerReviewRatingAverage(aggregate) {
  const { sum, count } = assertCustomerReviewAggregate(aggregate)
  return count === 0 ? null : sum / count
}
