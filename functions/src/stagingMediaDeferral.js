import { FieldPath } from 'firebase-admin/firestore'
import { createHash } from 'node:crypto'
import { HttpsError } from 'firebase-functions/v2/https'
import { checkMediaCutover } from './mediaCutoverControls.js'
import { businessSessionId, MEDIA_SESSION_COLLECTION } from './mediaUploadSessions.js'
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

export async function retainStagingEvent({ db, object, marker, now }) {
  if (!db) throw new HttpsError('failed-precondition', 'media-cutover-closed')
  const id = createHash('sha256').update(JSON.stringify([object.bucket ?? null, object.name, String(object.generation)])).digest('hex')
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

export async function finishStagingEvent({ db, ref, now }) {
  await db.runTransaction(async transaction => {
    const current = (await transaction.get(ref)).data()
    if (!current || current.state === 'completed') return
    transaction.update(ref, { state: 'completed', version: current.version + 1, updatedAt: now })
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
