import { isCanonicalProfileMediaPath } from '@holalocal/firebase-contract'
import { HttpsError } from 'firebase-functions/v2/https'
import { deleteExactGeneration, exactGenerationExists } from './canonicalMediaStorage.js'
import { hasUnsettledProfilePromotion, profileSessionId, MEDIA_SESSION_COLLECTION } from './mediaUploadSessions.js'

// Compensation is safe to repeat only after the copy has returned and its exact
// generation is durable. A copying/legacy record requires manual reconciliation;
// observing a current object (or absence) cannot prove a remote rewrite settled.
export async function compensateProfilePromotion({
  db, uid, requestId, bucket, remove = deleteExactGeneration,
  exactExists = exactGenerationExists, now = new Date(), counts = null,
}) {
  const ref = db.doc(`${MEDIA_SESSION_COLLECTION}/${profileSessionId(uid)}`)
  const session = (await ref.get()).data()
  if (session?.requestId !== requestId || session.promotionObligation !== 'compensating') return
  if (session.principalUid !== uid || !isCanonicalProfileMediaPath(session.canonicalPath, uid)
    || !/^[1-9][0-9]*$/.test(String(session.promotedGeneration))) {
    throw new HttpsError('failed-precondition', 'media-compensation-evidence-invalid')
  }
  const target = { path: session.canonicalPath, generation: session.promotedGeneration, bucket }
  if (counts) counts.attempted += 1
  try {
    await remove(target)
    if (counts) counts.deleted += 1
  } catch (error) {
    // A replacement's precondition failure is not permission to delete it.
    // Absence is sufficient here only because the copy outcome is already known.
    if (Number(error?.code) !== 412 || await exactExists(target)) throw error
    if (counts) counts.alreadyMissing += 1
  }
  await db.runTransaction(async (transaction) => {
    const fresh = (await transaction.get(ref)).data()
    if (fresh?.requestId !== requestId || fresh.promotionObligation !== 'compensating'
      || fresh.promotedGeneration !== session.promotedGeneration) return
    transaction.update(ref, { state: 'failed', promotionObligation: 'settled', updatedAt: now })
  })
}

export async function settleProfilePromotionForDeletion({ db, uid, bucket, counts = null }) {
  const ref = db.doc(`${MEDIA_SESSION_COLLECTION}/${profileSessionId(uid)}`)
  const compensation = await db.runTransaction(async (transaction) => {
    const [user, snapshot] = await Promise.all([
      transaction.get(db.doc(`users/${uid}`)), transaction.get(ref),
    ])
    // Admission reads this same user record. The finalizer's restriction cannot
    // race an already committed admission past this check. Cancellation is not
    // permitted while finalizing. Standalone cleanup of active users fails shut.
    if (user.exists && user.data()?.accountStatus === 'active' && user.data()?.deletionRequestedAt == null) {
      throw new HttpsError('failed-precondition', 'media-deletion-restriction-required')
    }
    const session = snapshot.data()
    if (!hasUnsettledProfilePromotion(session ? { ...session, kind: 'profile' } : null)) return null
    if (session.promotionProtocol !== 1
      || !['copied', 'compensating'].includes(session.promotionObligation)) {
      throw new HttpsError('aborted', 'media-promotion-outcome-unresolved')
    }
    transaction.update(ref, { promotionObligation: 'compensating' })
    return session.requestId
  })
  if (compensation) await compensateProfilePromotion({ db, uid, requestId: compensation, bucket, counts })
}
