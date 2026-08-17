import { getStorage } from 'firebase-admin/storage'
import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import {
  buildCanonicalProfileMediaSlotPath,
  buildStagingProfileMediaPath,
  inactiveCanonicalMediaSlot,
  isCanonicalProfileMediaPath,
  parseLegacyFirebaseProfileMediaUrl,
} from '@holalocal/firebase-contract'
import {
  clearPromotionContext,
  cleanStagingGeneration,
  deleteExactGeneration,
  promoteCleanGeneration,
  verifyCanonicalImageMetadata,
  uploadSessionMarker,
} from './canonicalMediaStorage.js'
import {
  assertFinalizableSession,
  MEDIA_SESSION_COLLECTION,
  prepareBoundedMediaSession,
  profileSessionId,
  recordFinalizedStagingGeneration,
} from './mediaUploadSessions.js'

async function canonicalGeneration(bucket, path) {
  try {
    const [metadata] = await bucket.file(path).getMetadata()
    return String(metadata.generation)
  } catch (error) {
    if (Number(error?.code) === 404) return '0'
    throw error
  }
}

export async function prepareProfileMediaUpload({ uid, db, bucket = getStorage().bucket(), now }) {
  const userRef = db.doc(`users/${uid}`)
  const user = await userRef.get()
  if (!user.exists || user.data()?.accountStatus !== 'active' || user.data()?.deletionRequestedAt != null) {
    throw new HttpsError('failed-precondition', 'account-not-active')
  }
  const authorityPath = isCanonicalProfileMediaPath(user.data()?.profilePhoto?.storagePath, uid)
    ? user.data().profilePhoto.storagePath : null
  const mediaSlot = inactiveCanonicalMediaSlot(authorityPath, (parsed) => parsed.kind === 'profile' && parsed.uid === uid)
  const canonicalPath = buildCanonicalProfileMediaSlotPath(uid, mediaSlot)
  return prepareBoundedMediaSession({
    db,
    sessionId: profileSessionId(uid),
    principalUid: uid,
    kind: 'profile',
    stagingPath: buildStagingProfileMediaPath(uid),
    canonicalPath,
    expectedCanonicalGeneration: await canonicalGeneration(bucket, canonicalPath),
    expectedAuthorityPath: authorityPath,
    expectedAuthorityGeneration: authorityPath ? await canonicalGeneration(bucket, authorityPath) : null,
    now,
  })
}

async function deleteLegacyProfileMedia(user, uid, bucket) {
  const legacy = parseLegacyFirebaseProfileMediaUrl(
    user?.profilePhoto?.downloadUrl ?? user?.photoURL,
    uid,
  )
  if (!legacy) return
  await bucket.file(legacy.storagePath).delete({ ignoreNotFound: true }).catch(() => undefined)
}

export async function finalizeProfileMedia({
  uid, requestId, stagingGeneration, db, bucket = getStorage().bucket(),
  clean = cleanStagingGeneration, promote = promoteCleanGeneration, remove = deleteExactGeneration,
  clearContext = clearPromotionContext,
  now = new Date(),
}) {
  const sessionRef = db.doc(`${MEDIA_SESSION_COLLECTION}/${profileSessionId(uid)}`)
  const userRef = db.doc(`users/${uid}`)
  const [sessionSnapshot, userSnapshot] = await Promise.all([sessionRef.get(), userRef.get()])
  let session = sessionSnapshot.data()
  if (session && !session.stagingGeneration) {
    const [metadata] = await bucket.file(session.stagingPath, { generation: stagingGeneration }).getMetadata()
    await recordFinalizedStagingGeneration({ db, parsedPath: { kind: 'profile', uid },
      path: session.stagingPath, generation: stagingGeneration,
      uploadSessionId: uploadSessionMarker(metadata), now })
    session = (await sessionRef.get()).data()
  }
  const status = assertFinalizableSession(session, {
    requestId, principalUid: uid, stagingGeneration, now: now.getTime(),
  })
  if (!userSnapshot.exists || userSnapshot.data()?.accountStatus !== 'active'
    || userSnapshot.data()?.deletionRequestedAt != null) {
    throw new HttpsError('failed-precondition', 'account-not-active')
  }
  if (status === 'completed') {
    return { ok: true, storagePath: session.canonicalPath, generation: session.promotedGeneration }
  }

  let promotedGeneration = session.promotedGeneration
  if (!promotedGeneration) {
    const cleaned = await clean({ path: session.stagingPath, generation: stagingGeneration, bucket })
    await sessionRef.update({
      stagingGeneration: String(stagingGeneration),
      state: 'promoting',
      updatedAt: now,
    })
    const promoted = await promote({
      stagingPath: session.stagingPath,
      stagingGeneration,
      stagingMetageneration: String(cleaned.metageneration),
      canonicalPath: session.canonicalPath,
      expectedCanonicalGeneration: session.expectedCanonicalGeneration,
      promotionId: requestId,
      bucket,
    })
    promotedGeneration = promoted.generation
    await sessionRef.update({ promotedGeneration, state: 'promoted', updatedAt: now })
  } else {
    const [metadata] = await bucket.file(session.canonicalPath, { generation: promotedGeneration }).getMetadata()
    verifyCanonicalImageMetadata(metadata, {
      path: session.canonicalPath, generation: promotedGeneration, requireTokenFree: true,
    })
  }

  await clearContext({ path: session.canonicalPath, generation: promotedGeneration, bucket })

  try {
    await db.runTransaction(async (transaction) => {
    const [freshSession, freshUser] = await Promise.all([
      transaction.get(sessionRef), transaction.get(userRef),
    ])
    const data = freshSession.data()
    if (data?.requestId !== requestId || data?.promotedGeneration !== promotedGeneration) {
      throw new HttpsError('aborted', 'media-session-stale')
    }
    if (!freshUser.exists || freshUser.data()?.accountStatus !== 'active'
      || freshUser.data()?.deletionRequestedAt != null) {
      throw new HttpsError('failed-precondition', 'account-not-active')
    }
    const currentAuthority = isCanonicalProfileMediaPath(freshUser.data()?.profilePhoto?.storagePath, uid)
      ? freshUser.data().profilePhoto.storagePath : null
    if (currentAuthority !== data.expectedAuthorityPath) {
      throw new HttpsError('aborted', 'media-authority-changed')
    }
    transaction.update(userRef, {
      photoURL: null,
      profilePhoto: { storagePath: session.canonicalPath },
      updatedAt: FieldValue.serverTimestamp(),
    })
    transaction.update(sessionRef, { state: 'completed', updatedAt: now })
    })
  } catch (error) {
    if (error instanceof HttpsError && ['failed-precondition', 'aborted', 'permission-denied'].includes(error.code)) {
      await sessionRef.update({ state: 'failed', updatedAt: now }).catch(() => undefined)
    }
    throw error
  }
  await deleteLegacyProfileMedia(userSnapshot.data(), uid, bucket)
  if (session.expectedAuthorityPath?.endsWith('/a') || session.expectedAuthorityPath?.endsWith('/b')) {
    await remove({
      path: session.expectedAuthorityPath,
      generation: session.expectedAuthorityGeneration,
      bucket,
    }).catch(() => undefined)
  }
  await remove({ path: session.stagingPath, generation: stagingGeneration, bucket }).catch(() => undefined)
  return { ok: true, storagePath: session.canonicalPath, generation: promotedGeneration }
}
