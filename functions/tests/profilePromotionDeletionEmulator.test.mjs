import assert from 'node:assert/strict'
import test from 'node:test'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { getStorage } from 'firebase-admin/storage'
import { prepareProfileMediaUpload, finalizeProfileMedia } from '../src/profileMedia.js'
import { requestAccountDeletion } from '../src/accountDeletion.js'
import { finalizeAccountDeletion } from '../src/accountDeletionFinalizer.js'
import { cleanupUserMedia } from '../src/accountDeletionPrimitives.js'
import { promoteCleanGeneration } from '../src/canonicalMediaStorage.js'

const enabled = process.env.HOLALOCAL_PROFILE_COORDINATION_EMULATOR === '1'
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
test('real Firestore admission/restriction and persisted deletion checkpoints; bounded Storage evidence', { skip: !enabled }, async t => {
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-holalocal-functions')
  for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST']) assert.match(process.env[key], /^127\.0\.0\.1:/)
  const app = initializeApp(), db = getFirestore(app), auth = getAuth(app), bucket = getStorage(app).bucket()
  const seed = async uid => {
    await auth.createUser({ uid, email: `${uid}@example.invalid`, emailVerified: true })
    const stamp = Timestamp.now()
    await db.doc(`users/${uid}`).set({ accountStatus: 'active', businessId: null, termsAccepted: true, privacyAccepted: true, termsVersion: '1.0', privacyVersion: '1.0', termsAcceptedAt: stamp, privacyAcceptedAt: stamp })
    const prepared = await prepareProfileMediaUpload({ uid, db, bucket })
    await bucket.file(prepared.stagingPath).save(Buffer.from('synthetic image'), { resumable: false, metadata: { contentType: 'image/png', metadata: { holalocalUploadSession: prepared.requestId } } })
    const [metadata] = await bucket.file(prepared.stagingPath).getMetadata()
    await db.doc(`mediaUploadSessions/profile_${uid}`).update({ state: 'uploaded', stagingGeneration: String(metadata.generation) })
    return { uid, db, bucket, requestId: prepared.requestId, stagingGeneration: String(metadata.generation) }
  }
  try {
    await t.test('admission first pins cleanup before its snapshot; real emulator rewrite failure remains ambiguous', async () => {
      const input = await seed('coordination-real-copy'), entered = deferred(), release = deferred()
      const session = db.doc(`mediaUploadSessions/profile_${input.uid}`)
      const promotion = finalizeProfileMedia({ ...input, promote: async args => { entered.resolve(); await release.promise; return promoteCleanGeneration(args) } }).catch(error => error)
      await entered.promise
      await assert.rejects(finalizeProfileMedia(input), /outcome-unresolved/)
      await assert.rejects(prepareProfileMediaUpload(input), /already-active/)
      const request = await requestAccountDeletion({ uid: input.uid, emailVerified: true, authTime: Math.floor(Date.now() / 1000), db })
      let listings = 0
      const observedBucket = { ...bucket, getFiles: async options => { listings++; return bucket.getFiles(options) } }
      const invoke = version => finalizeAccountDeletion({ uid: input.uid, db, adminUid: 'synthetic-admin', claims: { admin: true }, expectedRequestVersion: version,
        primitives: { cleanupMedia: args => cleanupUserMedia({ ...args, bucket: observedBucket }) } })
      const failed = await invoke(request.request.requestVersion)
      assert.equal(failed.state, 'failed_retryable'); assert.equal(failed.failureCode, 'profile_media_cleanup_failed')
      assert.equal(listings, 0)
      release.resolve()
      // This emulator copies bytes but drops contexts. Do not bless its ignored
      // generation preconditions or treat this as successful production promotion.
      const error = await promotion
      assert.match(error.message, /media-promotion-context-missing/)
      assert.equal((await session.get()).data().promotionObligation, 'copying')
      assert.equal((await invoke(failed.requestVersion)).state, 'failed_retryable')
      assert.equal((await db.doc(`users/${input.uid}`).get()).exists, true)
      const [files] = await bucket.getFiles({ prefix: `users/${input.uid}/` })
      assert.equal(files.some(file => file.name.includes('/profile/avatar/a')), true)
      console.log('real-copy evidence', JSON.stringify(files.map(file => ({ name: file.name, generation: file.metadata.generation }))))
    })
    await t.test('restriction first prevents a prepared request from dispatching copy', async () => {
      const input = await seed('coordination-restriction-first')
      const request = await requestAccountDeletion({ uid: input.uid, emailVerified: true, authTime: Math.floor(Date.now() / 1000), db })
      let copied = false
      await assert.rejects(finalizeProfileMedia({ ...input, promote: async () => { copied = true } }), /account-not-active/)
      assert.equal(copied, false)
      const result = await finalizeAccountDeletion({ uid: input.uid, db, adminUid: 'synthetic-admin', claims: { admin: true }, expectedRequestVersion: request.request.requestVersion })
      assert.equal(result.state, 'completed')
    })
    await t.test('known-generation compensation failure and retry use real Firestore and supported Storage deletes', async () => {
      const input = await seed('coordination-known-result')
      let request
      await assert.rejects(finalizeProfileMedia({ ...input,
        // Deliberate adapter: real save/getMetadata, NOT a production rewrite.
        promote: async ({ canonicalPath }) => {
          await bucket.file(canonicalPath).save(Buffer.from('synthetic canonical'), { resumable: false, metadata: { contentType: 'image/png' } })
          const [metadata] = await bucket.file(canonicalPath).getMetadata()
          request = await requestAccountDeletion({ uid: input.uid, emailVerified: true, authTime: Math.floor(Date.now() / 1000), db })
          return { generation: String(metadata.generation) }
        }, remove: async () => { throw Error('injected delete failure') },
      }), /injected delete failure/)
      assert.equal((await db.doc(`mediaUploadSessions/profile_${input.uid}`).get()).data().promotionObligation, 'compensating')
      const result = await finalizeAccountDeletion({ uid: input.uid, db, adminUid: 'synthetic-admin', claims: { admin: true }, expectedRequestVersion: request.request.requestVersion })
      assert.equal(result.state, 'completed')
      assert.equal((await bucket.getFiles({ prefix: `users/${input.uid}/` }))[0].length, 0)
      assert.equal((await db.doc(`users/${input.uid}`).get()).exists, false)
    })
  } finally { await db.terminate(); await deleteApp(app) }
})
