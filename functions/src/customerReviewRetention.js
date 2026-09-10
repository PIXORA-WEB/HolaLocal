import { info } from 'firebase-functions/logger'
import { Timestamp } from 'firebase-admin/firestore'
export const CUSTOMER_REVIEW_REPORT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000
const collections = ['customerReviewReports', 'customerReviewReportRequests', 'customerReviewReportAudits']
// Expiry is server-written at resolution, including the submit receipt/audit. Open reports never expire.
// Fixed work per run. Each deletion rereads expiry transactionally, protecting a concurrent new report.
export async function sweepResolvedCustomerReviewReports({db, now = Date.now(), pageSize = 50}) {
  if (!Number.isSafeInteger(now) || now < 0 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('invalid-retention-options')
  const cutoff = Timestamp.fromMillis(now)
  let deleted = 0, pageLimitReached = false
  for (const collection of collections) {
    const candidates = await db.collection(collection).where('expiresAt', '<=', cutoff).orderBy('expiresAt').limit(pageSize).get()
    pageLimitReached ||= candidates.size === pageSize
    for (const candidate of candidates.docs) {
      deleted += await db.runTransaction(async tx => {
        const current = await tx.get(candidate.ref)
        if (!current.exists) return 0
        const row = current.data()
        if (!(row.expiresAt instanceof Timestamp) || row.expiresAt.toMillis() > now) return 0
        if (collection === 'customerReviewReports' && !['resolved', 'dismissed'].includes(row.status)) return 0
        tx.delete(current.ref)
        return 1
      })
    }
  }
  return {deleted, pageLimitReached}
}
// Deliberately off until the coordinated Firebase deployment is approved.
export async function runCustomerReviewRetention({env = process.env, createDatabase, now = Date.now()}) {
  if (env.CUSTOMER_REVIEW_RETENTION_ENABLED !== 'true') return {disabled: true}
  const result = await sweepResolvedCustomerReviewReports({db: createDatabase(), now})
  info('customer-review-retention', result) // Counts only; never report IDs, identities, details or notes.
  return result
}
