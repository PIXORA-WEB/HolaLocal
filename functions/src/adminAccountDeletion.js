import { HttpsError } from 'firebase-functions/v2/https'
import {
  ACCOUNT_DELETION_FAILURE_CODES,
  ACCOUNT_DELETION_REQUEST_STATES,
  isSanitizedAccountDeletionCleanupCounts,
} from '@holalocal/firebase-contract'
import { getAccountDeletionFinalizationEligibility } from './accountDeletionPrimitives.js'

const OPERATIONAL_STATES = new Set(['requested', 'finalizing', 'failed_retryable'])
const HISTORY_STATES = new Set(['completed', 'cancelled'])
export const ADMIN_DELETION_OPERATIONAL_STATE_LIMIT = 100
export const ADMIN_DELETION_HISTORY_STATE_LIMIT = 25

function requireAdmin(adminUid, claims) {
  if (typeof adminUid !== 'string' || !adminUid || claims?.admin !== true) {
    throw new HttpsError('permission-denied', 'admin-required')
  }
}

function timestampIso(value) {
  const millis = value?.toMillis?.()
  return Number.isFinite(millis) ? new Date(millis).toISOString() : null
}

export function projectAdminAccountDeletionRequest(uid, request, now) {
  const state = ACCOUNT_DELETION_REQUEST_STATES.includes(request?.state) ? request.state : null
  if (!state) return null
  const failureCode = ACCOUNT_DELETION_FAILURE_CODES.includes(request.failureCode)
    ? request.failureCode
    : null
  const cleanupCounts = isSanitizedAccountDeletionCleanupCounts(request.cleanupCounts)
    ? { ...request.cleanupCounts }
    : null
  const eligibility = getAccountDeletionFinalizationEligibility(request, now)
  return Object.freeze({
    uid,
    state,
    requestedAt: timestampIso(request.requestedAt),
    updatedAt: timestampIso(request.updatedAt),
    requestVersion: Number.isSafeInteger(request.requestVersion) ? request.requestVersion : null,
    lastCompletedStep: typeof request.lastCompletedStep === 'string' ? request.lastCompletedStep : null,
    failureCode,
    cleanupCounts,
    canFinalize: eligibility.canFinalize,
    actionReason: eligibility.actionReason,
  })
}

export async function listAdminAccountDeletionRequests({ adminUid, claims, includeHistory = false, db }) {
  requireAdmin(adminUid, claims)
  if (typeof includeHistory !== 'boolean') throw new HttpsError('invalid-argument', 'invalid-history-filter')

  const queryStates = async (states, perStateLimit) => {
    const snapshots = await Promise.all([...states].map((state) => db.collection('accountDeletionRequests')
      .where('state', '==', state)
      .limit(perStateLimit + 1)
      .get()))
    const hasMore = snapshots.some((snapshot) => snapshot.size > perStateLimit)
    const requests = snapshots.flatMap((snapshot) => snapshot.docs.slice(0, perStateLimit))
      .map((document) => projectAdminAccountDeletionRequest(document.id, document.data()))
      .filter(Boolean)
      .sort((left, right) => {
        const time = String(left.requestedAt ?? '').localeCompare(String(right.requestedAt ?? ''))
        return time || left.uid.localeCompare(right.uid)
      })
    return { requests, hasMore }
  }

  // Operational and terminal states have independent budgets, so history can never
  // hide a live workflow. State-only queries use automatic single-field indexes.
  const operational = await queryStates(OPERATIONAL_STATES, ADMIN_DELETION_OPERATIONAL_STATE_LIMIT)
  const history = includeHistory
    ? await queryStates(HISTORY_STATES, ADMIN_DELETION_HISTORY_STATE_LIMIT)
    : { requests: [], hasMore: false }
  return Object.freeze({
    requests: [...operational.requests, ...history.requests],
    hasMore: operational.hasMore || history.hasMore,
    operationalHasMore: operational.hasMore,
    historyHasMore: history.hasMore,
  })
}
