import { getStorage } from 'firebase-admin/storage'
import { parseStagingMediaPath } from '@holalocal/firebase-contract'
import {
  cleanStagingGeneration, deleteExactGeneration, uploadSessionMarker, verifyCanonicalImageMetadata,
} from './canonicalMediaStorage.js'
import {
  MEDIA_SESSION_COLLECTION,
  recordFinalizedStagingGeneration,
} from './mediaUploadSessions.js'

export async function cleanFinalizedStagingObject({
  object, db, bucket = getStorage().bucket(), clean = cleanStagingGeneration,
  remove = deleteExactGeneration, record = recordFinalizedStagingGeneration, now = new Date(),
}) {
  const path = object?.name
  const generation = object?.generation
  const parsedPath = parseStagingMediaPath(path)
  if (!parsedPath || !generation) return { status: 'ignored' }
  try {
    const [authoritative] = await bucket.file(path, { generation }).getMetadata()
    verifyCanonicalImageMetadata(authoritative, { path, generation, allowUploadSession: true })
    const marker = uploadSessionMarker(authoritative)
    await clean({ path, generation, bucket })
    if (db) await record({ db, parsedPath, path, generation, uploadSessionId: marker, now })
    return { status: 'cleaned' }
  } catch (error) {
    await remove({ path, generation, bucket }).catch(() => undefined)
    throw error
  }
}

export async function sweepExpiredMediaSessions({
  db, bucket = getStorage().bucket(), now = new Date(), remove = deleteExactGeneration,
}) {
  const snapshots = await db.collection(MEDIA_SESSION_COLLECTION)
    .where('expiresAt', '<=', now).limit(200).get()
  let expired = 0
  for (const snapshot of snapshots.docs) {
    const session = snapshot.data()
    let cleanupError = null
    const targets = [
      ...(session.stagingPath && session.stagingGeneration
        ? [{ path: session.stagingPath, generation: session.stagingGeneration }]
        : []),
      ...(session.cleanupOldPath && session.cleanupOldGeneration
        ? [{ path: session.cleanupOldPath, generation: session.cleanupOldGeneration }]
        : []),
    ]
    for (const target of targets) {
      try {
        await remove({ ...target, bucket })
      } catch (error) {
        cleanupError ??= error
      }
    }
    if (cleanupError) {
      await db.runTransaction(async (transaction) => {
        const ref = db.doc(`${MEDIA_SESSION_COLLECTION}/${snapshot.id}`)
        const fresh = await transaction.get(ref)
        if (!fresh.exists || fresh.data()?.requestId !== session.requestId) return
        transaction.update(ref, {
          state: 'cleanup_retry',
          cleanupFailure: Number(cleanupError?.code) === 412 ? 'generation-mismatch' : 'transient',
          updatedAt: now,
        })
      })
      continue
    }
    await db.runTransaction(async (transaction) => {
      const fresh = await transaction.get(db.doc(`${MEDIA_SESSION_COLLECTION}/${snapshot.id}`))
      if (!fresh.exists || fresh.data()?.requestId !== session.requestId) return
      transaction.delete(db.doc(`${MEDIA_SESSION_COLLECTION}/${snapshot.id}`))
      expired += 1
    })
  }
  return { expired }
}
