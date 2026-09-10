import { info } from 'firebase-functions/logger'
import { Timestamp, FieldPath } from 'firebase-admin/firestore'
export const CUSTOMER_REVIEW_REPORT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000
const collections = ['customerReviewReports', 'customerReviewReportRequests', 'customerReviewReportAudits']
// Expiry is server-written at resolution, including the submit receipt/audit. Open reports never expire.
// Fixed work per run. Each deletion rereads expiry transactionally, protecting a concurrent new report.
export async function sweepResolvedCustomerReviewReports({db, now = Date.now(), pageSize = 50}) {
  if (!Number.isSafeInteger(now) || now < 0 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('invalid-retention-options')
  const cutoff = Timestamp.fromMillis(now)
  let deleted = 0, pageLimitReached = false, failedRecords = 0, failedCollections = 0
  const stateRef = db.doc('maintenanceProgress/customerReviewRetention')
  const state = (await stateRef.get()).data() ?? {}
  const start = Number.isInteger(state.nextCollection) && state.nextCollection >= 0 ? state.nextCollection % collections.length : 0
  for (let offset=0;offset<collections.length;offset++) {
    const collection=collections[(start+offset)%collections.length]
    await stateRef.set({nextCollection:(start+offset+1)%collections.length},{merge:true})
    let candidates
    try {
      let query = db.collection(collection).where('expiresAt', '<=', cutoff).orderBy('expiresAt').orderBy(FieldPath.documentId())
      const cursor = state[collection]
      if (cursor?.expiresAt instanceof Timestamp && typeof cursor.documentId === 'string') query = query.startAfter(cursor.expiresAt, cursor.documentId)
      candidates = await query.limit(pageSize).get()
    } catch { failedCollections++; continue }
    pageLimitReached ||= candidates.size === pageSize
    for (const candidate of candidates.docs) {
      // Persist progress before work: a process timeout cannot pin the queue to this record.
      await stateRef.set({[collection]:{expiresAt:candidate.data().expiresAt,documentId:candidate.id}},{merge:true})
      try {
        deleted += await db.runTransaction(async tx => {
          const current = await tx.get(candidate.ref)
          if (!current.exists) return 0
          const row = current.data()
          if (!(row.expiresAt instanceof Timestamp) || row.expiresAt.toMillis() > now) return 0
          if (collection === 'customerReviewReports' && !['resolved', 'dismissed'].includes(row.status)) return 0
          tx.delete(current.ref)
          return 1
        })
      } catch { failedRecords++ }
    }
    const last = candidates.docs.at(-1)
    // Advance even past failed records. Short/end pages reset; failed records retry next cycle.
    await stateRef.set({[collection]:candidates.size === pageSize && last ? {expiresAt:last.data().expiresAt,documentId:last.id}:null}, {merge:true})
  }
  return {deleted, pageLimitReached, failedRecords, failedCollections}
}
// Deliberately off until the coordinated Firebase deployment is approved.
export async function runCustomerReviewRetention({env = process.env, createDatabase, now = Date.now()}) {
  if (env.CUSTOMER_REVIEW_RETENTION_ENABLED !== 'true') return {disabled: true}
  const result = await sweepResolvedCustomerReviewReports({db: createDatabase(), now})
  info('customer-review-retention', result) // Counts only; never report IDs, identities, details or notes.
  return result
}
