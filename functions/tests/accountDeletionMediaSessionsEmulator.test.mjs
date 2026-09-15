import assert from 'node:assert/strict'
import test from 'node:test'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { cleanupUserMedia } from '../src/accountDeletionPrimitives.js'
import { finalizeAccountDeletion } from '../src/accountDeletionFinalizer.js'
import { customerReviewCleanupPath } from '../src/customerReviewDeletion.js'

const enabled = process.env.HOLALOCAL_MEDIA_CLEANUP_EMULATOR === '1'
test('Firestore persists media cleanup failure and safe finalizer resumption', { skip: !enabled }, async () => {
  assert.match(process.env.GCLOUD_PROJECT ?? '', /^demo-/)
  assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? '', /^127\.0\.0\.1:\d+$/)
  const app = initializeApp({ projectId: process.env.GCLOUD_PROJECT }, 'media-cleanup-regression')
  const db = getFirestore(app), uid = 'synthetic-media-target'
  const sessionRef = db.doc(`mediaUploadSessions/profile_${uid}`)
  const userRef = db.doc(`users/${uid}`), requestRef = db.doc(`accountDeletionRequests/${uid}`)
  try {
    const stamp = Timestamp.fromMillis(1700000000000)
    await userRef.set({ businessId: null, termsAccepted: true, termsAcceptedAt: stamp, termsVersion: '1.0', privacyAccepted: true, privacyAcceptedAt: stamp, privacyVersion: '1.0' })
    await requestRef.set({ uid, state: 'requested', requestVersion: 1 })
    await sessionRef.set({ uid, state: 'completed', path: `users/${uid}/profile/image` })
    const unrelated = db.doc('mediaUploadSessions/profile_unrelated')
    await unrelated.set({ uid: 'unrelated', state: 'promoting' })
    let rejectDelete = true
    const mediaDb = { runTransaction: callback => db.runTransaction(callback), doc(path) {
      assert.ok([sessionRef.path, userRef.path].includes(path))
      const ref = db.doc(path)
      if (path === sessionRef.path) ref.delete = async () => {
        // Controlled boundary failure, not an emulator authorization test.
        if (rejectDelete) throw Object.assign(new Error('Synthetic unavailable'), { code: 14 })
        return db.doc(path).delete()
      }
      return ref
    } }
    const bucket = { getFiles: async ({ prefix }) => { assert.equal(prefix, `users/${uid}/`); return [[]] } }
    const calls = []
    const primitives = {
      cleanupMedia: () => cleanupUserMedia({ uid, db: mediaDb, bucket }),
      cleanupCustomerReviews: async () => { calls.push('reviews'); await db.doc(customerReviewCleanupPath(uid)).set({ complete: true }); return { complete: true } },
      deleteAuthUser: async () => { calls.push('auth'); return { ok: true } },
    }
    const invoke = expectedRequestVersion => finalizeAccountDeletion({ uid, adminUid: 'synthetic-admin', claims: { admin: true }, expectedRequestVersion, db, primitives })
    const failed = await invoke(1)
    assert.equal(failed.state, 'failed_retryable')
    assert.equal(failed.failureCode, 'profile_media_cleanup_failed')
    assert.equal((await requestRef.get()).data().lastCompletedStep, 'saved_businesses_cleaned')
    assert.equal((await requestRef.get()).data().cleanupCounts.failed, 1)
    assert.equal((await userRef.get()).exists, true)
    assert.equal((await sessionRef.get()).exists, true)
    assert.deepEqual(calls, [])
    rejectDelete = false
    assert.equal((await invoke(failed.requestVersion)).state, 'completed')
    assert.equal((await requestRef.get()).data().state, 'completed')
    assert.equal((await requestRef.get()).data().retainedConsentEvidence.termsVersion, '1.0')
    assert.equal((await userRef.get()).exists, false)
    assert.equal((await sessionRef.get()).exists, false)
    assert.deepEqual(calls, ['reviews', 'auth'])
    assert.deepEqual(await cleanupUserMedia({ uid, db, bucket }), { ok: true, retryable: false, counts: { attempted: 1, deleted: 1, alreadyMissing: 0, failed: 0 } })
    assert.equal((await unrelated.get()).data().state, 'promoting')
  } finally {
    await db.terminate()
    await deleteApp(app)
  }
})
