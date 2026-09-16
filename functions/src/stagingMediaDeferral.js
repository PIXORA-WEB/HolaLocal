import { FieldPath, FieldValue } from 'firebase-admin/firestore'
import { createHash } from 'node:crypto'
import { HttpsError } from 'firebase-functions/v2/https'
import { assertMediaCutover, checkMediaCutover } from './mediaCutoverControls.js'
import { businessSessionId, profileSessionId, hasUnsettledProfilePromotion, CONFLICTING_STAGING_CLEANUP_COLLECTION, MEDIA_SESSION_COLLECTION } from './mediaUploadSessions.js'
export const DEFERRED_STAGING_EVENTS = 'mediaStagingDeferredEvents'

export async function stagingAccount(db, parsed) {
  if (parsed.kind === 'profile') return parsed.uid
  const id = businessSessionId(parsed.businessId, parsed.kind, parsed.slot ?? null)
  const session = (await db.doc(`${MEDIA_SESSION_COLLECTION}/${id}`).get()).data()
  // Business orphan work without an attributable principal cannot bypass holds.
  return session?.principalUid ?? null
}
export async function checkStagingWork(db, uid) {
  if (!uid) throw new HttpsError('failed-precondition', 'media-cutover-held')
  await checkMediaCutover({ db, scope: 'stagingProcessing', uid })
}

export function stagingEventIdentity(object) {
  return createHash('sha256').update(JSON.stringify([object.bucket ?? null, object.name, String(object.generation)])).digest('hex')
}

export async function retainStagingEvent({ db, object, marker, now }) {
  if (!db) throw new HttpsError('failed-precondition', 'media-cutover-closed')
  const id = stagingEventIdentity(object)
  const ref = db.doc(`${DEFERRED_STAGING_EVENTS}/${id}`)
  const work = await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref)
    if (snapshot.exists) return snapshot.data()
    const row = { schemaVersion: 1, version: 1, state: 'pending',
      object: { name: object.name, generation: String(object.generation), bucket: object.bucket ?? null,
        metadata: marker == null ? {} : { holalocalUploadSession: marker } },
      provenance: 'storage-finalize-or-compatible-replay', createdAt: now, updatedAt: now }
    transaction.set(ref, row)
    return row
  })
  return { ref, work }
}

// Evidence is observational, never a deletion/minimization authorization.
// Old completed records remain unclassified; never infer/backfill their outcome.
export async function finishStagingEvent({ db, ref, expectedVersion, parsed, object,
  marker, uid, result = null, failure = null }) {
  return db.runTransaction(async transaction => {
    const current = (await transaction.get(ref)).data()
    if (!current || current.schemaVersion !== 1 || current.state !== 'pending'
      || (current.evidence != null && current.evidence.schemaVersion !== 1)
      || !Number.isSafeInteger(current.version) || current.version !== expectedVersion) return false
    let disposition = 'failed', reason = failure ?? 'processing-failed', dependency = null
    let state = 'pending'
    if (result) {
      const sessionId = parsed.kind === 'profile' ? profileSessionId(parsed.uid)
        : businessSessionId(parsed.businessId, parsed.kind, parsed.slot ?? null)
      const session = (await transaction.get(db.doc(`${MEDIA_SESSION_COLLECTION}/${sessionId}`))).data()
      // Control/hold reads serialize classification with new restrictions. Evidence
      // of a closed/held result is safe to persist; unavailable reads abort instead.
      let blocked = null
      try { await assertMediaCutover(transaction, db, 'stagingProcessing', uid) }
      catch (error) {
        if (error?.message === 'media-cutover-held') blocked = 'held'
        else if (error?.message === 'media-cutover-closed') blocked = 'controls-closed'
        else throw error
      }
      disposition = 'unclassified'; reason = 'unproven-responsibility'; state = 'completed'
      const identityMatches = current.object?.name === object.name
        && String(current.object?.generation) === String(object.generation)
        && (current.object?.bucket ?? null) === (object.bucket ?? null)
        && (current.object?.metadata?.holalocalUploadSession ?? null) === marker
      const bound = identityMatches && session && session.principalUid === uid && typeof marker === 'string' && session.requestId === marker
        && session.stagingPath === object.name && String(session.stagingGeneration) === String(object.generation)
        && Number.isSafeInteger(session.version) && session.version >= 1
      if (blocked) { disposition = 'blocked'; reason = blocked; state = 'pending' }
      else if (!bound && hasUnsettledProfilePromotion(session)) {
        disposition = 'protected'; reason = 'promotion-unresolved'
      } else if (bound) {
        dependency = { collection: MEDIA_SESSION_COLLECTION, documentId: sessionId,
          requestId: session.requestId, sessionVersion: session.version,
          stagingGeneration: String(session.stagingGeneration), observedState: session.state,
          promotionObligation: session.promotionObligation ?? null,
          promotedGeneration: session.promotedGeneration == null ? null : String(session.promotedGeneration) }
        if (hasUnsettledProfilePromotion(session)) {
          disposition = 'protected'; reason = 'promotion-unresolved'
        } else if (session.state === 'cleanup_retry' && session.cleanupPending === true) {
          disposition = 'transferred'; reason = 'session-cleanup-retry'
        } else {
          const conflict = (await transaction.get(db.doc(`${CONFLICTING_STAGING_CLEANUP_COLLECTION}/${marker}_${object.generation}`))).data()
          if (!conflict && session.cleanupPending !== true
            && ['uploaded', 'completed'].includes(session.state)
            && ['cleaned', 'already-clean'].includes(result.status)) {
            disposition = 'settled'; reason = 'no-known-outstanding-responsibility'; dependency = null
          }
        }
      }
    } else if (['held', 'controls-closed', 'unattributable'].includes(reason)) {
      disposition = 'blocked'
    }
    if (!['processing-failed', 'held', 'controls-closed',
      'unattributable', 'control-read-failed', 'unproven-responsibility', 'promotion-unresolved',
      'session-cleanup-retry', 'no-known-outstanding-responsibility'].includes(reason)) {
      throw new Error('invalid-staging-evidence-reason')
    }
    const stamp = FieldValue.serverTimestamp()
    transaction.update(ref, { state, version: current.version + 1,
      evidence: { schemaVersion: 1, disposition, reason, dependency, recordedAt: stamp },
      ...(state === 'completed' ? { completedAt: stamp } : {}), updatedAt: stamp })
    return true
  })
}

export const STAGING_REPLAY_PROGRESS = 'maintenanceProgress/stagingDeferredReplay'
export const STAGING_REPLAY_PAGE_SIZE = 50

// Concurrent workers may attempt the same page, but only the worker whose
// observed revision is still current can advance it. No lease expiry can skip
// work: a crash/query/checkpoint failure simply repeats a bounded page.
export async function replayStagingEvents({ db, process, now = new Date() }) {
  const ref = db.doc(STAGING_REPLAY_PROGRESS)
  const observed = (await ref.get()).data()
  if (observed && (observed.schemaVersion !== 1
    || !Number.isSafeInteger(observed.revision) || observed.revision < 1
    || !(observed.cursor === null || /^[a-f0-9]{64}$/.test(observed.cursor)))) {
    throw new Error('invalid-staging-replay-progress')
  }
  let query = db.collection(DEFERRED_STAGING_EVENTS).where('state', '==', 'pending')
    .orderBy(FieldPath.documentId()).limit(STAGING_REPLAY_PAGE_SIZE)
  if (observed?.cursor) query = query.startAfter(observed.cursor)
  const page = await query.get() // Never advance if the page query fails.
  for (const event of page.docs) {
    try { await process(event.data().object) }
    catch { /* Pending evidence survives; advance past poison work this cycle. */ }
  }
  const cursor = page.docs.length < STAGING_REPLAY_PAGE_SIZE
    ? null : page.docs[page.docs.length - 1].id
  const advanced = await db.runTransaction(async transaction => {
    const current = (await transaction.get(ref)).data()
    if ((current?.revision ?? 0) !== (observed?.revision ?? 0)) return false
    transaction.set(ref, { schemaVersion: 1, revision: (observed?.revision ?? 0) + 1,
      cursor, updatedAt: now })
    return true
  })
  return { attempted: page.docs.length, advanced, cursor }
}
