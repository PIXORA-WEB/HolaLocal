// Opt-in customer-review contracts. No persistence, SDK imports or feature activation.
export const CUSTOMER_REVIEW_SCHEMA_VERSION = 1
export const CUSTOMER_REVIEW_TEXT_BOUNDS = Object.freeze({ min: 20, max: 2000 })
export const CUSTOMER_REVIEW_STATUSES = Object.freeze(['empty', 'pending', 'published', 'rejected', 'withdrawn', 'removed'])
export const CUSTOMER_REVIEW_SUBMISSION_FIELDS = Object.freeze(['rating', 'originalText', 'declaredSourceLanguage'])
export const CUSTOMER_REVIEW_PUBLIC_FIELDS = Object.freeze(['publicReviewId', 'businessId', 'publishedRevision', 'rating', 'originalText', 'declaredSourceLanguage'])

export class CustomerReviewError extends Error {
  constructor(code) { super(code); this.name = 'CustomerReviewError'; this.code = code }
}
export function customerReviewAssert(condition, code) {
  if (!condition) throw new CustomerReviewError(code)
}
export function isCustomerReviewRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value))
}
export function isCustomerReviewId(value) {
  // Firestore document segment, preserving exact identity (no trim/normalization).
  return typeof value === 'string' && value.length > 0 && !/[\/\u0000-\u001f\u007f\uD800-\uDFFF]/u.test(value)
    && value !== '.' && value !== '..' && !/^__.*__$/s.test(value)
    && new TextEncoder().encode(value).length <= 1500
}
export function isCustomerReviewLanguage(value) {
  // Source languages are not limited to website target languages. null means unknown.
  return value === null || (typeof value === 'string' && value.length <= 63
    && /^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/i.test(value))
}
export function customerReviewCodePointLength(text) {
  customerReviewAssert(typeof text === 'string' && !/[\uD800-\uDFFF]/u.test(text), 'invalid-text')
  return [...text].length
}
export function validateCustomerReviewSubmission(payload, bounds = CUSTOMER_REVIEW_TEXT_BOUNDS) {
  customerReviewAssert(isCustomerReviewRecord(bounds) && Number.isSafeInteger(bounds.min)
    && Number.isSafeInteger(bounds.max) && bounds.min >= 1 && bounds.max >= bounds.min, 'invalid-text-bounds')
  const issues = []
  if (!isCustomerReviewRecord(payload)) return { valid: false, value: null, issues: ['invalid-payload'] }
  if (Object.keys(payload).some(key => !CUSTOMER_REVIEW_SUBMISSION_FIELDS.includes(key))) issues.push('unsupported-field')
  if (!Number.isInteger(payload.rating) || payload.rating < 1 || payload.rating > 5) issues.push('invalid-rating')
  let originalText = null
  if (typeof payload.originalText !== 'string' || /[\uD800-\uDFFF]/u.test(payload.originalText)) issues.push('invalid-text')
  else {
    originalText = payload.originalText.trim().normalize('NFC')
    const length = customerReviewCodePointLength(originalText)
    if (length < bounds.min || length > bounds.max) issues.push('text-length')
  }
  const language = payload.declaredSourceLanguage === undefined ? null : payload.declaredSourceLanguage
  if (!isCustomerReviewLanguage(language)) issues.push('invalid-source-language')
  return {
    valid: issues.length === 0,
    value: issues.length ? null : Object.freeze({ rating: payload.rating, originalText, declaredSourceLanguage: language }),
    issues,
  }
}
export function customerReviewSlotKey(businessId, authorUid) {
  customerReviewAssert(isCustomerReviewId(businessId) && isCustomerReviewId(authorUid), 'invalid-slot-identity')
  // Length framing is unambiguous, deterministic and slash-free. This is PRIVATE, not an opaque public ID.
  return `customerReviewSlot:v1:${businessId.length}:${businessId}:${authorUid.length}:${authorUid}`
}
export function createCustomerReviewSlot({ businessId, authorUid, publicReviewId }) {
  customerReviewSlotKey(businessId, authorUid)
  customerReviewAssert(isCustomerReviewId(publicReviewId) && publicReviewId.length >= 16
    && publicReviewId !== authorUid && publicReviewId !== businessId, 'invalid-public-review-id')
  // Randomness/uniqueness of this independently allocated public ID is a later trusted-server responsibility.
  return Object.freeze({ schemaVersion: 1, businessId, authorUid, publicReviewId, version: 0,
    status: 'empty', revisions: Object.freeze([]), pendingRevision: null, publishedRevision: null })
}
export function assertCustomerReviewSlot(slot) {
  customerReviewAssert(isCustomerReviewRecord(slot), 'invalid-slot')
  customerReviewAssert(slot.schemaVersion === 1 && isCustomerReviewId(slot.businessId)
    && isCustomerReviewId(slot.authorUid) && isCustomerReviewId(slot.publicReviewId)
    && slot.publicReviewId.length >= 16 && slot.publicReviewId !== slot.authorUid
    && slot.publicReviewId !== slot.businessId, 'invalid-slot-identity')
  customerReviewAssert(Number.isSafeInteger(slot.version) && slot.version >= 0
    && CUSTOMER_REVIEW_STATUSES.includes(slot.status) && Array.isArray(slot.revisions), 'invalid-slot-state')
  slot.revisions.forEach((revision, index) => {
    customerReviewAssert(isCustomerReviewRecord(revision) && revision.revision === index + 1, 'invalid-revision')
    const result = validateCustomerReviewSubmission({ rating: revision.rating, originalText: revision.originalText,
      declaredSourceLanguage: revision.declaredSourceLanguage }, { min: 1, max: Number.MAX_SAFE_INTEGER })
    customerReviewAssert(result.valid && result.value.originalText === revision.originalText
      && revision.declaredSourceLanguage !== undefined, 'invalid-revision')
  })
  const last = slot.revisions.length
  const pointer = value => value === null || (Number.isSafeInteger(value) && value >= 1 && value <= last)
  customerReviewAssert(pointer(slot.pendingRevision) && pointer(slot.publishedRevision)
    && slot.version >= last, 'invalid-revision-pointer')
  const hasPublished = slot.publishedRevision !== null
  const valid = slot.status === 'empty' ? last === 0 && slot.version === 0 && slot.pendingRevision === null && !hasPublished
    : last > 0 && slot.version > 0 && (slot.status === 'pending'
      ? slot.pendingRevision === last && (!hasPublished || slot.publishedRevision < last)
      : slot.pendingRevision === null && (slot.status === 'published' ? slot.publishedRevision === last
        : slot.status === 'rejected' ? !hasPublished || slot.publishedRevision < last
          : !hasPublished))
  customerReviewAssert(valid, 'inconsistent-review-state')
  return slot
}
export function projectPublishedCustomerReview(slot) {
  assertCustomerReviewSlot(slot)
  if (slot.publishedRevision === null) return null
  const revision = slot.revisions[slot.publishedRevision - 1]
  // Explicit allowlist, never spread private slot/revision objects.
  return Object.freeze({ publicReviewId: slot.publicReviewId, businessId: slot.businessId,
    publishedRevision: revision.revision, rating: revision.rating, originalText: revision.originalText,
    declaredSourceLanguage: revision.declaredSourceLanguage })
}
