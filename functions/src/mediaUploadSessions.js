import { randomUUID } from 'node:crypto'
import { HttpsError } from 'firebase-functions/v2/https'

export const MEDIA_SESSION_EXPIRY_MS = 60 * 60 * 1000
export const MEDIA_SWEEPER_SCHEDULE = 'every 60 minutes'
export const MEDIA_SESSION_COLLECTION = 'mediaUploadSessions'

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
  return session && (session.state === 'completed' ? session.cleanupPending === true
    : !['failed', 'expired'].includes(session.state))
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
  return 'active'
}

export async function checkpointStagingGeneration({ db, sessionRef, requestId, stagingGeneration, now = new Date() }) {
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sessionRef)
    const session = snapshot.data()
    assertFinalizableSession(session, {
      requestId, principalUid: session?.principalUid, stagingGeneration, now: now.getTime(),
    })
    transaction.update(sessionRef, {
      stagingGeneration: String(stagingGeneration), state: 'uploaded', updatedAt: now,
    })
  })
}

export async function recordFinalizedStagingGeneration({
  db, parsedPath, path, generation, uploadSessionId, now = new Date(),
}) {
  const sessionId = parsedPath.kind === 'profile'
    ? profileSessionId(parsedPath.uid)
    : businessSessionId(parsedPath.businessId, parsedPath.kind, parsedPath.slot ?? null)
  const sessionRef = db.doc(`${MEDIA_SESSION_COLLECTION}/${sessionId}`)
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sessionRef)
    if (!snapshot.exists) return
    const session = snapshot.data()
    if (!sessionIsActive(session, now.getTime()) || session.stagingPath !== path
      || typeof uploadSessionId !== 'string' || uploadSessionId !== session.requestId) return
    const current = String(session.stagingGeneration ?? '0')
    if (BigInt(String(generation)) <= BigInt(current)) return
    transaction.update(sessionRef, {
      stagingGeneration: String(generation),
      state: session.state === 'prepared' ? 'uploaded' : session.state,
      updatedAt: now,
    })
  })
}
