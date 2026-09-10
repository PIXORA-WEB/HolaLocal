// Command/read boundary only. No provider, SDK, persistence or feature activation.
export const CUSTOMER_REVIEW_REJECTION_REASONS = Object.freeze([
  'spam', 'abusive_content', 'personal_information', 'irrelevant_content', 'conflict_of_interest',
])
export function requireCustomerReviewRejectionReason(value) {
  if (typeof value !== 'string' || !CUSTOMER_REVIEW_REJECTION_REASONS.includes(value)) {
    const error = new Error('invalid-rejection-reason'); error.code = error.message; throw error
  }
  return value
}
export function authorCustomerReviewRejection(state) {
  // Legacy rejected slots have no public guidance. Never derive it from private audit notes.
  if (state.status !== 'rejected' || state.rejection == null) return null
  const value = state.rejection
  if (typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join() !== 'reasonCode,revision'
    || value.revision !== state.revisionCount) throw new Error('inconsistent-review-rejection')
  return { revision: value.revision, reasonCode: requireCustomerReviewRejectionReason(value.reasonCode) }
}
