import assert from 'node:assert/strict'
import test from 'node:test'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { prepareProfileMediaUpload } from '../src/profileMedia.js'
import { MEDIA_CUTOVER_CONTROL } from '../src/mediaCutoverControls.js'
import { openCutoverControl } from './mediaCutoverFixture.mjs'
import { cleanFinalizedStagingObject, sweepExpiredMediaSessions } from '../src/stagingMediaMaintenance.js'
import { DEFERRED_STAGING_EVENTS } from '../src/stagingMediaDeferral.js'
const enabled = process.env.HOLALOCAL_CUTOVER_EMULATOR === '1'
test('cutover controls use actual Firestore transactions, durable deferral and client rules', { skip: !enabled }, async t => {
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-holalocal-functions')
  for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) assert.match(process.env[key], /^127\.0\.0\.1:/)
  const app = initializeApp(), db = getFirestore(app), auth = getAuth(app)
  const control = db.doc(MEDIA_CUTOVER_CONTROL)
  const uid = 'cutover-emulator-user'
  const hold = { schemaVersion: 1, uid, state: 'held', version: 1, reason: 'unknown', provenance: 'synthetic-local', createdAt: new Date(), updatedAt: new Date() }
  const absentBucket = { file: () => ({ getMetadata: async () => { throw Object.assign(Error('missing'), { code: 404 }) } }) }
  try {
    await t.test('absent control denies and open control permits real preparation transaction', async () => {
      await control.delete()
      await db.doc(`users/${uid}`).set({ accountStatus: 'active', deletionRequestedAt: null })
      await assert.rejects(prepareProfileMediaUpload({ uid, db, bucket: absentBucket }), /closed/)
      await control.set(openCutoverControl())
      await prepareProfileMediaUpload({ uid, db, bucket: absentBucket })
      assert.equal((await db.doc(`mediaUploadSessions/profile_${uid}`).get()).data().state, 'prepared')
    })
    await t.test('hold installed between precheck and transaction blocks replacement with session absent', async () => {
      await db.doc(`mediaUploadSessions/profile_${uid}`).delete()
      const changing = { file: () => ({ getMetadata: async () => {
        await db.doc(`mediaCutoverHolds/${uid}`).set(hold)
        throw Object.assign(Error('missing'), { code: 404 })
      } }) }
      await assert.rejects(prepareProfileMediaUpload({ uid, db, bucket: changing }), /held/)
      assert.equal((await db.doc(`mediaUploadSessions/profile_${uid}`).get()).exists, false)
      await db.doc(`mediaCutoverHolds/${uid}`).delete() // disposable test reset, not a release workflow
    })
    await t.test('concurrent closing write serializes with admission and later preparation is closed', async () => {
      let entered, release
      const barrier = new Promise(r => { release = r }), admissionRead = new Promise(r => { entered = r })
      let count = 0
      const wrapped = { doc: path => db.doc(path), runTransaction: callback => db.runTransaction(async tx => {
        // The second transaction is actual session admission (after precheck).
        const result = await callback(tx)
        if (++count === 2) { entered(); await barrier }
        return result
      }) }
      const prepared = prepareProfileMediaUpload({ uid, db: wrapped, bucket: absentBucket })
      await admissionRead
      const close = control.update({ profileAdmission: false, version: 2 })
      release(); await Promise.all([prepared, close])
      await assert.rejects(prepareProfileMediaUpload({ uid, db, bucket: absentBucket }), /closed/)
      assert.equal((await control.get()).data().version, 2)
    })
    await t.test('duplicate closed events persist one work item and compatible sweep completes it', async () => {
      await control.update({ stagingProcessing: false })
      const object = { name: `users/${uid}/staging/profile/avatar`, generation: '12', metadata: { holalocalUploadSession: 'synthetic-request' } }
      for (let i = 0; i < 2; i++) assert.equal((await cleanFinalizedStagingObject({ object, db, bucket: {} })).status, 'deferred')
      const pending = await db.collection(DEFERRED_STAGING_EVENTS).where('state', '==', 'pending').get()
      const matching = pending.docs.filter(d => d.data().object.name === object.name)
      assert.equal(matching.length, 1)
      await db.doc(`mediaUploadSessions/profile_${uid}`).set({ kind: 'profile', principalUid: uid, state: 'uploaded', stagingPath: object.name, stagingGeneration: '12', requestId: 'synthetic-request', expiresAt: new Date(Date.now()+3600000) })
      await control.update({ stagingProcessing: true })
      await sweepExpiredMediaSessions({ db, bucket: {} })
      assert.equal((await matching[0].ref.get()).data().state, 'completed')
    })
    await t.test('unauthenticated, owner and client-admin cannot read/write controls, holds or deferred records', async () => {
      const api = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:`
      const email = 'cutover-client@example.invalid', password = 'Synthetic-only-123456'
      const sign = async method => {
        const response = await fetch(api+method+'?key=synthetic-key', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) })
        assert.equal(response.status, 200); return response.json()
      }
      const account = await sign('signUp')
      await db.doc(`users/${account.localId}`).set({ accountStatus: 'active', deletionRequestedAt: null })
      const base = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/demo-holalocal-functions/databases/(default)/documents/`
      const get = (path, token) => fetch(base+path, { headers: token ? { authorization: `Bearer ${token}` } : {} })
      assert.equal((await get(`users/${account.localId}`, account.idToken)).status, 200)
      await auth.setCustomUserClaims(account.localId, { admin: true })
      const admin = await sign('signInWithPassword')
      for (const token of [null, account.idToken, admin.idToken]) for (const path of [MEDIA_CUTOVER_CONTROL, `mediaCutoverHolds/${account.localId}`, `${DEFERRED_STAGING_EVENTS}/synthetic`]) {
        assert.equal((await get(path, token)).status, 403)
        const headers = { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }
        assert.equal((await fetch(base+path, { method: 'PATCH', headers, body: JSON.stringify({ fields: { state: { stringValue: 'released' } } }) })).status, 403)
        assert.equal((await fetch(base+path, { method: 'DELETE', headers })).status, 403)
      }
    })
  } finally { await db.terminate(); await deleteApp(app) }
})
