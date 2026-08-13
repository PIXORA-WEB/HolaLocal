import { randomUUID } from 'node:crypto'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { HttpsError } from 'firebase-functions/v2/https'
import { ACCOUNT_DELETION_FINALIZER_LEASE_SECONDS, hasCurrentLegalConsent, hasReachedAccountDeletionCheckpoint, isAccountDeletionFailureCode, isSanitizedAccountDeletionCleanupCounts, nextAccountDeletionCheckpoint } from '@holalocal/firebase-contract'

function requireTrustedUid(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new HttpsError('invalid-argument', 'invalid-trusted-uid')
  }
  return value
}
const integrityError = (message) => new HttpsError('failed-precondition', message)
const sameMembers = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v) => b.includes(v))

export function getAccountDeletionFinalizationEligibility(request, now = Timestamp.now()) {
  if (request?.state === 'requested') return Object.freeze({ canFinalize: true, actionReason: 'requested' })
  if (request?.state === 'failed_retryable') return Object.freeze({ canFinalize: true, actionReason: 'retryable-failure' })
  if (request?.state === 'finalizing') {
    const expiresAt = request.leaseExpiresAt?.toMillis?.()
    if (!Number.isFinite(expiresAt)) {
      return Object.freeze({ canFinalize: false, actionReason: 'workflow-state-conflict' })
    }
    return expiresAt <= now.toMillis()
      ? Object.freeze({ canFinalize: true, actionReason: 'expired-finalizer-lease' })
      : Object.freeze({ canFinalize: false, actionReason: 'finalization-in-progress' })
  }
  return Object.freeze({ canFinalize: false, actionReason: 'terminal' })
}

export async function assertNoAuthoritativeOwnedBusinesses({ uid, db, profile }) {
  const safeUid = requireTrustedUid(uid)
  const [owned, mapping] = await Promise.all([
    db.collection('businesses').where('ownerId', '==', safeUid).get(), db.doc(`businessOwners/${safeUid}`).get(),
  ])
  const ownerIds = new Set(owned.docs.map((snapshot) => snapshot.id))
  const pointer = profile?.businessId ?? null
  const mirror = mapping.exists ? mapping.data() : null
  if (pointer != null && !ownerIds.has(pointer)) throw integrityError('business-ownership-integrity-conflict')
  if (mirror && (mirror.ownerId !== safeUid || typeof mirror.businessId !== 'string'
    || !ownerIds.has(mirror.businessId) || (pointer != null && pointer !== mirror.businessId))) {
    throw integrityError('business-ownership-integrity-conflict')
  }
  if (ownerIds.size > 0) throw integrityError('owned-businesses-block-account-deletion')
  return { blocked: false, ownedBusinessCount: 0 }
}

export async function acquireAccountDeletionLease({ uid, adminUid, expectedRequestVersion, db, now = Timestamp.now(), leaseIdFactory = randomUUID }) {
  const safeUid = requireTrustedUid(uid); const safeAdminUid = requireTrustedUid(adminUid)
  if (!Number.isSafeInteger(expectedRequestVersion) || expectedRequestVersion < 1) throw new HttpsError('invalid-argument', 'invalid-request-version')
  const ref = db.doc(`accountDeletionRequests/${safeUid}`)
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists) throw integrityError('account-deletion-request-not-found')
    const request = snapshot.data()
    if (request.requestVersion !== expectedRequestVersion) throw new HttpsError('aborted', 'stale-request-version')
    if (request.state === 'completed') return { acquired: false, completed: true, requestVersion: request.requestVersion }
    const eligibility = getAccountDeletionFinalizationEligibility(request, now)
    if (!eligibility.canFinalize) {
      if (eligibility.actionReason === 'finalization-in-progress') {
        throw new HttpsError('aborted', 'account-deletion-lease-active')
      }
      throw integrityError('account-deletion-state-conflict')
    }
    if (!['requested', 'failed_retryable', 'finalizing'].includes(request.state)) throw integrityError('account-deletion-state-conflict')
    const leaseId = leaseIdFactory(); if (typeof leaseId !== 'string' || !leaseId) throw new Error('Invalid generated lease ID.')
    const requestVersion = request.requestVersion + 1
    transaction.update(ref, { state: 'finalizing', finalizationStartedAt: request.finalizationStartedAt ?? now,
      finalizedBy: safeAdminUid, failureCode: null, leaseId,
      leaseExpiresAt: Timestamp.fromMillis(now.toMillis() + ACCOUNT_DELETION_FINALIZER_LEASE_SECONDS * 1000),
      retryCount: request.state === 'failed_retryable' ? (request.retryCount ?? 0) + 1 : (request.retryCount ?? 0),
      requestVersion, updatedAt: now })
    return { acquired: true, completed: false, leaseId, requestVersion }
  })
}

export async function recordAccountDeletionCheckpoint({ uid, leaseId, expectedRequestVersion, checkpoint, db, cleanupCounts = null }) {
  if (cleanupCounts != null && !isSanitizedAccountDeletionCleanupCounts(cleanupCounts)) {
    throw new HttpsError('invalid-argument', 'invalid-cleanup-counts')
  }
  const ref = db.doc(`accountDeletionRequests/${requireTrustedUid(uid)}`)
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref); const request = snapshot.exists ? snapshot.data() : null
    if (!request || request.state !== 'finalizing' || request.leaseId !== leaseId || request.requestVersion !== expectedRequestVersion) throw new HttpsError('aborted', 'account-deletion-workflow-stale')
    if (hasReachedAccountDeletionCheckpoint(request.lastCompletedStep, checkpoint)) {
      return { checkpoint, requestVersion: request.requestVersion, idempotent: true }
    }
    if (!nextAccountDeletionCheckpoint(request.lastCompletedStep ?? null, checkpoint)) throw integrityError('account-deletion-checkpoint-out-of-order')
    const update = { lastCompletedStep: checkpoint, requestVersion: request.requestVersion + 1, updatedAt: FieldValue.serverTimestamp() }
    if (cleanupCounts != null) update.cleanupCounts = cleanupCounts
    transaction.update(ref, update)
    return { checkpoint, requestVersion: request.requestVersion + 1, idempotent: false }
  })
}

export async function markAccountDeletionRetryable({ uid, leaseId, failureCode, db, cleanupCounts = null }) {
  if (!isAccountDeletionFailureCode(failureCode)) throw new HttpsError('invalid-argument', 'invalid-failure-code')
  if (cleanupCounts != null && !isSanitizedAccountDeletionCleanupCounts(cleanupCounts)) {
    throw new HttpsError('invalid-argument', 'invalid-cleanup-counts')
  }
  const ref = db.doc(`accountDeletionRequests/${requireTrustedUid(uid)}`)
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref); const request = snapshot.exists ? snapshot.data() : null
    if (!request || request.state !== 'finalizing' || request.leaseId !== leaseId) throw new HttpsError('aborted', 'account-deletion-workflow-stale')
    const update = { state: 'failed_retryable', failureCode, leaseId: null, leaseExpiresAt: null,
      requestVersion: request.requestVersion + 1, updatedAt: FieldValue.serverTimestamp() }
    if (cleanupCounts != null) update.cleanupCounts = cleanupCounts
    transaction.update(ref, update)
    return { state: 'failed_retryable', failureCode, requestVersion: request.requestVersion + 1 }
  })
}

export async function removeUserManagerRelationships({ uid, db }) {
  const safeUid = requireTrustedUid(uid)
  const matches = await db.collection('businesses').where('managerIds', 'array-contains', safeUid).get(); let removed = 0
  for (const match of matches.docs) {
    const publicRef = db.doc(`businesses/${match.id}`); const privateRef = db.doc(`businessPrivate/${match.id}`)
    const changed = await db.runTransaction(async (transaction) => {
      const [pub, priv] = await Promise.all([transaction.get(publicRef), transaction.get(privateRef)])
      if (!pub.exists) return false
      const business = pub.data()
      if (business.ownerId === safeUid) throw integrityError('manager-cleanup-owner-conflict')
      if (!Array.isArray(business.managerIds)) throw integrityError('manager-relationship-integrity-conflict')
      if (!business.managerIds.includes(safeUid)) return false
      if (priv.exists) {
        const privateBusiness = priv.data()
        if (privateBusiness.ownerId !== business.ownerId || !sameMembers(privateBusiness.managerIds, business.managerIds)) throw integrityError('manager-relationship-integrity-conflict')
        transaction.update(privateRef, { managerIds: privateBusiness.managerIds.filter((id) => id !== safeUid), updatedAt: FieldValue.serverTimestamp() })
      }
      transaction.update(publicRef, { managerIds: business.managerIds.filter((id) => id !== safeUid), updatedAt: FieldValue.serverTimestamp() })
      return true
    })
    if (changed) removed += 1
  }
  return { matched: matches.size, removed }
}

export async function tombstoneDeletedUserConversations({ uid, db }) {
  const safeUid = requireTrustedUid(uid)
  const matches = await db.collection('conversations').where('participantIds', 'array-contains', safeUid).get(); let tombstoned = 0
  for (const match of matches.docs) {
    const ref = db.doc(`conversations/${match.id}`)
    const changed = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref); if (!snapshot.exists) return false
      const conversation = snapshot.data()
      if (!Array.isArray(conversation.participantIds) || !conversation.participantIds.includes(safeUid) || conversation.customerId !== safeUid) throw integrityError('conversation-deletion-integrity-conflict')
      const existing = conversation.participantTombstones?.[safeUid]
      if (conversation.status === 'participant_deleted' && existing?.type === 'deleted_user') return false
      if (conversation.status !== 'active') throw integrityError('conversation-deletion-integrity-conflict')
      transaction.update(ref, { status: 'participant_deleted', participantTombstones: { ...(conversation.participantTombstones ?? {}), [safeUid]: { type: 'deleted_user', deletedAt: FieldValue.serverTimestamp() } }, updatedAt: FieldValue.serverTimestamp() })
      return true
    })
    if (changed) tombstoned += 1
  }
  return { matched: matches.size, tombstoned }
}

const storageMissing = (error) => ['404', 404, 'storage/object-not-found', 'not-found'].includes(error?.code)
export async function cleanupUserMedia({ uid, bucket = getStorage().bucket() }) {
  const safeUid = requireTrustedUid(uid); const counts = { attempted: 0, deleted: 0, alreadyMissing: 0, failed: 0 }; let files
  try { ;[files] = await bucket.getFiles({ prefix: `users/${safeUid}/profile/` }) } catch { return { ok: false, retryable: true, counts: { ...counts, failed: 1 } } }
  for (const file of files) {
    counts.attempted += 1
    try { await file.delete(); counts.deleted += 1 } catch (error) { if (storageMissing(error)) counts.alreadyMissing += 1; else counts.failed += 1 }
  }
  return { ok: counts.failed === 0, retryable: counts.failed > 0, counts }
}

export async function minimizeConsentEvidenceAndRemoveUser({ uid, db, expectedRequestVersion }) {
  const safeUid = requireTrustedUid(uid); const userRef = db.doc(`users/${safeUid}`); const requestRef = db.doc(`accountDeletionRequests/${safeUid}`)
  return db.runTransaction(async (transaction) => {
    const [userSnapshot, requestSnapshot] = await Promise.all([transaction.get(userRef), transaction.get(requestRef)])
    const request = requestSnapshot.exists ? requestSnapshot.data() : null
    if (!request || request.state !== 'finalizing' || request.requestVersion !== expectedRequestVersion) throw new HttpsError('aborted', 'account-deletion-workflow-stale')
    if (!userSnapshot.exists) {
      if (hasReachedAccountDeletionCheckpoint(request.lastCompletedStep, 'user_evidence_minimized') && request.retainedConsentEvidence) return { removed: false, idempotent: true, requestVersion: request.requestVersion }
      throw integrityError('profile-not-found')
    }
    const user = userSnapshot.data()
    if (!hasCurrentLegalConsent(user)) throw integrityError('consent-evidence-invalid')
    if (!nextAccountDeletionCheckpoint(request.lastCompletedStep ?? null, 'user_evidence_minimized')) throw integrityError('account-deletion-checkpoint-out-of-order')
    const retainedConsentEvidence = { termsVersion: user.termsVersion, termsAcceptedAt: user.termsAcceptedAt, privacyVersion: user.privacyVersion, privacyAcceptedAt: user.privacyAcceptedAt }
    transaction.update(requestRef, { retainedConsentEvidence, lastCompletedStep: 'user_evidence_minimized', requestVersion: request.requestVersion + 1, updatedAt: FieldValue.serverTimestamp() })
    transaction.delete(userRef)
    return { removed: true, idempotent: false, requestVersion: request.requestVersion + 1 }
  })
}

export async function completeAccountDeletionWorkflow({ uid, leaseId, expectedRequestVersion, db }) {
  const ref = db.doc(`accountDeletionRequests/${requireTrustedUid(uid)}`)
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    const request = snapshot.exists ? snapshot.data() : null
    if (!request) throw integrityError('account-deletion-request-not-found')
    if (request.state === 'completed') {
      return { state: 'completed', requestVersion: request.requestVersion, idempotent: true }
    }
    if (request.state !== 'finalizing' || request.leaseId !== leaseId
      || request.requestVersion !== expectedRequestVersion) {
      throw new HttpsError('aborted', 'account-deletion-workflow-stale')
    }
    if (request.lastCompletedStep !== 'firebase_auth_removed') {
      throw integrityError('account-deletion-checkpoint-out-of-order')
    }
    const requestVersion = request.requestVersion + 1
    transaction.update(ref, {
      state: 'completed', lastCompletedStep: 'completed', completedAt: FieldValue.serverTimestamp(),
      failureCode: null, leaseId: null, leaseExpiresAt: null,
      requestVersion, updatedAt: FieldValue.serverTimestamp(),
    })
    return { state: 'completed', requestVersion, idempotent: false }
  })
}

export async function deleteFirebaseAuthUser({ uid, auth = getAuth() }) {
  const safeUid = requireTrustedUid(uid)
  try { await auth.deleteUser(safeUid); return { ok: true, alreadyMissing: false } }
  catch (error) { if (error?.code === 'auth/user-not-found') return { ok: true, alreadyMissing: true }; return { ok: false, retryable: true, failureCode: 'firebase_auth_deletion_failed' } }
}
