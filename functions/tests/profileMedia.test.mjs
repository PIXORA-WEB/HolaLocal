import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FakeFirestore } from './fakeFirestore.mjs'
import { finalizeProfileMedia, prepareProfileMediaUpload } from '../src/profileMedia.js'

function user(overrides = {}) { return { accountStatus: 'active', deletionRequestedAt: null, profilePhoto: null, photoURL: null, ...overrides } }
function missingCanonicalBucket() {
  return { file() { return { async getMetadata() { throw Object.assign(new Error('missing'), { code: 404 }) }, async delete() {} } } }
}
async function bindUpload(db, generation = '12') {
  await db.doc('mediaUploadSessions/profile_u1').update({ stagingGeneration: generation, state: 'uploaded' })
}

test('profile prepare derives bounded paths and captures canonical absence', async () => {
  const db = new FakeFirestore({ 'users/u1': user() })
  const result = await prepareProfileMediaUpload({ uid: 'u1', db, bucket: missingCanonicalBucket(), now: new Date(1000) })
  assert.equal(result.stagingPath, 'users/u1/staging/profile/avatar')
  const session = db.data('mediaUploadSessions/profile_u1')
  assert.equal(session.canonicalPath, 'users/u1/profile/avatar/a')
  assert.equal(session.expectedCanonicalGeneration, '0')
})

test('profile finalization promotes before the trusted descriptor write and is retry-idempotent', async () => {
  const db = new FakeFirestore({ 'users/u1': user() })
  const prepared = await prepareProfileMediaUpload({ uid: 'u1', db, bucket: missingCanonicalBucket(), now: new Date(1000) })
  await bindUpload(db)
  const calls = []
  const result = await finalizeProfileMedia({
    uid: 'u1', requestId: prepared.requestId, stagingGeneration: '12', db,
    bucket: missingCanonicalBucket(), now: new Date(2000),
    clean: async () => ({ metageneration: '2' }),
    promote: async () => { calls.push('promote'); return { generation: '13' } },
    clearContext: async () => calls.push('clear-context'),
    remove: async () => calls.push('remove'),
  })
  assert.equal(result.generation, '13')
  assert.deepEqual(db.data('users/u1').profilePhoto, { storagePath: 'users/u1/profile/avatar/a' })
  assert.equal(db.data('users/u1').photoURL, null)
  assert.deepEqual(calls, ['promote', 'clear-context', 'remove'])
  const retry = await finalizeProfileMedia({ uid: 'u1', requestId: prepared.requestId, stagingGeneration: '12', db, bucket: missingCanonicalBucket(), now: new Date(3000) })
  assert.equal(retry.generation, '13')
})

test('cleanup or promotion failure never writes a new descriptor', async () => {
  for (const phase of ['clean', 'promote']) {
    const db = new FakeFirestore({ 'users/u1': user({ profilePhoto: { storagePath: 'users/u1/profile/avatar' } }) })
    const prepared = await prepareProfileMediaUpload({ uid: 'u1', db, bucket: missingCanonicalBucket(), now: new Date(1000) })
    await bindUpload(db)
    await assert.rejects(finalizeProfileMedia({
      uid: 'u1', requestId: prepared.requestId, stagingGeneration: '12', db,
      bucket: missingCanonicalBucket(), now: new Date(2000),
      clean: async () => { if (phase === 'clean') throw new Error('cleanup'); return { metageneration: '2' } },
      promote: async () => { throw new Error('promotion') },
      clearContext: async () => undefined,
    }))
    assert.deepEqual(db.data('users/u1').profilePhoto, { storagePath: 'users/u1/profile/avatar' })
  }
})

test('profile replacements alternate A/B and a rejected authority switch preserves the old descriptor', async () => {
  const metadata = new Map([
    ['users/u1/profile/avatar/a', { name: 'users/u1/profile/avatar/a', generation: '7' }],
  ])
  const bucket = { file(path) { return { async getMetadata() {
    const value = metadata.get(path)
    if (!value) throw Object.assign(new Error('missing'), { code: 404 })
    return [value]
  } } } }
  const db = new FakeFirestore({ 'users/u1': user({ profilePhoto: { storagePath: 'users/u1/profile/avatar/a' } }) })
  const prepared = await prepareProfileMediaUpload({ uid: 'u1', db, bucket, now: new Date(1000) })
  const session = db.data('mediaUploadSessions/profile_u1')
  assert.equal(session.canonicalPath, 'users/u1/profile/avatar/b')
  assert.equal(session.expectedAuthorityPath, 'users/u1/profile/avatar/a')
  await bindUpload(db)
  await assert.rejects(finalizeProfileMedia({
    uid: 'u1', requestId: prepared.requestId, stagingGeneration: '12', db, bucket,
    now: new Date(2000), clean: async () => ({ metageneration: '2' }),
    promote: async () => ({ generation: '13' }),
    clearContext: async () => db.doc('users/u1').update({ deletionRequestedAt: new Date(1500) }),
  }), /account-not-active/)
  assert.deepEqual(db.data('users/u1').profilePhoto, { storagePath: 'users/u1/profile/avatar/a' })
  assert.equal(db.data('mediaUploadSessions/profile_u1').state, 'failed')

  const reverseDb = new FakeFirestore({
    'users/u1': user({ profilePhoto: { storagePath: 'users/u1/profile/avatar/b' } }),
  })
  await prepareProfileMediaUpload({ uid: 'u1', db: reverseDb, bucket, now: new Date(3000) })
  assert.equal(
    reverseDb.data('mediaUploadSessions/profile_u1').canonicalPath,
    'users/u1/profile/avatar/a',
  )
})

test('promotion checkpoint reconciles after a transient Firestore authority-switch failure', async () => {
  const backing = new FakeFirestore({ 'users/u1': user() })
  let failTransaction = false
  const db = {
    doc: (...args) => backing.doc(...args),
    runTransaction: async (callback) => {
      if (failTransaction) { failTransaction = false; throw new Error('transient-firestore') }
      return backing.runTransaction(callback)
    },
  }
  const prepared = await prepareProfileMediaUpload({ uid: 'u1', db, bucket: missingCanonicalBucket(), now: new Date(1000) })
  await bindUpload(backing)
  let promotions = 0
  failTransaction = true
  await assert.rejects(finalizeProfileMedia({ uid: 'u1', requestId: prepared.requestId,
    stagingGeneration: '12', db, bucket: missingCanonicalBucket(), now: new Date(2000),
    clean: async () => ({ metageneration: '2' }), promote: async () => { promotions += 1; return { generation: '13' } },
    clearContext: async () => undefined }), /transient-firestore/)
  assert.equal(backing.data('mediaUploadSessions/profile_u1').state, 'promoted')
  const canonicalBucket = { file(path) { return { async getMetadata() { return [{
    name: path, generation: '13', metageneration: '2', size: '100', contentType: 'image/png', metadata: {},
  }] }, async delete() {} } } }
  await finalizeProfileMedia({ uid: 'u1', requestId: prepared.requestId, stagingGeneration: '12',
    db, bucket: canonicalBucket, now: new Date(3000), clearContext: async () => undefined,
    remove: async () => undefined })
  assert.equal(promotions, 1)
  assert.deepEqual(backing.data('users/u1').profilePhoto, { storagePath: 'users/u1/profile/avatar/a' })
})

test('finalizer safely binds its exact marked generation when the Storage trigger is delayed', async () => {
  const db = new FakeFirestore({ 'users/u1': user() })
  const request = await prepareProfileMediaUpload({ uid: 'u1', db, bucket: missingCanonicalBucket(), now: new Date(1000) })
  const bucket = { file(path) { return { async getMetadata() {
    if (path === 'users/u1/staging/profile/avatar') return [{ name: path, generation: '12',
      metageneration: '1', size: '100', contentType: 'image/png',
      metadata: { holalocalUploadSession: request.requestId } }]
    throw Object.assign(new Error('missing'), { code: 404 })
  }, async delete() {} } } }
  await finalizeProfileMedia({ uid: 'u1', requestId: request.requestId, stagingGeneration: '12',
    db, bucket, now: new Date(2000), clean: async () => ({ metageneration: '2' }),
    promote: async () => ({ generation: '13' }), clearContext: async () => undefined,
    remove: async () => undefined })
  assert.deepEqual(db.data('users/u1').profilePhoto, { storagePath: 'users/u1/profile/avatar/a' })
})
