import { getStorage } from 'firebase-admin/storage'
import { parseStagingMediaPath } from '@holalocal/firebase-contract'
import {
  cleanStagingGeneration, deleteExactGeneration, exactGenerationExists,
  uploadSessionMarker, verifyCanonicalImageMetadata,
} from './canonicalMediaStorage.js'
import {
  checkpointStagingCleanupResponsibility,
  CONFLICTING_STAGING_CLEANUP_COLLECTION,
  MEDIA_SESSION_COLLECTION,
  markStagingGenerationClean,
  reconcileConflictingStagingCleanup,
  recordConflictingStagingCleanupFailure,
  recordStagingCleanupFailure,
} from './mediaUploadSessions.js'

function isNotFound(error) {
  return Number(error?.code) === 404
}

export async function cleanFinalizedStagingObject({
  object, db, bucket = getStorage().bucket(), clean = cleanStagingGeneration,
  remove = deleteExactGeneration,
  checkpoint = checkpointStagingCleanupResponsibility,
  markClean = markStagingGenerationClean,
  recordFailure = recordStagingCleanupFailure,
  recordConflictFailure = recordConflictingStagingCleanupFailure,
  reconcileConflict = reconcileConflictingStagingCleanup,
  exactExists = exactGenerationExists,
  now = new Date(),
}) {
  const path = object?.name
  const generation = object?.generation
  const parsedPath = parseStagingMediaPath(path)
  if (!parsedPath || !generation) return { status: 'ignored' }
  const [authoritative] = await bucket.file(path, { generation }).getMetadata()
  const marker = uploadSessionMarker(authoritative)
  const checkpointResult = db
    ? await checkpoint({ db, parsedPath, path, generation, uploadSessionId: marker, now })
    : { status: 'ignored' }
  if (['already-clean', 'already-retry'].includes(checkpointResult.status)) {
    return { status: checkpointResult.status }
  }
  if (checkpointResult.status === 'conflict') {
    let cleanupError = null
    try {
      verifyCanonicalImageMetadata(authoritative, { path, generation, allowUploadSession: true })
      await clean({ path, generation, bucket })
    } catch (error) {
      cleanupError = error
    }
    let deletionError = null
    try {
      await remove({ path, generation, bucket })
    } catch (error) {
      if (!isNotFound(error)) {
        deletionError = await unresolvedConditionalFailure({
          error, path, generation, bucket, exactExists,
        })
      }
    }
    if (!deletionError) {
      await reconcileConflict({
        db, cleanupObligationId: checkpointResult.cleanupObligationId, path, generation,
      })
      return { status: 'conflict-removed' }
    }
    await recordConflictFailure({
      db, cleanupObligationId: checkpointResult.cleanupObligationId,
      path, generation, deletionError, now,
    })
    throw cleanupError ?? deletionError
  }
  try {
    verifyCanonicalImageMetadata(authoritative, { path, generation, allowUploadSession: true })
    await clean({ path, generation, bucket })
    if (db && ['checkpointed', 'already-pending'].includes(checkpointResult.status)) {
      await markClean({ db, parsedPath, path, generation, uploadSessionId: marker, now })
    }
    return { status: 'cleaned' }
  } catch (error) {
    let deletionError = null
    try {
      await remove({ path, generation, bucket })
    } catch (failure) {
      if (!isNotFound(failure)) deletionError = failure
    }
    if (db && checkpointResult.status === 'checkpointed') {
      await recordFailure({
        db, parsedPath, path, generation, uploadSessionId: marker, deletionError, now,
      })
    }
    throw error
  }
}

export async function sweepExpiredMediaSessions({
  db, bucket = getStorage().bucket(), now = new Date(), remove = deleteExactGeneration,
  exactExists = exactGenerationExists,
}) {
  const snapshots = await db.collection(MEDIA_SESSION_COLLECTION)
    .where('expiresAt', '<=', now).limit(200).get()
  let expired = 0
  for (const snapshot of snapshots.docs) {
    const session = snapshot.data()
    // Promotion checkpoints remain live recovery state after ordinary upload
    // expiry. Finalization, not the orphan sweeper, owns their cleanup.
    if (['promoting', 'promoted'].includes(session.state)) continue
    let cleanupError = null
    const stagingPathValid = !session.stagingPath || !session.stagingGeneration
      || parseStagingMediaPath(session.stagingPath) != null
    const targets = [
      ...(session.stagingPath && session.stagingGeneration && stagingPathValid
        ? [{ path: session.stagingPath, generation: session.stagingGeneration, kind: 'staging' }]
        : []),
      ...(session.cleanupOldPath && session.cleanupOldGeneration
        ? [{ path: session.cleanupOldPath, generation: session.cleanupOldGeneration, kind: 'old-authority' }]
        : []),
    ]
    if (!stagingPathValid) cleanupError = new Error('invalid-staging-cleanup-path')
    for (const target of targets) {
      try {
        await remove({ ...target, bucket })
      } catch (error) {
        if (isNotFound(error)) continue
        if (Number(error?.code) === 412) {
          try {
            if (!await exactExists({ path: target.path, generation: target.generation, bucket })) continue
          } catch {
            // Absence was not proven; retain the original conditional-delete failure.
          }
        }
        cleanupError ??= error
      }
    }
    if (cleanupError) {
      await db.runTransaction(async (transaction) => {
        const ref = db.doc(`${MEDIA_SESSION_COLLECTION}/${snapshot.id}`)
        const fresh = await transaction.get(ref)
        if (!fresh.exists || !sameCleanupCheckpoint(fresh.data(), session)) return
        transaction.update(ref, {
          state: 'cleanup_retry',
          cleanupPending: true,
          cleanupFailure: Number(cleanupError?.code) === 412 ? 'generation-mismatch' : 'transient',
          updatedAt: now,
        })
      })
      continue
    }
    await db.runTransaction(async (transaction) => {
      const fresh = await transaction.get(db.doc(`${MEDIA_SESSION_COLLECTION}/${snapshot.id}`))
      if (!fresh.exists || !sameCleanupCheckpoint(fresh.data(), session)) return
      transaction.delete(db.doc(`${MEDIA_SESSION_COLLECTION}/${snapshot.id}`))
      expired += 1
    })
  }
  const conflictSnapshots = await db.collection(CONFLICTING_STAGING_CLEANUP_COLLECTION)
    .where('cleanupAfter', '<=', now).limit(200).get()
  for (const snapshot of conflictSnapshots.docs) {
    const cleanup = snapshot.data()
    if (!parseStagingMediaPath(cleanup.stagingPath) || !cleanup.stagingGeneration) continue
    let cleanupError = null
    try {
      await remove({
        path: cleanup.stagingPath, generation: cleanup.stagingGeneration,
        kind: 'conflicting-staging', bucket,
      })
    } catch (error) {
      if (!isNotFound(error)) {
        cleanupError = await unresolvedConditionalFailure({
          error, path: cleanup.stagingPath, generation: cleanup.stagingGeneration,
          bucket, exactExists,
        })
      }
    }
    await db.runTransaction(async (transaction) => {
      const ref = db.doc(`${CONFLICTING_STAGING_CLEANUP_COLLECTION}/${snapshot.id}`)
      const fresh = await transaction.get(ref)
      if (!fresh.exists || !sameConflictCleanup(fresh.data(), cleanup)) return
      if (cleanupError) {
        transaction.update(ref, {
          state: 'cleanup_retry',
          cleanupFailure: Number(cleanupError?.code) === 412 ? 'generation-mismatch' : 'transient',
          updatedAt: now,
        })
      } else {
        transaction.delete(ref)
      }
    })
  }
  return { expired }
}

async function unresolvedConditionalFailure({ error, path, generation, bucket, exactExists }) {
  if (Number(error?.code) !== 412) return error
  try {
    if (!await exactExists({ path, generation, bucket })) return null
  } catch {
    // Absence was not proven; retain the original conditional-delete failure.
  }
  return error
}

function sameCleanupCheckpoint(fresh, observed) {
  return fresh?.requestId === observed.requestId
    && fresh?.state === observed.state
    && fresh?.stagingPath === observed.stagingPath
    && String(fresh?.stagingGeneration ?? '') === String(observed.stagingGeneration ?? '')
    && fresh?.cleanupOldPath === observed.cleanupOldPath
    && String(fresh?.cleanupOldGeneration ?? '') === String(observed.cleanupOldGeneration ?? '')
}

function sameConflictCleanup(fresh, observed) {
  return fresh?.requestId === observed.requestId
    && fresh?.sessionId === observed.sessionId
    && fresh?.stagingPath === observed.stagingPath
    && String(fresh?.stagingGeneration ?? '') === String(observed.stagingGeneration ?? '')
    && fresh?.state === observed.state
}
