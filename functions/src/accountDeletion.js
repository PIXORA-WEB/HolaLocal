import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import {
  ACCOUNT_DELETION_RECENT_AUTH_MAX_AGE_SECONDS,
  hasCurrentLegalConsent,
  isCancellableAccountDeletionRequest,
  projectAccountDeletionRequest,
} from '@holalocal/firebase-contract'

function requireUid(value) {
  if (typeof value !== 'string' || !value.trim() || value.includes('/')) throw new HttpsError('unauthenticated', 'auth-required')
  return value.trim()
}

function requireRecentAuthentication(authTime, nowSeconds) {
  if (!Number.isSafeInteger(authTime) || authTime <= 0 || !Number.isSafeInteger(nowSeconds)
    || nowSeconds < authTime || nowSeconds - authTime > ACCOUNT_DELETION_RECENT_AUTH_MAX_AGE_SECONDS) {
    throw new HttpsError('failed-precondition', 'recent-authentication-required')
  }
}

function assertRequestEligible(profile) {
  if (!profile) throw new HttpsError('failed-precondition', 'profile-not-found')
  if (profile.accountStatus !== 'active') throw new HttpsError('failed-precondition', 'account-not-active')
  if (!hasCurrentLegalConsent(profile)) throw new HttpsError('failed-precondition', 'legal-consent-required')
}

function assertOwnershipMirrors({ uid, profile, mapping, ownerIds }) {
  const pointer = profile.businessId ?? null
  if (pointer != null && !ownerIds.has(pointer)) throw new HttpsError('failed-precondition', 'business-ownership-integrity-conflict')
  if (mapping) {
    if (mapping.ownerId !== uid || typeof mapping.businessId !== 'string' || !ownerIds.has(mapping.businessId)) {
      throw new HttpsError('failed-precondition', 'business-ownership-integrity-conflict')
    }
    if (pointer != null && mapping.businessId !== pointer) throw new HttpsError('failed-precondition', 'business-ownership-integrity-conflict')
  }
}

export async function requestAccountDeletion({ uid, emailVerified, authTime, claims = {}, db, nowSeconds = Math.floor(Date.now() / 1000) }) {
  const safeUid = requireUid(uid)
  if (emailVerified !== true) throw new HttpsError('failed-precondition', 'email-verification-required')
  if (claims.admin === true || claims.moderator === true) throw new HttpsError('failed-precondition', 'privileged-account-deletion-requires-support')
  requireRecentAuthentication(authTime, nowSeconds)
  const userRef = db.doc(`users/${safeUid}`)
  const requestRef = db.doc(`accountDeletionRequests/${safeUid}`)
  const mappingRef = db.doc(`businessOwners/${safeUid}`)
  const ownershipQuery = db.collection('businesses').where('ownerId', '==', safeUid)
  let response
  await db.runTransaction(async (transaction) => {
    const [latestUserSnapshot, latestRequestSnapshot, ownedSnapshot, mappingSnapshot] = await Promise.all([
      transaction.get(userRef), transaction.get(requestRef),
      transaction.get(ownershipQuery), transaction.get(mappingRef),
    ])
    const latestProfile = latestUserSnapshot.exists ? latestUserSnapshot.data() : null
    const latestRequest = latestRequestSnapshot.exists ? latestRequestSnapshot.data() : null
    if (latestRequest?.state === 'requested' && latestProfile?.deletionRequestedAt != null) {
      response = { ok: true, blocked: false, idempotent: true, request: projectAccountDeletionRequest(latestRequest) }
      return
    }
    assertRequestEligible(latestProfile)
    if (latestProfile.deletionRequestedAt != null) throw new HttpsError('failed-precondition', 'account-deletion-state-conflict')
    const ownerIds = new Set(ownedSnapshot.docs.map((snapshot) => snapshot.id))
    assertOwnershipMirrors({
      uid: safeUid,
      profile: latestProfile,
      mapping: mappingSnapshot.exists ? mappingSnapshot.data() : null,
      ownerIds,
    })
    if (ownerIds.size > 0) {
      response = { ok: false, blocked: true, reason: 'owned-businesses', ownedBusinessCount: ownerIds.size }
      return
    }
    const timestamp = FieldValue.serverTimestamp()
    const requestVersion = Number.isSafeInteger(latestRequest?.requestVersion) ? latestRequest.requestVersion + 1 : 1
    const nextRequest = { uid: safeUid, state: 'requested', requestedAt: timestamp, requestedBy: safeUid, cancelledAt: null, updatedAt: timestamp, requestVersion }
    transaction.set(requestRef, nextRequest)
    transaction.update(userRef, { deletionRequestedAt: timestamp, deletionScheduledFor: null, updatedAt: timestamp })
    response = { ok: true, blocked: false, idempotent: false, request: projectAccountDeletionRequest(nextRequest) }
  })
  return response
}

export async function cancelAccountDeletion({ uid, db }) {
  const safeUid = requireUid(uid)
  const userRef = db.doc(`users/${safeUid}`)
  const requestRef = db.doc(`accountDeletionRequests/${safeUid}`)
  let response
  await db.runTransaction(async (transaction) => {
    const [userSnapshot, requestSnapshot] = await Promise.all([transaction.get(userRef), transaction.get(requestRef)])
    if (!userSnapshot.exists) throw new HttpsError('failed-precondition', 'profile-not-found')
    if (!requestSnapshot.exists) throw new HttpsError('failed-precondition', 'account-deletion-request-not-found')
    const request = requestSnapshot.data()
    if (request.state === 'cancelled') {
      if (userSnapshot.data().deletionRequestedAt != null) {
        const timestamp = FieldValue.serverTimestamp()
        transaction.update(userRef, { deletionRequestedAt: null, deletionScheduledFor: null, updatedAt: timestamp })
      }
      response = { ok: true, idempotent: true, request: projectAccountDeletionRequest(request) }
      return
    }
    if (!isCancellableAccountDeletionRequest(request)) throw new HttpsError('failed-precondition', 'account-deletion-not-cancellable')
    const timestamp = FieldValue.serverTimestamp()
    const nextRequest = { ...request, state: 'cancelled', cancelledAt: timestamp, updatedAt: timestamp, requestVersion: request.requestVersion + 1 }
    transaction.set(requestRef, nextRequest)
    transaction.update(userRef, { deletionRequestedAt: null, deletionScheduledFor: null, updatedAt: timestamp })
    response = { ok: true, idempotent: false, request: projectAccountDeletionRequest(nextRequest) }
  })
  return response
}
