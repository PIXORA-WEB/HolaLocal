import { HttpsError } from 'firebase-functions/v2/https'
import { hasReachedAccountDeletionCheckpoint } from '@holalocal/firebase-contract'
import {
  acquireAccountDeletionLease,
  assertNoAuthoritativeOwnedBusinesses,
  cleanupUserMedia,
  completeAccountDeletionWorkflow,
  deleteFirebaseAuthUser,
  getAccountDeletionFinalizationEligibility,
  markAccountDeletionRetryable,
  minimizeConsentEvidenceAndRemoveUser,
  recordAccountDeletionCheckpoint,
  removeUserManagerRelationships,
  tombstoneDeletedUserConversations,
} from './accountDeletionPrimitives.js'

function requireUid(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new HttpsError('invalid-argument', 'invalid-target-uid')
  }
  return value
}

function requireVersion(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new HttpsError('invalid-argument', 'invalid-request-version')
  }
  return value
}

function requireAdmin(adminUid, claims) {
  requireUid(adminUid)
  if (claims?.admin !== true) throw new HttpsError('permission-denied', 'admin-required')
}

function operationalResponse(request, overrides = {}) {
  const response = {
    state: overrides.state ?? request?.state ?? null,
    requestVersion: overrides.requestVersion ?? request?.requestVersion ?? null,
    lastCompletedStep: overrides.lastCompletedStep ?? request?.lastCompletedStep ?? null,
    failureCode: overrides.failureCode ?? request?.failureCode ?? null,
    blockerCode: overrides.blockerCode ?? null,
    cleanupCounts: overrides.cleanupCounts ?? request?.cleanupCounts ?? null,
    idempotent: overrides.idempotent ?? false,
  }
  return Object.freeze(response)
}

function ownershipBlocker(error) {
  if (error?.message === 'owned-businesses-block-account-deletion') return 'owned-businesses'
  if (error?.message === 'business-ownership-integrity-conflict') return 'ownership-integrity-conflict'
  return null
}

function failureCodeFor(error) {
  const message = error?.message
  if (message === 'manager-cleanup-owner-conflict' || message === 'business-ownership-integrity-conflict') return 'ownership_integrity_conflict'
  if (message === 'manager-relationship-integrity-conflict') return 'manager_relationship_integrity_conflict'
  if (message === 'conversation-deletion-integrity-conflict') return 'conversation_integrity_conflict'
  if (message === 'consent-evidence-invalid') return 'consent_evidence_invalid'
  if (message === 'profile-not-found') return 'user_evidence_minimization_failed'
  return 'internal_retryable'
}

export async function finalizeAccountDeletion({
  adminUid,
  claims,
  uid,
  expectedRequestVersion,
  db,
  primitives = {},
}) {
  requireAdmin(adminUid, claims)
  const safeUid = requireUid(uid)
  const safeVersion = requireVersion(expectedRequestVersion)
  const deps = {
    acquireLease: primitives.acquireLease ?? acquireAccountDeletionLease,
    assertNoOwnedBusinesses: primitives.assertNoOwnedBusinesses ?? assertNoAuthoritativeOwnedBusinesses,
    removeManagerRelationships: primitives.removeManagerRelationships ?? removeUserManagerRelationships,
    tombstoneConversations: primitives.tombstoneConversations ?? tombstoneDeletedUserConversations,
    cleanupMedia: primitives.cleanupMedia ?? cleanupUserMedia,
    minimizeEvidenceAndRemoveUser: primitives.minimizeEvidenceAndRemoveUser ?? minimizeConsentEvidenceAndRemoveUser,
    deleteAuthUser: primitives.deleteAuthUser ?? deleteFirebaseAuthUser,
    recordCheckpoint: primitives.recordCheckpoint ?? recordAccountDeletionCheckpoint,
    markRetryable: primitives.markRetryable ?? markAccountDeletionRetryable,
    completeWorkflow: primitives.completeWorkflow ?? completeAccountDeletionWorkflow,
  }

  const requestRef = db.doc(`accountDeletionRequests/${safeUid}`)
  const userRef = db.doc(`users/${safeUid}`)
  const [requestSnapshot, userSnapshot] = await Promise.all([requestRef.get(), userRef.get()])
  if (!requestSnapshot.exists) throw new HttpsError('failed-precondition', 'account-deletion-request-not-found')
  const initialRequest = requestSnapshot.data()
  if (initialRequest.state === 'completed') return operationalResponse(initialRequest, { idempotent: true })
  if (initialRequest.requestVersion !== safeVersion) throw new HttpsError('aborted', 'stale-request-version')
  if (initialRequest.state === 'cancelled') throw new HttpsError('failed-precondition', 'account-deletion-cancelled')
  const eligibility = getAccountDeletionFinalizationEligibility(initialRequest)
  if (!eligibility.canFinalize) {
    if (eligibility.actionReason === 'finalization-in-progress') {
      throw new HttpsError('aborted', 'account-deletion-lease-active')
    }
    throw new HttpsError('failed-precondition', 'account-deletion-state-conflict')
  }
  if (!userSnapshot.exists
    && !hasReachedAccountDeletionCheckpoint(initialRequest.lastCompletedStep, 'user_evidence_minimized')) {
    return operationalResponse(initialRequest, { blockerCode: 'profile-integrity-conflict' })
  }

  try {
    await deps.assertNoOwnedBusinesses({
      uid: safeUid, db, profile: userSnapshot.exists ? userSnapshot.data() : null,
    })
  } catch (error) {
    const blockerCode = ownershipBlocker(error)
    if (blockerCode) return operationalResponse(initialRequest, { blockerCode })
    throw error
  }

  const lease = await deps.acquireLease({
    uid: safeUid, adminUid, expectedRequestVersion: safeVersion, db,
  })
  if (lease.completed) return operationalResponse(initialRequest, {
    state: 'completed', requestVersion: lease.requestVersion, idempotent: true,
  })

  let version = lease.requestVersion
  let lastCompletedStep = initialRequest.lastCompletedStep ?? null
  let cleanupCounts = initialRequest.cleanupCounts ?? null
  const checkpoint = async (name, counts = null) => {
    const result = await deps.recordCheckpoint({
      uid: safeUid, leaseId: lease.leaseId, expectedRequestVersion: version,
      checkpoint: name, db, cleanupCounts: counts,
    })
    version = result.requestVersion
    if (!hasReachedAccountDeletionCheckpoint(lastCompletedStep, name)) lastCompletedStep = name
    if (counts != null) cleanupCounts = counts
  }

  const fail = async (failureCode, counts = null) => {
    const failed = await deps.markRetryable({
      uid: safeUid, leaseId: lease.leaseId, failureCode, db, cleanupCounts: counts,
    })
    return operationalResponse(null, {
      state: failed.state, requestVersion: failed.requestVersion, lastCompletedStep,
      failureCode, cleanupCounts: counts ?? cleanupCounts,
    })
  }

  try {
    // Recheck after acquiring the lease so ownership cannot change between the precheck and destruction.
    const latestUser = await userRef.get()
    await deps.assertNoOwnedBusinesses({ uid: safeUid, db, profile: latestUser.exists ? latestUser.data() : null })
    await checkpoint('ownership_verified')

    await deps.removeManagerRelationships({ uid: safeUid, db })
    await checkpoint('manager_relationships_cleaned')

    await deps.tombstoneConversations({ uid: safeUid, db })
    await checkpoint('conversations_tombstoned')

    const mediaResult = await deps.cleanupMedia({ uid: safeUid })
    if (!mediaResult?.ok || mediaResult.counts?.failed > 0) {
      return fail('profile_media_cleanup_failed', mediaResult?.counts ?? {
        attempted: 0, deleted: 0, alreadyMissing: 0, failed: 1,
      })
    }
    await checkpoint('profile_media_cleaned', mediaResult.counts)

    const evidenceResult = await deps.minimizeEvidenceAndRemoveUser({
      uid: safeUid, db, expectedRequestVersion: version,
    })
    version = evidenceResult.requestVersion
    lastCompletedStep = 'user_evidence_minimized'

    const authResult = await deps.deleteAuthUser({ uid: safeUid })
    if (!authResult?.ok) return fail(authResult?.failureCode ?? 'firebase_auth_deletion_failed')
    await checkpoint('firebase_auth_removed')

    const completed = await deps.completeWorkflow({
      uid: safeUid, leaseId: lease.leaseId, expectedRequestVersion: version, db,
    })
    return operationalResponse(null, {
      state: completed.state, requestVersion: completed.requestVersion,
      lastCompletedStep: 'completed', cleanupCounts, idempotent: completed.idempotent,
    })
  } catch (error) {
    // Do not persist free-form error details; only the fixed enum is retained.
    return fail(failureCodeFor(error))
  }
}
