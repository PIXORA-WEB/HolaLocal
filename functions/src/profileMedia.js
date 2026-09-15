import { assertMediaCutover, checkMediaCutover } from './mediaCutoverControls.js'
import { compensateProfilePromotion } from './profilePromotionCoordination.js'
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
  hasUnsettledProfilePromotion,
  MEDIA_SESSION_COLLECTION,
  markStagingGenerationClean,
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
  await checkMediaCutover({ db, scope: 'profileAdmission', uid })
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
  await checkMediaCutover({ db, uid, scope: ['copied', 'compensating'].includes(session?.promotionObligation) ? 'profileSettlement' : 'profileAdmission' })
  if (session && !session.stagingGeneration) {
    const [metadata] = await bucket.file(session.stagingPath, { generation: stagingGeneration }).getMetadata()
    await recordFinalizedStagingGeneration({ db, parsedPath: { kind: 'profile', uid },
      path: session.stagingPath, generation: stagingGeneration,
      uploadSessionId: uploadSessionMarker(metadata), now })
    session = (await sessionRef.get()).data()
  }
  let cleanedStaging = null
  if (session?.state === 'cleanup_pending'
    && String(session.stagingGeneration) === String(stagingGeneration)) {
    cleanedStaging = await clean({ path: session.stagingPath, generation: stagingGeneration, bucket })
    await markStagingGenerationClean({
      db, parsedPath: { kind: 'profile', uid }, path: session.stagingPath,
      generation: stagingGeneration, uploadSessionId: requestId, now,
    })
    session = (await sessionRef.get()).data()
  }
  // Only uploaded -> copying admits a Storage operation. Every retry reads the
  // durable phase; no second invocation repeats a potentially outstanding copy.
  const admission = await db.runTransaction(async (transaction) => {
    const [freshSession, freshUser] = await Promise.all([
      transaction.get(sessionRef), transaction.get(userRef),
    ])
    const data = freshSession.data()
    if (!data || data.requestId !== requestId || data.principalUid !== uid
      || String(data.stagingGeneration) !== String(stagingGeneration)) {
      throw new HttpsError('failed-precondition', 'media-session-stale')
    }
    await assertMediaCutover(transaction, db,
      ['copied', 'compensating'].includes(data.promotionObligation) ? 'profileSettlement' : 'profileAdmission', uid)
    if (data.promotionObligation === 'compensating') return { session: data, copy: false }
    if (data.promotionObligation === 'copied') return { session: data, copy: false }
    if (hasUnsettledProfilePromotion(data)) {
      throw new HttpsError('aborted', 'media-promotion-outcome-unresolved')
    }
    if (!freshUser.exists || freshUser.data()?.accountStatus !== 'active'
      || freshUser.data()?.deletionRequestedAt != null) {
      throw new HttpsError('failed-precondition', 'account-not-active')
    }
    const status = assertFinalizableSession(data, {
      requestId, principalUid: uid, stagingGeneration, now: now.getTime(),
    })
    if (status === 'completed') return { session: data, completed: true }
    transaction.update(sessionRef, {
      state: 'promoting', promotionObligation: 'copying', promotionProtocol: 1,
      updatedAt: now,
    })
    return { session: data, copy: true }
  })
  session = admission.session
  if (admission.completed) {
    return { ok: true, storagePath: session.canonicalPath, generation: session.promotedGeneration }
  }
  let promotedGeneration = session.promotedGeneration
  if (admission.copy) {
    // Any rejection from here through checkpointing is ambiguous, including a
    // lost success response. Keep copying pinned; never infer absence/expiry.
    let cleaned
    try {
      cleaned = cleanedStaging ?? await clean({ path: session.stagingPath, generation: stagingGeneration, bucket })
    } catch (error) {
      // No copy was dispatched. If this write fails the pinned obligation is
      // deliberately retained; otherwise an ordinary upload retry is safe.
      await db.runTransaction(async (transaction) => {
        const fresh = (await transaction.get(sessionRef)).data()
        if (fresh?.requestId === requestId && fresh.promotionObligation === 'copying') {
          transaction.update(sessionRef, { state: 'uploaded', promotionObligation: 'settled', updatedAt: now })
        }
      })
      throw error
    }
    const promoted = await promote({
      stagingPath: session.stagingPath, stagingGeneration,
      stagingMetageneration: String(cleaned.metageneration),
      canonicalPath: session.canonicalPath,
      expectedCanonicalGeneration: session.expectedCanonicalGeneration,
      promotionId: requestId, singleAttempt: true, bucket,
    })
    promotedGeneration = String(promoted.generation)
    if (!/^[1-9][0-9]*$/.test(promotedGeneration)) {
      throw new HttpsError('internal', 'media-promotion-result-invalid')
    }
    await db.runTransaction(async (transaction) => {
      const fresh = (await transaction.get(sessionRef)).data()
      if (fresh?.requestId !== requestId || fresh.promotionObligation !== 'copying') {
        throw new HttpsError('aborted', 'media-session-stale')
      }
      transaction.update(sessionRef, {
        promotedGeneration, state: 'promoted', promotionObligation: 'copied', updatedAt: now,
      })
    })
  }

  if (!admission.copy && session.promotionObligation === 'copied') {
    const [metadata] = await bucket.file(session.canonicalPath, { generation: promotedGeneration }).getMetadata()
    verifyCanonicalImageMetadata(metadata, {
      path: session.canonicalPath, generation: promotedGeneration, requireTokenFree: true,
    })
  }

  // Publication and selection of compensation are mutually exclusive durable
  // decisions. A lost transaction response is safe to retry from its checkpoint.
  const outcome = await db.runTransaction(async (transaction) => {
    await assertMediaCutover(transaction, db, 'profileSettlement', uid)
    const [freshSession, freshUser] = await Promise.all([
      transaction.get(sessionRef), transaction.get(userRef),
    ])
    const data = freshSession.data()
    if (data?.requestId !== requestId || data?.promotedGeneration !== promotedGeneration) {
      throw new HttpsError('aborted', 'media-session-stale')
    }
    if (data.promotionObligation === 'settled') return data.state
    if (data.promotionObligation === 'compensating') return 'compensating'
    if (data.promotionObligation !== 'copied') throw new HttpsError('aborted', 'media-promotion-outcome-unresolved')
    const currentAuthority = isCanonicalProfileMediaPath(freshUser.data()?.profilePhoto?.storagePath, uid)
      ? freshUser.data().profilePhoto.storagePath : null
    if (!freshUser.exists || freshUser.data()?.accountStatus !== 'active'
      || freshUser.data()?.deletionRequestedAt != null || currentAuthority !== data.expectedAuthorityPath) {
      transaction.update(sessionRef, { promotionObligation: 'compensating', updatedAt: now })
      return 'compensating'
    }
    transaction.update(userRef, {
      photoURL: null,
      profilePhoto: { storagePath: session.canonicalPath },
      updatedAt: FieldValue.serverTimestamp(),
    })
    transaction.update(sessionRef, {
      state: 'completed', promotionObligation: 'settled', updatedAt: now,
    })
    return 'completed'
  })
  if (outcome !== 'completed') {
    await compensateProfilePromotion({ db, uid, requestId, bucket, remove, now })
    throw new HttpsError('failed-precondition', 'account-or-media-authority-changed')
  }
  // The copy has settled and publication is durable. Context cleanup cannot
  // create bytes; retain the context if best-effort cleanup fails.
  try { await checkMediaCutover({ db, scope: 'profileSettlement', uid }) } catch {
    return { ok: true, storagePath: session.canonicalPath, generation: promotedGeneration }
  }
  await clearContext({ path: session.canonicalPath, generation: promotedGeneration, bucket }).catch(() => undefined)
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
