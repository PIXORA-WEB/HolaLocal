import { initialDeletionEvidenceRetention, nextRetentionDecision, requireRetentionAdmin, retentionText, validRetentionDecision } from './recordRetention.js'
import { customerReviewCleanupPath } from './customerReviewDeletion.js'
import { randomUUID } from 'node:crypto'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { HttpsError } from 'firebase-functions/v2/https'
import { ACCOUNT_DELETION_FINALIZER_LEASE_SECONDS, SAVED_BUSINESSES_SUBCOLLECTION, hasValidLegalConsent, hasReachedAccountDeletionCheckpoint, isAccountDeletionFailureCode, isSanitizedAccountDeletionCleanupCounts, nextAccountDeletionCheckpoint } from '@holalocal/firebase-contract'

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

export function isAutomaticErasureEligible(request, now = Timestamp.now()) {
  const attempts = request?.retryCount ?? 0
  if (!Number.isInteger(attempts) || attempts < 0 || attempts >= 5) return false
  if (!['failed_retryable','finalizing'].includes(request?.state)
    || typeof request.finalizedBy !== 'string' || !request.finalizedBy
    || !(request.finalizationStartedAt instanceof Timestamp)) return false
  if (!(request.updatedAt instanceof Timestamp) || request.updatedAt.toMillis() + Math.min(3600000, 300000 * 2 ** attempts) > now.toMillis()) return false
  return getAccountDeletionFinalizationEligibility(request, now).canFinalize
}

export async function acquireAccountDeletionLease({ uid, adminUid, expectedRequestVersion, db, recovery = false, now = Timestamp.now(), leaseIdFactory = randomUUID }) {
  const safeUid = requireTrustedUid(uid); const safeAdminUid = requireTrustedUid(adminUid)
  if (!Number.isSafeInteger(expectedRequestVersion) || expectedRequestVersion < 1) throw new HttpsError('invalid-argument', 'invalid-request-version')
  const ref = db.doc(`accountDeletionRequests/${safeUid}`)
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists) throw integrityError('account-deletion-request-not-found')
    const request = snapshot.data()
    if (request.requestVersion !== expectedRequestVersion) throw new HttpsError('aborted', 'stale-request-version')
    if (request.state === 'completed') return { acquired: false, completed: true, requestVersion: request.requestVersion }
    if (recovery && (!isAutomaticErasureEligible(request, now) || request.finalizedBy !== safeAdminUid)) throw integrityError('automatic-erasure-ineligible')
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
      retryCount: recovery || request.state === 'failed_retryable' ? (request.retryCount ?? 0) + 1 : (request.retryCount ?? 0),
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

const SAVED_BUSINESS_DELETION_BATCH_SIZE = 200

export async function cleanupUserSavedBusinesses({ uid, db }) {
  const safeUid = requireTrustedUid(uid)
  const collection = db.collection(`users/${safeUid}/${SAVED_BUSINESSES_SUBCOLLECTION}`)
  let deleted = 0
  while (true) {
    const removed = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(collection.limit(SAVED_BUSINESS_DELETION_BATCH_SIZE))
      for (const document of snapshot.docs) transaction.delete(document.ref ?? collection.doc(document.id))
      return snapshot.size
    })
    deleted += removed
    if (removed < SAVED_BUSINESS_DELETION_BATCH_SIZE) break
  }
  return { deleted }
}

const storageMissing = (error) => ['404', 404, 'storage/object-not-found', 'not-found'].includes(error?.code)
export async function cleanupUserMedia({ uid, bucket = getStorage().bucket(), db = null }) {
  const safeUid = requireTrustedUid(uid); const counts = { attempted: 0, deleted: 0, alreadyMissing: 0, failed: 0 }; let files
  try {
    ;[files] = await bucket.getFiles({ prefix: `users/${safeUid}/` })
  } catch { return { ok: false, retryable: true, counts: { ...counts, failed: 1 } } }
  for (const file of files) {
    counts.attempted += 1
    try { await file.delete(); counts.deleted += 1 } catch (error) { if (storageMissing(error)) counts.alreadyMissing += 1; else counts.failed += 1 }
  }
  if (db) await db.doc(`mediaUploadSessions/profile_${safeUid}`).delete().catch(() => undefined)
  return { ok: counts.failed === 0, retryable: counts.failed > 0, counts }
}

export async function minimizeConsentEvidenceAndRemoveUser({ uid, db, expectedRequestVersion, leaseId }) {
  const safeUid = requireTrustedUid(uid); const userRef = db.doc(`users/${safeUid}`); const requestRef = db.doc(`accountDeletionRequests/${safeUid}`)
  return db.runTransaction(async (transaction) => {
    const [userSnapshot, requestSnapshot, reviewCleanup] = await Promise.all([transaction.get(userRef), transaction.get(requestRef), transaction.get(db.doc(customerReviewCleanupPath(safeUid)))])
    const request = requestSnapshot.exists ? requestSnapshot.data() : null
    if (!request || request.state !== 'finalizing' || request.requestVersion !== expectedRequestVersion || (leaseId !== undefined && request.leaseId !== leaseId)) throw new HttpsError('aborted', 'account-deletion-workflow-stale')
    if (reviewCleanup.data()?.complete !== true) throw integrityError('customer-review-cleanup-incomplete')
    if (!userSnapshot.exists) {
      if (hasReachedAccountDeletionCheckpoint(request.lastCompletedStep, 'user_evidence_minimized') && request.retainedConsentEvidence) return { removed: false, idempotent: true, requestVersion: request.requestVersion }
      throw integrityError('profile-not-found')
    }
    const user = userSnapshot.data()
    if (!hasValidLegalConsent(user)) throw integrityError('consent-evidence-invalid')
    if (!nextAccountDeletionCheckpoint(request.lastCompletedStep ?? null, 'user_evidence_minimized')) throw integrityError('account-deletion-checkpoint-out-of-order')
    const retainedConsentEvidence = { termsVersion: user.termsVersion, termsAcceptedAt: user.termsAcceptedAt, privacyVersion: user.privacyVersion, privacyAcceptedAt: user.privacyAcceptedAt }
    transaction.update(requestRef, { retainedConsentEvidence, lastCompletedStep: 'user_evidence_minimized', requestVersion: request.requestVersion + 1, updatedAt: FieldValue.serverTimestamp() })
    transaction.delete(userRef)
    return { removed: true, idempotent: false, requestVersion: request.requestVersion + 1 }
  })
}

export async function completeAccountDeletionWorkflow({ uid, leaseId, expectedRequestVersion, db, now = Timestamp.now() }) {
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
    const privateRef = db.doc(`acknowledgmentRetention/${uid}`)
    const privateSnapshot = await transaction.get(privateRef)
    if (!privateSnapshot.exists) transaction.set(privateRef, { decision: initialDeletionEvidenceRetention({ reviewerId: request.finalizedBy, now }) })
    const requestVersion = request.requestVersion + 1
    transaction.update(ref, {
      state: 'completed', lastCompletedStep: 'completed', completedAt: FieldValue.serverTimestamp(),
      failureCode: null, leaseId: null, leaseExpiresAt: null,
      requestVersion, updatedAt: FieldValue.serverTimestamp(),
    })
    transaction.delete(db.doc(customerReviewCleanupPath(uid)))
    return { state: 'completed', requestVersion, idempotent: false }
  })
}

export async function deleteFirebaseAuthUser({ uid, auth = getAuth() }) {
  const safeUid = requireTrustedUid(uid)
  try { await auth.deleteUser(safeUid); return { ok: true, alreadyMissing: false } }
  catch (error) { if (error?.code === 'auth/user-not-found') return { ok: true, alreadyMissing: true }; return { ok: false, retryable: true, failureCode: 'firebase_auth_deletion_failed' } }
}

// Admin gateway supplies the closed-by-default cleanup control; no scheduled execution.
export async function assessAcknowledgmentRetention({ uid, actorUid, claims, db, expectedRevision, action, reason, endingCondition, reviewAt, now = Timestamp.now() }) {
  requireRetentionAdmin(actorUid, claims)
  const ref = db.doc(`accountDeletionRequests/${requireTrustedUid(uid)}`)
  return db.runTransaction(async tx => {
    const snapshot = await tx.get(ref), user = await tx.get(db.doc(`users/${uid}`))
    const row = snapshot.data()
    if (!snapshot.exists || row.state !== 'completed' || row.lastCompletedStep !== 'completed' || user.exists) throw new HttpsError('failed-precondition', 'completed-erasure-required')
    if (!row.retainedConsentEvidence) throw new HttpsError('failed-precondition', 'evidence-already-removed')
    const decision = nextRetentionDecision({previous:(await tx.get(db.doc(`acknowledgmentRetention/${uid}`))).data()?.decision,expectedRevision,actorUid,action,reason,endingCondition,reviewAt,now})
    tx.set(db.doc(`acknowledgmentRetention/${uid}`),{decision})
    return { revision: decision.revision, state: decision.state }
  })
}

export async function removeReleasedAcknowledgmentEvidence({ uid, actorUid, claims, db, enabled = false }) {
  requireRetentionAdmin(actorUid, claims)
  if (enabled !== true) return { removed: false, disabled: true }
  const ref = db.doc(`accountDeletionRequests/${requireTrustedUid(uid)}`)
  return db.runTransaction(async tx => {
    const snapshot = await tx.get(ref), user = await tx.get(db.doc(`users/${uid}`))
    if (!snapshot.exists) return {removed:false}
    const row = snapshot.data()
    if (user.exists || row.state !== 'completed' || row.lastCompletedStep !== 'completed') return {removed:false,blocked:true}
    if (row.retainedConsentEvidence == null) return {removed:false,idempotent:true}
    const privateRef = db.doc(`acknowledgmentRetention/${uid}`)
    const decision = (await tx.get(privateRef)).data()?.decision
    if (!validRetentionDecision(decision) || decision.state !== 'released') return {removed:false,blocked:true}
    // Keep terminal workflow identity/checkpoints for idempotency; this is not a whole-record retention exemption.
    tx.update(ref,{retainedConsentEvidence:FieldValue.delete()})
    tx.delete(privateRef)
    return {removed:true}
  })
}


export async function assessConversationRetention({ conversationId, actorUid, claims, db, expectedRevision, action, reason, endingCondition, reviewAt, now = Timestamp.now() }) {
  requireRetentionAdmin(actorUid, claims)
  const id = requireTrustedUid(conversationId), ref = db.doc(`conversationRetention/${id}`)
  return db.runTransaction(async tx => {
    const conversation = await tx.get(db.doc(`conversations/${id}`)), assessment = await tx.get(ref)
    if (!conversation.exists) throw new HttpsError('not-found', 'conversation-not-found')
    const decision = nextRetentionDecision({previous:assessment.data()?.decision,expectedRevision,actorUid,action,reason,endingCondition,reviewAt,now})
    // Never put private preservation reasons in participant-readable conversation data.
    tx.set(ref,{decision},{merge:true})
    return {revision:decision.revision,state:decision.state}
  })
}

export async function removeUnneededConversationBatch({ conversationId, actorUid, claims, db, auth, enabled = false, pageSize = 25 }) {
  requireRetentionAdmin(actorUid, claims)
  if (enabled !== true) return {removed:0,disabled:true}
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) throw new HttpsError('invalid-argument','invalid-retention-page-size')
  const id=requireTrustedUid(conversationId), ref=db.doc(`conversations/${id}`), privateRef=db.doc(`conversationRetention/${id}`)
  const initial=await ref.get()
  if(!initial.exists)return {removed:0,complete:true}
  const ids=initial.data().participantIds
  if(!Array.isArray(ids)||ids.length!==2||new Set(ids).size!==2)throw new HttpsError('failed-precondition','conversation-identity-mismatch')
  ids.forEach(requireTrustedUid)
  // No recent-login cutoff. Disabled/suspended Auth accounts still exist and retain history.
  for(const uid of ids){
    try {await auth.getUser(uid);return {removed:0,accountRetained:true}}
    catch(error){if(error?.code!=='auth/user-not-found')throw error}
  }
  return db.runTransaction(async tx=>{
    const [snapshot,assessment,...accounts]=await Promise.all([tx.get(ref),tx.get(privateRef),...ids.flatMap(uid=>[tx.get(db.doc(`users/${uid}`)),tx.get(db.doc(`accountDeletionRequests/${uid}`))])])
    if(!snapshot.exists)return {removed:0,complete:true}
    if(!sameMembers(snapshot.data().participantIds,ids))throw new HttpsError('aborted','conversation-identity-changed')
    for(let i=0;i<accounts.length;i+=2){
      const request=accounts[i+1].data()
      if(accounts[i].exists||!accounts[i+1].exists||request.state!=='completed'||request.lastCompletedStep!=='completed')return {removed:0,needsAssessment:true}
    }
    const decision=assessment.data()?.decision
    // Explicit assessment confirms history is no longer needed; missing/overdue is not consent to erase.
    if(!validRetentionDecision(decision)||decision.state!=='released')return {removed:0,held:true}
    const messages=await tx.get(ref.collection('messages').limit(pageSize))
    if(messages.docs.some(doc=>doc.data().attachment!=null))return {removed:0,needsAssessment:true}
    for(const message of messages.docs)tx.delete(message.ref)
    if(messages.size<pageSize){tx.delete(ref);tx.delete(privateRef)}
    else tx.update(ref,{lastMessage:null})
    return {removed:messages.size,complete:messages.size<pageSize}
  })
}


// Explicit human assessment only; never scans message text or infers what identifies a person.
export async function redactAssessedConversationMessage({ conversationId, messageId, subjectUid, actorUid, claims, reason, db, enabled = false, now = Timestamp.now() }) {
  requireRetentionAdmin(actorUid,claims)
  if(enabled!==true)return {redacted:false,disabled:true}
  const id=requireTrustedUid(conversationId), subject=requireTrustedUid(subjectUid), message=requireTrustedUid(messageId)
  const assessmentReason=retentionText(reason),ref=db.doc(`conversations/${id}`),messageRef=ref.collection('messages').doc(message),privateRef=db.doc(`conversationRetention/${id}`)
  return db.runTransaction(async tx=>{
    const [conversation,record,request,assessment]=await Promise.all([tx.get(ref),tx.get(messageRef),tx.get(db.doc(`accountDeletionRequests/${subject}`)),tx.get(privateRef)])
    if(!conversation.exists||!conversation.data().participantIds?.includes(subject)||!request.exists||!['requested','finalizing','failed_retryable','completed'].includes(request.data().state))throw new HttpsError('failed-precondition','authorised-participant-erasure-required')
    const decision=assessment.data()?.decision
    if(decision!=null&&(!validRetentionDecision(decision)||decision.state!=='released'))return {redacted:false,held:true}
    if(!record.exists)return {redacted:false,idempotent:true}
    const row=record.data()
    if(row.attachment!=null)return {redacted:false,needsAssessment:true}
    if(row.deletedAt instanceof Timestamp&&row.text===''&&row.translation==null)return {redacted:false,idempotent:true}
    // Keep the existing message ID and request tuple so retrying its old send cannot resurrect it.
    tx.update(messageRef,{text:'',translation:FieldValue.delete(),deletedAt:now,moderationStatus:'removed'})
    if(conversation.data().lastMessage?.messageId===message)tx.update(ref,{lastMessage:null})
    tx.set(privateRef,{lastErasureAssessment:{subjectUid:subject,messageId:message,reviewerId:actorUid,reason:assessmentReason,at:now}},{merge:true})
    return {redacted:true}
  })
}
