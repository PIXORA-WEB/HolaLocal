import assert from 'node:assert/strict'
import test from 'node:test'
import { FakeFirestore } from './fakeFirestore.mjs'
import { OpenMediaFirestore, openCutoverControl } from './mediaCutoverFixture.mjs'
import { MEDIA_CUTOVER_CONTROL, checkMediaCutover } from '../src/mediaCutoverControls.js'
import { prepareProfileMediaUpload, finalizeProfileMedia } from '../src/profileMedia.js'
import { finalizeAccountDeletion } from '../src/accountDeletionFinalizer.js'
import { completeAccountDeletionWorkflow } from '../src/accountDeletionPrimitives.js'
import { recoverAuthorisedAccountDeletions, runAccountDeletionRecovery } from '../src/accountDeletionRecovery.js'
import { cancelAccountDeletion } from '../src/accountDeletion.js'
import { cleanFinalizedStagingObject, sweepExpiredMediaSessions } from '../src/stagingMediaMaintenance.js'
import { DEFERRED_STAGING_EVENTS } from '../src/stagingMediaDeferral.js'
import { handlePrepareProfileMediaUpload, handleFinalizeAccountDeletion } from '../src/index.js'

const user = { accountStatus: 'active', deletionRequestedAt: null, profilePhoto: null }
const hold = { schemaVersion: 1, uid: 'u1', state: 'held', version: 1, reason: 'legacy-outcome-unknown', provenance: 'synthetic investigation', createdAt: new Date(0), updatedAt: new Date(0) }
const sessionPath = 'mediaUploadSessions/profile_u1'
const event = { name: 'users/u1/staging/profile/avatar', generation: '12', metadata: { holalocalUploadSession: 'request-12345678' } }
const bucket = { file(path) { return { getMetadata: async () => { throw Object.assign(Error('missing'), { code: 404 }) }, delete: async () => assert.fail('unexpected delete '+path) } } }
const input = db => ({ uid: 'u1', db, bucket })
const runDeletion = db => finalizeAccountDeletion({ uid: 'u1', adminUid: 'admin', claims: { admin: true }, expectedRequestVersion: 1, db })
const scopeKeys = ['profileAdmission', 'profileSettlement', 'accountDeletion', 'stagingProcessing']

for (const kind of ['absent', 'closed', 'malformed', 'unavailable']) {
  test(`${kind} controls fail closed at direct core, callable and internal recovery boundaries`, async () => {
    const db = new FakeFirestore({ 'users/u1': user })
    if (kind === 'closed') db.store.set(MEDIA_CUTOVER_CONTROL, { ...openCutoverControl(), ...Object.fromEntries(scopeKeys.map(k => [k, false])) })
    if (kind === 'malformed') db.store.set(MEDIA_CUTOVER_CONTROL, { ...openCutoverControl(), version: '1' })
    if (kind === 'unavailable') db.runTransaction = async () => { throw Error('unavailable') }
    for (const scope of scopeKeys) await assert.rejects(checkMediaCutover({ db, scope, uid: 'u1' }))
    await assert.rejects(prepareProfileMediaUpload(input(db)))
    await assert.rejects(handlePrepareProfileMediaUpload({ auth: { uid: 'u1' }, data: {} }, { db, bucket }))
    await assert.rejects(runDeletion(db))
    await assert.rejects(handleFinalizeAccountDeletion({ auth: { uid: 'admin', token: { admin: true } }, data: { uid: 'u1', expectedRequestVersion: 1 } }, { db }))
    await assert.rejects(recoverAuthorisedAccountDeletions({ db, auth: {} }))
    assert.equal(db.data(sessionPath), undefined)
    assert.deepEqual(await sweepExpiredMediaSessions({ db, bucket }), { expired: 0, deferred: true })
  })
}

test('held account without a session cannot prepare, finalize deletion or bypass via cancellation', async () => {
  const db = new OpenMediaFirestore({ 'users/u1': { ...user, deletionRequestedAt: new Date(0) },
    'accountDeletionRequests/u1': { state: 'requested', requestVersion: 1 }, 'mediaCutoverHolds/u1': hold })
  await assert.rejects(runDeletion(db), /held/)
  await cancelAccountDeletion({ uid: 'u1', db })
  assert.equal(db.data('users/u1').deletionRequestedAt, null)
  assert.deepEqual(db.data('mediaCutoverHolds/u1'), hold)
  await assert.rejects(prepareProfileMediaUpload(input(db)), /held/)
  assert.equal(db.data(sessionPath), undefined)
})

test('malformed and incomplete released holds never authorize work', async () => {
  for (const row of [{}, { ...hold, state: 'released' }, { ...hold, uid: 'other' }]) {
    const db = new OpenMediaFirestore({ 'users/u1': user, 'mediaCutoverHolds/u1': row })
    await assert.rejects(prepareProfileMediaUpload(input(db)), /held/)
  }
})

test('admission rechecks a control transition inside its actual session transaction', async () => {
  const db = new OpenMediaFirestore({ 'users/u1': user })
  const changingBucket = { file: () => ({ getMetadata: async () => {
    db.store.set(MEDIA_CUTOVER_CONTROL, { ...openCutoverControl(), profileAdmission: false })
    throw Object.assign(Error('missing'), { code: 404 })
  } }) }
  await assert.rejects(prepareProfileMediaUpload({ uid: 'u1', db, bucket: changingBucket }), /closed/)
  assert.equal(db.data(sessionPath), undefined)
})

test('admission rechecks a newly installed hold instead of trusting earlier open reads', async () => {
  const db = new OpenMediaFirestore({ 'users/u1': user })
  const changingBucket = { file: () => ({ getMetadata: async () => {
    db.store.set('mediaCutoverHolds/u1', hold)
    throw Object.assign(Error('missing'), { code: 404 })
  } }) }
  await assert.rejects(prepareProfileMediaUpload({ uid: 'u1', db, bucket: changingBucket }), /held/)
  assert.equal(db.data(sessionPath), undefined)
})

test('closing settlement preserves the returned generation; reopening settles without another copy', async () => {
  const db = new OpenMediaFirestore({ 'users/u1': user })
  const prepared = await prepareProfileMediaUpload(input(db))
  await db.doc(sessionPath).update({ state: 'uploaded', stagingGeneration: '12' })
  let copies = 0
  const args = { ...input(db), ...prepared, stagingGeneration: '12', clean: async () => ({ metageneration: '2' }), clearContext: async () => {}, remove: async () => {},
    promote: async () => { copies++; db.store.set(MEDIA_CUTOVER_CONTROL, { ...openCutoverControl(), profileSettlement: false }); return { generation: '13' } } }
  await assert.rejects(finalizeProfileMedia(args), /closed/)
  assert.equal(db.data(sessionPath).promotionObligation, 'copied')
  assert.equal(db.data('users/u1').profilePhoto, null)
  db.store.set(MEDIA_CUTOVER_CONTROL, { ...openCutoverControl(), profileAdmission: false })
  const readBucket = { file: name => ({ getMetadata: async () => [{ name, generation: '13', contentType: 'image/png', size: '1', metadata: {} }] }) }
  await finalizeProfileMedia({ ...args, bucket: readBucket })
  assert.equal(copies, 1); assert.equal(db.data(sessionPath).state, 'completed')
})

test('terminal deletion transaction cannot bypass a hold or closed execution control', async () => {
  const db = new OpenMediaFirestore({ 'accountDeletionRequests/u1': { state: 'finalizing', leaseId: 'lease', requestVersion: 2, lastCompletedStep: 'firebase_auth_removed' }, 'mediaCutoverHolds/u1': hold })
  await assert.rejects(completeAccountDeletionWorkflow({ uid: 'u1', leaseId: 'lease', expectedRequestVersion: 2, db }), /held/)
  assert.equal(db.data('accountDeletionRequests/u1').state, 'finalizing')
})

test('closed events are durably deduplicated and replay with compatible scheduled processing', async () => {
  const db = new FakeFirestore()
  assert.deepEqual(await cleanFinalizedStagingObject({ db, object: event, bucket }), { status: 'deferred' })
  assert.deepEqual(await cleanFinalizedStagingObject({ db, object: event, bucket }), { status: 'deferred' })
  const rows = () => [...db.store.entries()].filter(([key]) => key.startsWith(DEFERRED_STAGING_EVENTS+'/'))
  assert.equal(rows().length, 1); assert.equal(rows()[0][1].version, 1)
  db.store.set(MEDIA_CUTOVER_CONTROL, openCutoverControl())
  db.store.set(sessionPath, { kind: 'profile', principalUid: 'u1', requestId: 'request-12345678', state: 'uploaded', stagingPath: event.name, stagingGeneration: '12', expiresAt: new Date(Date.now()+100000) })
  await sweepExpiredMediaSessions({ db, bucket }) // already-clean session needs no Storage operation
  assert.equal(rows()[0][1].state, 'completed')
  assert.equal(rows()[0][1].version, 2)
  assert.deepEqual(await cleanFinalizedStagingObject({ db, object: event, bucket }), { status: 'already-clean' })
})

test('held deferred work and expired copying obligations survive scheduled processing', async () => {
  const db = new OpenMediaFirestore({ 'mediaCutoverHolds/u1': hold, [sessionPath]: {
    kind: 'profile', principalUid: 'u1', requestId: 'request-12345678', state: 'promoting', promotionObligation: 'copying', stagingPath: event.name, stagingGeneration: '12', expiresAt: new Date(0) } })
  assert.equal((await cleanFinalizedStagingObject({ db, object: event, bucket })).status, 'deferred')
  await sweepExpiredMediaSessions({ db, bucket })
  assert.equal(db.data(sessionPath).promotionObligation, 'copying')
  assert.deepEqual(db.data('mediaCutoverHolds/u1'), hold)
  assert.equal([...db.store.values()].find(r => r.object)?.state, 'pending')
})

test('durable intake failure is not acknowledged, and recovery remains independently disabled', async () => {
  const db = { runTransaction: async () => { throw Error('persistence unavailable') }, doc: x => x }
  await assert.rejects(cleanFinalizedStagingObject({ db, object: event, bucket }), /persistence unavailable/)
  assert.deepEqual(await runAccountDeletionRecovery({ env: {}, createDatabase: () => assert.fail() }), { disabled: true })
})


test('unavailable control reads defer work after durable intake rather than losing the event', async () => {
  const db = new OpenMediaFirestore()
  const original = db.runTransaction.bind(db)
  db.runTransaction = callback => original(transaction => {
    const get = transaction.get.bind(transaction)
    transaction.get = ref => {
      if (ref.path === MEDIA_CUTOVER_CONTROL) throw Error('control read unavailable')
      return get(ref)
    }
    return callback(transaction)
  })
  assert.equal((await cleanFinalizedStagingObject({ db, object: event, bucket })).status, 'deferred')
  assert.equal([...db.store.values()].find(row => row.object)?.state, 'pending')
})

test('a held copied generation cannot publish or compensate through owner retry', async () => {
  const db = new OpenMediaFirestore({ 'users/u1': user, 'mediaCutoverHolds/u1': hold,
    [sessionPath]: { kind: 'profile', principalUid: 'u1', requestId: 'request', stagingGeneration: '12',
      promotedGeneration: '13', canonicalPath: 'users/u1/profile/avatar/a', promotionObligation: 'copied', state: 'promoted' } })
  await assert.rejects(finalizeProfileMedia({ ...input(db), requestId: 'request', stagingGeneration: '12',
    promote: async () => assert.fail(), remove: async () => assert.fail() }), /held/)
  assert.equal(db.data(sessionPath).promotionObligation, 'copied')
  assert.equal(db.data('users/u1').profilePhoto, null)
})
