// Approved launch limits. Called inside the same transaction as the accepted operation.
export const CUSTOMER_REVIEW_WINDOW_MS = 24 * 60 * 60 * 1000
export function createRollingCustomerReviewQuota(limit, kind) {
  if (![5, 10].includes(limit) || !['review', 'report'].includes(kind)) throw new Error('invalid-quota-policy')
  return Object.freeze({reserve({current, now}) {
    const invalid = () => { throw new Error(`invalid-${kind}-quota`) }
    if (!Number.isSafeInteger(now) || now < 0) invalid()
    const times = current == null ? [] : current.acceptedAt
    if (current != null && (current.schemaVersion !== 1 || Object.keys(current).sort().join() !== 'acceptedAt,schemaVersion')) invalid()
    if (!Array.isArray(times) || times.length > limit || times.some((t, i) => !Number.isSafeInteger(t) || t < 0 || t > now || (i > 0 && t < times[i - 1]))) invalid()
    const acceptedAt = times.filter(t => t > now - CUSTOMER_REVIEW_WINDOW_MS)
    if (acceptedAt.length >= limit) throw new Error(`${kind}-quota-exceeded`)
    return {schemaVersion: 1, acceptedAt: [...acceptedAt, now]}
  }})
}
export const customerReviewQuotaPolicy = createRollingCustomerReviewQuota(5, 'review')
export const customerReviewReportQuotaPolicy = createRollingCustomerReviewQuota(10, 'report')
