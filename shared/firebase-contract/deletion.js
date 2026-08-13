export const ACCOUNT_DELETION_REQUEST_STATES = Object.freeze([
  'requested', 'finalizing', 'failed_retryable', 'completed', 'cancelled',
])

export const ACCOUNT_DELETION_REVERSIBLE_STATES = Object.freeze(['requested'])

export const ACCOUNT_DELETION_FINALIZATION_CHECKPOINTS = Object.freeze([
  'ownership_verified',
  'manager_relationships_cleaned',
  'conversations_tombstoned',
  'profile_media_cleaned',
  'user_evidence_minimized',
  'firebase_auth_removed',
  'completed',
])

export const ACCOUNT_DELETION_FAILURE_CODES = Object.freeze([
  'ownership_blocked',
  'ownership_integrity_conflict',
  'manager_relationship_integrity_conflict',
  'conversation_integrity_conflict',
  'profile_media_cleanup_failed',
  'consent_evidence_invalid',
  'user_evidence_minimization_failed',
  'firebase_auth_deletion_failed',
  'workflow_state_conflict',
  'internal_retryable',
])

export const ACCOUNT_DELETION_FINALIZER_LEASE_SECONDS = 10 * 60

// This is an authentication-security window, not a deletion grace period.
export const ACCOUNT_DELETION_RECENT_AUTH_MAX_AGE_SECONDS = 5 * 60

const TRANSITIONS = Object.freeze({
  requested: Object.freeze(['finalizing', 'cancelled']),
  finalizing: Object.freeze(['failed_retryable', 'completed']),
  failed_retryable: Object.freeze(['finalizing']),
  completed: Object.freeze([]),
  cancelled: Object.freeze([]),
})

const WORKFLOW_FIELDS = new Set([
  'uid', 'state', 'requestedAt', 'requestedBy', 'cancelledAt', 'updatedAt', 'requestVersion',
  'finalizationStartedAt', 'finalizedBy', 'completedAt', 'lastCompletedStep', 'failureCode',
  'retryCount', 'leaseId', 'leaseExpiresAt', 'cleanupCounts', 'retainedConsentEvidence',
])

export function isAccountDeletionRequestState(value) {
  return ACCOUNT_DELETION_REQUEST_STATES.includes(value)
}

export function isAccountDeletionFinalizationCheckpoint(value) {
  return ACCOUNT_DELETION_FINALIZATION_CHECKPOINTS.includes(value)
}

export function isAccountDeletionFailureCode(value) {
  return ACCOUNT_DELETION_FAILURE_CODES.includes(value)
}

export function canTransitionAccountDeletionState(from, to) {
  return isAccountDeletionRequestState(from)
    && isAccountDeletionRequestState(to)
    && TRANSITIONS[from].includes(to)
}

export function isCancellableAccountDeletionRequest(value) {
  return value?.state === 'requested'
}

export function nextAccountDeletionCheckpoint(current, candidate) {
  const nextIndex = current == null
    ? 0
    : ACCOUNT_DELETION_FINALIZATION_CHECKPOINTS.indexOf(current) + 1
  return ACCOUNT_DELETION_FINALIZATION_CHECKPOINTS[nextIndex] === candidate
}

export function hasReachedAccountDeletionCheckpoint(current, candidate) {
  const currentIndex = ACCOUNT_DELETION_FINALIZATION_CHECKPOINTS.indexOf(current)
  const candidateIndex = ACCOUNT_DELETION_FINALIZATION_CHECKPOINTS.indexOf(candidate)
  return currentIndex >= 0 && candidateIndex >= 0 && currentIndex >= candidateIndex
}

export function hasOnlyAccountDeletionWorkflowFields(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every((key) => WORKFLOW_FIELDS.has(key))
}

export function isSanitizedAccountDeletionCleanupCounts(value) {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false
  const allowed = new Set(['attempted', 'deleted', 'alreadyMissing', 'failed', 'managerRelationshipsRemoved', 'conversationsTombstoned'])
  return Object.keys(value).length > 0 && Object.entries(value).every(([key, count]) => (
    allowed.has(key) && Number.isSafeInteger(count) && count >= 0
  ))
}

export function projectAccountDeletionRequest(value) {
  if (!value || !isAccountDeletionRequestState(value.state)) return null
  return Object.freeze({
    state: value.state,
    requestedAt: value.requestedAt ?? null,
    cancelledAt: value.cancelledAt ?? null,
    requestVersion: Number.isSafeInteger(value.requestVersion) && value.requestVersion >= 1
      ? value.requestVersion
      : null,
  })
}
