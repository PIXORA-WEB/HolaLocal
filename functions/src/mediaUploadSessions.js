import { randomUUID } from 'node:crypto'
import { HttpsError } from 'firebase-functions/v2/https'

export const MEDIA_SESSION_EXPIRY_MS = 60 * 60 * 1000
export const MEDIA_SWEEPER_SCHEDULE = 'every 60 minutes'
export const MEDIA_SESSION_COLLECTION = 'mediaUploadSessions'
export const CONFLICTING_STAGING_CLEANUP_COLLECTION = 'mediaStagingCleanupObligations'

export function profileSessionId(uid) {
  return `profile_${uid}`
}

export function businessSessionId(businessId, kind, slot = null) {
  return kind === 'logo' ? `business_${businessId}_logo` : `business_${businessId}_gallery_${slot}`
}

function millis(value) {
  if (typeof value?.toMillis === 'function') return value.toMillis()
  return new Date(value).getTime()
}

export function sessionIsActive(session, now = Date.now()) {
  if (!session) return false
  if (session.cleanupPending === true
    || ['cleanup_pending', 'cleanup_retry', 'promoting', 'promoted'].includes(session.state)) return true
  return (session.state === 'completed' ? false : !['failed', 'expired'].includes(session.state))
    && Number.isFinite(millis(session.expiresAt)) && millis(session.expiresAt) > now
}

export async function prepareBoundedMediaSession({
  db, sessionId, principalUid, businessId = null, kind, slot = null,
  stagingPath, canonicalPath, expectedCanonicalGeneration, expectedAuthorityPath = null,
  expectedAuthorityGeneration = null, now = new Date(), requestId = randomUUID(),
}) {
  const sessionRef = db.doc(`${MEDIA_SESSION_COLLECTION}/${sessionId}`)
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(sessionRef)
    if (current.exists && sessionIsActive(current.data(), now.getTime())) {
      throw new HttpsError('aborted', 'media-upload-already-active')
    }
    transaction.set(sessionRef, {
      requestId,
      principalUid,
      ...(businessId ? { businessId } : {}),
      kind,
      ...(slot == null ? {} : { slot }),
      stagingPath,
      canonicalPath,
      expectedCanonicalGeneration: String(expectedCanonicalGeneration),
      expectedAuthorityPath,
      expectedAuthorityGeneration: expectedAuthorityGeneration == null ? null : String(expectedAuthorityGeneration),
      state: 'prepared',
      version: Number(current.data()?.version ?? 0) + 1,
      expiresAt: new Date(now.getTime() + MEDIA_SESSION_EXPIRY_MS),
      createdAt: now,
      updatedAt: now,
    })
  })
  return { requestId, stagingPath }
}

export function assertFinalizableSession(session, { requestId, principalUid, stagingGeneration, now = Date.now() }) {
  if (!session || session.requestId !== requestId || session.principalUid !== principalUid) {
    throw new HttpsError('failed-precondition', 'media-session-stale')
  }
  if (!session.stagingGeneration || String(session.stagingGeneration) !== String(stagingGeneration)) {
    throw new HttpsError('failed-precondition', 'media-generation-mismatch')
  }
  if (session.state === 'completed') return 'completed'
  if (!sessionIsActive(session, now)) throw new HttpsError('deadline-exceeded', 'media-session-expired')
  if (!['uploaded', 'promoting', 'promoted'].includes(session.state)) {
    throw new HttpsError('failed-precondition', 'media-staging-not-clean')
  }
  return 'active'
}

function sessionReferenceForParsedPath(db, parsedPath) {
  const sessionId = parsedPath.kind === 'profile'
    ? profileSessionId(parsedPath.uid)
    : businessSessionId(parsedPath.businessId, parsedPath.kind, parsedPath.slot ?? null)
  return db.doc(`${MEDIA_SESSION_COLLECTION}/${sessionId}`)
}

function conflictingCleanupId(requestId, generation) {
  return `${requestId}_${generation}`
}

export async function checkpointStagingCleanupResponsibility({
  db, parsedPath, path, generation, uploadSessionId, now = new Date(),
}) {
  const sessionRef = sessionReferenceForParsedPath(db, parsedPath)
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sessionRef)
    if (!snapshot.exists) return { status: 'ignored' }
    const session = snapshot.data()
    if (session.stagingPath !== path
      || typeof uploadSessionId !== 'string' || uploadSessionId !== session.requestId) {
      return { status: 'ignored' }
    }
    const exactGeneration = String(generation)
    const currentGeneration = session.stagingGeneration == null
      ? null : String(session.stagingGeneration)
    if (currentGeneration != null) {
      if (exactGeneration !== currentGeneration) {
        const cleanupId = conflictingCleanupId(session.requestId, exactGeneration)
        const cleanupRef = db.doc(`${CONFLICTING_STAGING_CLEANUP_COLLECTION}/${cleanupId}`)
        const cleanupSnapshot = await transaction.get(cleanupRef)
        const cleanup = cleanupSnapshot.data()
        transaction.set(cleanupRef, {
          requestId: session.requestId,
          sessionId: sessionRef.id,
          principalUid: session.principalUid,
          ...(session.businessId ? { businessId: session.businessId } : {}),
          kind: session.kind,
          ...(session.slot == null ? {} : { slot: session.slot }),
          stagingPath: path,
          stagingGeneration: exactGeneration,
          state: cleanup?.state === 'cleanup_retry' ? 'cleanup_retry' : 'cleanup_pending',
          cleanupFailure: cleanup?.cleanupFailure ?? null,
          cleanupAfter: cleanup?.cleanupAfter ?? now,
          createdAt: cleanup?.createdAt ?? now,
          updatedAt: now,
        })
        return { status: 'conflict', cleanupObligationId: cleanupId }
      }
      if (session.state === 'cleanup_pending') return { status: 'already-pending' }
      if (session.state === 'cleanup_retry') return { status: 'already-retry' }
      return ['uploaded', 'promoting', 'promoted', 'completed'].includes(session.state)
        ? { status: 'already-clean' }
        : { status: 'ignored' }
    }
    if (!sessionIsActive(session, now.getTime()) || session.state !== 'prepared') {
      return { status: 'ignored' }
    }
    transaction.update(sessionRef, {
      stagingGeneration: exactGeneration,
      state: 'cleanup_pending',
      cleanupPending: true,
      cleanupFailure: 'metadata-cleanup-pending',
      updatedAt: now,
    })
    return { status: 'checkpointed' }
  })
}

export async function recordConflictingStagingCleanupFailure({
  db, cleanupObligationId, path, generation, deletionError, now = new Date(),
}) {
  const ref = db.doc(`${CONFLICTING_STAGING_CLEANUP_COLLECTION}/${cleanupObligationId}`)
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    const cleanup = snapshot.data()
    if (!snapshot.exists || cleanup.stagingPath !== path
      || String(cleanup.stagingGeneration) !== String(generation)) return false
    transaction.update(ref, {
      state: 'cleanup_retry',
      cleanupFailure: Number(deletionError?.code) === 412 ? 'generation-mismatch' : 'transient',
      updatedAt: now,
    })
    return true
  })
}

export async function reconcileConflictingStagingCleanup({
  db, cleanupObligationId, path, generation,
}) {
  const ref = db.doc(`${CONFLICTING_STAGING_CLEANUP_COLLECTION}/${cleanupObligationId}`)
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    const cleanup = snapshot.data()
    if (!snapshot.exists) return true
    if (cleanup.stagingPath !== path
      || String(cleanup.stagingGeneration) !== String(generation)) return false
    transaction.delete(ref)
    return true
  })
}

export async function markStagingGenerationClean({
  db, parsedPath, path, generation, uploadSessionId, now = new Date(),
}) {
  const sessionRef = sessionReferenceForParsedPath(db, parsedPath)
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sessionRef)
    const session = snapshot.data()
    if (!snapshot.exists || session.requestId !== uploadSessionId || session.stagingPath !== path
      || String(session.stagingGeneration) !== String(generation)
      || session.state !== 'cleanup_pending') return false
    transaction.update(sessionRef, {
      state: 'uploaded', cleanupPending: false, cleanupFailure: null, updatedAt: now,
    })
    return true
  })
}

export async function recordStagingCleanupFailure({
  db, parsedPath, path, generation, uploadSessionId, deletionError = null, now = new Date(),
}) {
  const sessionRef = sessionReferenceForParsedPath(db, parsedPath)
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sessionRef)
    const session = snapshot.data()
    if (!snapshot.exists || session.requestId !== uploadSessionId || session.stagingPath !== path
      || String(session.stagingGeneration) !== String(generation)
      || session.state !== 'cleanup_pending') return false
    transaction.update(sessionRef, deletionError ? {
      state: 'cleanup_retry',
      cleanupPending: true,
      cleanupFailure: Number(deletionError?.code) === 412 ? 'generation-mismatch' : 'transient',
      cleanupReason: 'metadata-cleanup-failed',
      updatedAt: now,
    } : {
      state: 'failed',
      cleanupPending: false,
      cleanupFailure: 'metadata-cleanup-failed-object-removed',
      cleanupReason: 'metadata-cleanup-failed',
      updatedAt: now,
    })
    return true
  })
}

export async function recordFinalizedStagingGeneration({
  db, parsedPath, path, generation, uploadSessionId, now = new Date(),
}) {
  return checkpointStagingCleanupResponsibility({
    db, parsedPath, path, generation, uploadSessionId, now,
  })
}
