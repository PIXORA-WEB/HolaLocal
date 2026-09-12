import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ACCOUNT_DELETION_RECENT_AUTH_MAX_AGE_SECONDS,
  ACCOUNT_DELETION_FAILURE_CODES,
  ACCOUNT_DELETION_FINALIZATION_CHECKPOINTS,
  ACCOUNT_DELETION_FINALIZER_LEASE_SECONDS,
  ACCOUNT_DELETION_REQUEST_CONTRACT,
  ACCOUNT_DELETION_REQUEST_STATES,
  canStartNewAccountDeletionRequestCycle,
  canTransitionAccountDeletionState,
  hasOnlyAccountDeletionWorkflowFields,
  hasReachedAccountDeletionCheckpoint,
  nextAccountDeletionCheckpoint,
  isSanitizedAccountDeletionCleanupCounts,
  isCancellableAccountDeletionRequest,
  isFreshAccountDeletionRequestCycle,
  projectAccountDeletionRequest,
} from '../index.js'

test('account deletion contract is trusted, minimal, and has a centralized recent-auth window', () => {
  assert.equal(ACCOUNT_DELETION_REQUEST_CONTRACT.path, 'accountDeletionRequests/{uid}')
  assert.equal(ACCOUNT_DELETION_RECENT_AUTH_MAX_AGE_SECONDS, 300)
  assert.deepEqual(Object.keys(ACCOUNT_DELETION_REQUEST_CONTRACT.fields), [
    'uid', 'state', 'requestedAt', 'requestedBy', 'cancelledAt', 'finalizationStartedAt',
    'finalizedBy', 'completedAt', 'lastCompletedStep', 'failureCode', 'retryCount', 'leaseId',
    'leaseExpiresAt', 'cleanupCounts', 'retainedConsentEvidence', 'updatedAt', 'requestVersion',
  ])
  assert.ok(Object.values(ACCOUNT_DELETION_REQUEST_CONTRACT.fields)
    .every((field) => field.access === 'trusted_only'))
  assert.ok(ACCOUNT_DELETION_REQUEST_STATES.includes('requested'))
  assert.ok(ACCOUNT_DELETION_REQUEST_STATES.includes('cancelled'))
})

test('finalization workflow states, checkpoints, failures and transitions are strict', () => {
  assert.deepEqual(ACCOUNT_DELETION_REQUEST_STATES, [
    'requested', 'finalizing', 'failed_retryable', 'completed', 'cancelled',
  ])
  assert.equal(ACCOUNT_DELETION_FINALIZER_LEASE_SECONDS, 600)
  assert.equal(canTransitionAccountDeletionState('requested', 'finalizing'), true)
  assert.equal(canTransitionAccountDeletionState('requested', 'cancelled'), true)
  assert.equal(canTransitionAccountDeletionState('finalizing', 'requested'), false)
  assert.equal(canTransitionAccountDeletionState('completed', 'finalizing'), false)
  assert.equal(nextAccountDeletionCheckpoint(null, 'ownership_verified'), true)
  assert.equal(nextAccountDeletionCheckpoint('ownership_verified', 'conversations_tombstoned'), false)
  assert.equal(hasReachedAccountDeletionCheckpoint('profile_media_cleaned', 'ownership_verified'), true)
  assert.equal(hasReachedAccountDeletionCheckpoint('ownership_verified', 'profile_media_cleaned'), false)
  assert.ok(ACCOUNT_DELETION_FINALIZATION_CHECKPOINTS.includes('firebase_auth_removed'))
  assert.ok(ACCOUNT_DELETION_FAILURE_CODES.includes('consent_evidence_invalid'))
  assert.equal(hasOnlyAccountDeletionWorkflowFields({ uid: 'u', state: 'requested' }), true)
  assert.equal(hasOnlyAccountDeletionWorkflowFields({ uid: 'u', email: 'private' }), false)
  assert.equal(hasOnlyAccountDeletionWorkflowFields({ uid: 'u', arbitraryNote: 'x' }), false)
  assert.equal(isSanitizedAccountDeletionCleanupCounts({ attempted: 2, deleted: 2 }), true)
  assert.equal(isSanitizedAccountDeletionCleanupCounts({ attempted: -1 }), false)
  assert.equal(isSanitizedAccountDeletionCleanupCounts({ filename: 1 }), false)
})

test('only a requested account deletion is cancellable', () => {
  assert.equal(isCancellableAccountDeletionRequest({ state: 'requested' }), true)
  assert.equal(isCancellableAccountDeletionRequest({ state: 'cancelled' }), false)
  assert.equal(isCancellableAccountDeletionRequest({ state: 'finalizing' }), false)
})

test('new account deletion cycles are distinct from terminal same-cycle transitions', () => {
  assert.equal(canTransitionAccountDeletionState('requested', 'cancelled'), true)
  assert.equal(canTransitionAccountDeletionState('cancelled', 'requested'), false)
  assert.equal(canStartNewAccountDeletionRequestCycle(null), true)
  assert.equal(canStartNewAccountDeletionRequestCycle({ state: 'cancelled' }), true)
  for (const state of ['requested', 'finalizing', 'failed_retryable', 'completed']) {
    assert.equal(canStartNewAccountDeletionRequestCycle({ state }), false)
  }
})

test('a fresh request cycle increments version and cannot retain prior workflow fields', () => {
  const cancelled = { state: 'cancelled', requestVersion: 4 }
  const fresh = {
    uid: 'user-1', state: 'requested', requestedAt: 2, requestedBy: 'user-1',
    cancelledAt: null, updatedAt: 2, requestVersion: 5,
  }
  assert.equal(isFreshAccountDeletionRequestCycle(null, { ...fresh, requestVersion: 1 }), true)
  assert.equal(isFreshAccountDeletionRequestCycle(cancelled, fresh), true)
  assert.equal(isFreshAccountDeletionRequestCycle(cancelled, { ...fresh, requestVersion: 4 }), false)
  assert.equal(isFreshAccountDeletionRequestCycle(
    { state: 'cancelled', requestVersion: Number.MAX_SAFE_INTEGER },
    { ...fresh, requestVersion: Number.MAX_SAFE_INTEGER + 1 },
  ), false)
  for (const staleField of [
    'finalizationStartedAt', 'finalizedBy', 'completedAt', 'lastCompletedStep', 'failureCode',
    'retryCount', 'leaseId', 'leaseExpiresAt', 'cleanupCounts', 'retainedConsentEvidence',
  ]) {
    assert.equal(isFreshAccountDeletionRequestCycle(cancelled, { ...fresh, [staleField]: null }), false)
  }
})

test('account deletion projection exposes only owner-safe status fields', () => {
  assert.deepEqual(projectAccountDeletionRequest({
    uid: 'private', state: 'requested', requestedAt: 1, requestedBy: 'private',
    cancelledAt: null, updatedAt: 2, requestVersion: 3, internal: 'private',
  }), { state: 'requested', requestedAt: 1, cancelledAt: null, requestVersion: 3 })
  assert.equal(projectAccountDeletionRequest({ state: 'unknown' }), null)
})
