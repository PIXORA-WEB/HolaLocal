import assert from 'node:assert/strict'
import test from 'node:test'
import { Timestamp } from 'firebase-admin/firestore'
import { OpenMediaFirestore as FakeFirestore } from './mediaCutoverFixture.mjs'
import { prepareProfileMediaUpload, finalizeProfileMedia } from '../src/profileMedia.js'
import { cleanupUserMedia } from '../src/accountDeletionPrimitives.js'
import { finalizeAccountDeletion } from '../src/accountDeletionFinalizer.js'
import { customerReviewCleanupPath } from '../src/customerReviewDeletion.js'
import { compensateProfilePromotion } from '../src/profilePromotionCoordination.js'
import { sweepExpiredMediaSessions } from '../src/stagingMediaMaintenance.js'
import { promoteCleanGeneration } from '../src/canonicalMediaStorage.js'

// Deterministic adapters model conditional Storage; these are not transport tests.
const ref = 'mediaUploadSessions/profile_u1'
const path = 'users/u1/profile/avatar/a'
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
async function fixture() {
  const db = new FakeFirestore({ 'users/u1': { accountStatus: 'active', profilePhoto: null } })
  const objects = new Map(); const calls = []
  const bucket = {
    async getFiles() { calls.push('list'); return [[...objects.keys()].map(name => ({ async delete() { objects.delete(name) } }))] },
    file(name, options = {}) { return {
      async getMetadata() {
        const generation = objects.get(name)
        if (!generation || (options.generation && options.generation !== generation)) throw Object.assign(Error('missing'), { code: 404 })
        return [{ name, generation, metageneration: '1', size: '1', contentType: 'image/png', metadata: {} }]
      },
      async delete() {
        calls.push(['delete', name, options])
        if (options.generation && objects.get(name) && objects.get(name) !== options.generation) throw Object.assign(Error('replacement'), { code: 412 })
        objects.delete(name)
      },
    } },
  }
  const prepared = await prepareProfileMediaUpload({ uid: 'u1', db, bucket })
  await db.doc(ref).update({ state: 'uploaded', stagingGeneration: '12' })
  const input = { uid: 'u1', requestId: prepared.requestId, stagingGeneration: '12', db, bucket,
    clean: async () => ({ metageneration: '2' }), clearContext: async () => {},
    promote: async () => { calls.push('copy'); objects.set(path, '13'); return { generation: '13' } } }
  return { db, objects, calls, bucket, input, restrict: () => db.doc('users/u1').update({ deletionRequestedAt: new Date() }) }
}

test('admitted copy blocks deletion listing and finalizer; settles compensation then retry completes', async () => {
  const f = await fixture(), entered = deferred(), release = deferred()
  const promotion = finalizeProfileMedia({ ...f.input, promote: async args => {
    entered.resolve(); await release.promise; return f.input.promote(args)
  } }).catch(error => error)
  await entered.promise; await f.restrict()
  const stamp = Timestamp.now()
  Object.assign(f.db.data('users/u1'), { termsAccepted: true, privacyAccepted: true, termsVersion: '1.0', privacyVersion: '1.0', termsAcceptedAt: stamp, privacyAcceptedAt: stamp })
  f.db.store.set('accountDeletionRequests/u1', { uid: 'u1', state: 'requested', requestVersion: 1 })
  const later = []
  const invoke = version => finalizeAccountDeletion({ uid: 'u1', adminUid: 'admin', claims: { admin: true }, expectedRequestVersion: version, db: f.db,
    primitives: { cleanupMedia: args => cleanupUserMedia({ ...args, bucket: f.bucket }),
      cleanupCustomerReviews: async () => { later.push('reviews'); f.db.store.set(customerReviewCleanupPath('u1'), { complete: true }); return { complete: true } },
      deleteAuthUser: async () => { later.push('auth'); return { ok: true } } } })
  const failed = await invoke(1)
  assert.equal(failed.failureCode, 'profile_media_cleanup_failed')
  assert.equal(failed.state, 'failed_retryable'); assert.deepEqual(later, [])
  assert.equal(f.calls.includes('list'), false); assert.ok(f.db.data('users/u1'))
  release.resolve(); assert.match((await promotion).message, /account-or-media-authority-changed/)
  assert.equal(f.objects.has(path), false)
  assert.equal(f.db.data(ref).promotionObligation, 'settled')
  assert.equal((await invoke(failed.requestVersion)).state, 'completed')
  assert.deepEqual(later, ['reviews', 'auth']); assert.equal(f.db.data(ref), undefined)
})

test('restriction before admission prevents copy despite an earlier prepared session', async () => {
  const f = await fixture(); await f.restrict()
  await assert.rejects(finalizeProfileMedia(f.input), /account-not-active/)
  assert.equal(f.calls.includes('copy'), false)
  assert.equal((await cleanupUserMedia({ uid: 'u1', db: f.db, bucket: f.bucket })).ok, true)
})

test('concurrent finalize and replacement cannot reuse an unresolved operation even after expiry', async () => {
  const f = await fixture(), entered = deferred(), release = deferred()
  const first = finalizeProfileMedia({ ...f.input, promote: async args => { entered.resolve(); await release.promise; return f.input.promote(args) } })
  await entered.promise
  await f.db.doc(ref).update({ expiresAt: new Date(0) })
  await assert.rejects(finalizeProfileMedia(f.input), /outcome-unresolved/)
  await assert.rejects(prepareProfileMediaUpload({ uid: 'u1', db: f.db, bucket: f.bucket }), /already-active/)
  await sweepExpiredMediaSessions({ db: f.db, bucket: f.bucket })
  assert.equal(f.db.data(ref).promotionObligation, 'copying')
  release.resolve(); await first
  assert.equal(f.calls.filter(c => c === 'copy').length, 1)
})

for (const fault of ['lost-copy-response', 'generation-checkpoint']) {
  test(`${fault} pins evidence and never retries an uncertain copy`, async () => {
    const f = await fixture(); const transaction = f.db.runTransaction.bind(f.db)
    if (fault === 'generation-checkpoint') f.db.runTransaction = callback => {
      if (f.objects.has(path) && f.db.data(ref).promotionObligation === 'copying') throw Error('checkpoint unavailable')
      return transaction(callback)
    }
    await assert.rejects(finalizeProfileMedia({ ...f.input, promote: async args => {
      const result = await f.input.promote(args)
      if (fault === 'lost-copy-response') throw Error('lost response')
      return result
    } }))
    f.db.runTransaction = transaction
    assert.equal(f.db.data(ref).promotionObligation, 'copying'); assert.equal(f.objects.get(path), '13')
    await f.restrict()
    const cleanup = await cleanupUserMedia({ uid: 'u1', db: f.db, bucket: f.bucket })
    assert.equal(cleanup.retryable, true); assert.equal(cleanup.counts.failed, 1)
    await assert.rejects(finalizeProfileMedia(f.input), /outcome-unresolved/)
    assert.equal(f.calls.filter(c => c === 'copy').length, 1)
    assert.equal(f.calls.includes('list'), false)
  })
}

test('failed compensation remains durable and deletion retry removes only the known generation', async () => {
  const f = await fixture()
  await assert.rejects(finalizeProfileMedia({ ...f.input,
    promote: async args => { const result = await f.input.promote(args); await f.restrict(); return result },
    remove: async () => { throw Error('delete unavailable') },
  }), /delete unavailable/)
  assert.equal(f.db.data(ref).promotionObligation, 'compensating'); assert.equal(f.objects.get(path), '13')
  const cleaned = await cleanupUserMedia({ uid: 'u1', db: f.db, bucket: f.bucket })
  assert.equal(cleaned.ok, true)
  assert.deepEqual(cleaned.counts, { attempted: 2, deleted: 2, alreadyMissing: 0, failed: 0 })
  assert.equal(f.objects.has(path), false)
  assert.deepEqual(f.calls.find(c => Array.isArray(c) && c[1] === path)[2], { generation: '13', preconditionOpts: { ifGenerationMatch: '13' } })
})

test('compensation preserves a replacement and persists settlement only after exact absence', async () => {
  const f = await fixture()
  await assert.rejects(finalizeProfileMedia({ ...f.input,
    promote: async args => { const result = await f.input.promote(args); await f.restrict(); return result },
    remove: async () => { throw Error('pause') },
  }))
  f.objects.set(path, '99')
  await compensateProfilePromotion({ db: f.db, uid: 'u1', requestId: f.input.requestId, bucket: f.bucket })
  assert.equal(f.objects.get(path), '99'); assert.equal(f.db.data(ref).promotionObligation, 'settled')
})

test('pre-copy cleaning failure can retry; normal publication stays idempotent', async () => {
  const f = await fixture()
  await assert.rejects(finalizeProfileMedia({ ...f.input, clean: async () => { throw Error('clean unavailable') } }))
  assert.equal(f.db.data(ref).state, 'uploaded'); assert.equal(f.calls.includes('copy'), false)
  await finalizeProfileMedia(f.input); await finalizeProfileMedia(f.input)
  assert.equal(f.calls.filter(c => c === 'copy').length, 1)
  assert.deepEqual(f.db.data('users/u1').profilePhoto, { storagePath: path })
})

test('legacy uncertain records remain pinned through preparation, cleanup and sweep', async () => {
  for (const state of ['promoting', 'promoted', 'failed']) {
    const f = await fixture(); await f.db.doc(ref).update({ state, promotedGeneration: '13', expiresAt: new Date(0) })
    await assert.rejects(prepareProfileMediaUpload({ uid: 'u1', db: f.db, bucket: f.bucket }), /already-active/)
    await f.restrict()
    assert.equal((await cleanupUserMedia({ uid: 'u1', db: f.db, bucket: f.bucket })).ok, false)
    await sweepExpiredMediaSessions({ db: f.db, bucket: f.bucket })
    assert.equal(f.db.data(ref).state, state)
  }
})

test('production rewrite request disables hidden retries for coordinated profile copies', async () => {
  let request
  const promotionId = '12345678-1234-1234-1234-123456789012'
  const bucket = { name: 'synthetic', file(name) { return { name, bucket: { name: 'synthetic' }, request(options, callback) {
    request = options; callback(null, { done: true, resource: { generation: '13' } })
  } } } }
  await promoteCleanGeneration({ bucket, stagingPath: 'source', stagingGeneration: '12', stagingMetageneration: '2', canonicalPath: path, expectedCanonicalGeneration: '0', promotionId, singleAttempt: true,
    readMetadata: async (_bucket, name, generation) => ({ name, generation, metageneration: '2', contentType: 'image/png', size: '1', metadata: {}, contexts: { custom: { 'holalocal-media-request': { value: promotionId } } } }),
  })
  assert.equal(request.maxRetries, 0)
  assert.deepEqual(request.qs, { sourceGeneration: '12', ifSourceGenerationMatch: '12', ifSourceMetagenerationMatch: '2', ifGenerationMatch: '0' })
  assert.equal(request.json.contexts.custom['holalocal-media-request'].value, promotionId)
})


test('lost compensation checkpoint retries exact deletion without resurrecting publication after cancellation', async () => {
  const f = await fixture()
  await assert.rejects(finalizeProfileMedia({ ...f.input,
    promote: async args => { const result = await f.input.promote(args); await f.restrict(); return result },
    remove: async () => { throw Error('pause compensation') },
  }))
  const transaction = f.db.runTransaction.bind(f.db)
  f.db.runTransaction = async callback => {
    if (!f.objects.has(path)) throw Error('checkpoint unavailable')
    return transaction(callback)
  }
  await assert.rejects(compensateProfilePromotion({ db: f.db, uid: 'u1', requestId: f.input.requestId, bucket: f.bucket }), /checkpoint unavailable/)
  assert.equal(f.objects.has(path), false)
  assert.equal(f.db.data(ref).promotionObligation, 'compensating')
  f.db.runTransaction = transaction
  // Model cancellation's removal of the restriction. A committed compensation
  // decision still cannot become a publication decision.
  await f.db.doc('users/u1').update({ deletionRequestedAt: null })
  await assert.rejects(finalizeProfileMedia(f.input), /account-or-media-authority-changed/)
  assert.equal(f.db.data(ref).promotionObligation, 'settled')
  assert.equal(f.db.data('users/u1').profilePhoto, null)
  assert.equal(f.calls.filter(c => c === 'copy').length, 1)
})

test('abandoned copy is blocked even with no object and an expired upload', async () => {
  const f = await fixture()
  await f.db.doc(ref).update({ state: 'promoting', promotionProtocol: 1, promotionObligation: 'copying', expiresAt: new Date(0) })
  await f.restrict()
  assert.equal((await cleanupUserMedia({ uid: 'u1', db: f.db, bucket: f.bucket })).retryable, true)
  await sweepExpiredMediaSessions({ db: f.db, bucket: f.bucket })
  assert.equal(f.db.data(ref).promotionObligation, 'copying')
  assert.equal(f.calls.includes('list'), false)
})
