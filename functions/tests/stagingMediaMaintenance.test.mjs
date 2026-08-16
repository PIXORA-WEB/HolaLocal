import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FakeFirestore } from './fakeFirestore.mjs'
import { cleanFinalizedStagingObject, sweepExpiredMediaSessions } from '../src/stagingMediaMaintenance.js'

function bucketWithMetadata(path, generation, marker) {
  return { file(requestPath) { return { async getMetadata() { return [{
    name: requestPath, generation, metageneration: '1', size: '100', contentType: 'image/png',
    metadata: marker == null ? {} : { holalocalUploadSession: marker },
  }] } } } }
}

test('finalize trigger touches staging exact generation only and ignores canonical/legacy paths', async () => {
  const calls = []
  const clean = async (input) => calls.push(['clean', input.path, input.generation])
  const path = 'users/u1/staging/profile/avatar'
  assert.deepEqual(await cleanFinalizedStagingObject({ object: { name: path, generation: '7' }, bucket: bucketWithMetadata(path, '7', 'request-12345678'), clean }), { status: 'cleaned' })
  assert.deepEqual(await cleanFinalizedStagingObject({ object: { name: 'users/u1/profile/avatar', generation: '8' }, bucket: {}, clean }), { status: 'ignored' })
  assert.deepEqual(calls, [['clean', 'users/u1/staging/profile/avatar', '7']])
})

test('finalize trigger records the newest generation for abandoned-upload sweeping', async () => {
  const db = new FakeFirestore({
    'mediaUploadSessions/profile_u1': {
      requestId: 'request', principalUid: 'u1', kind: 'profile', state: 'prepared',
      stagingPath: 'users/u1/staging/profile/avatar', expiresAt: new Date(9000),
    },
  })
  await cleanFinalizedStagingObject({
    object: { name: 'users/u1/staging/profile/avatar', generation: '7' },
    db, bucket: bucketWithMetadata('users/u1/staging/profile/avatar', '7', 'request'),
    clean: async () => undefined, now: new Date(2000),
  })
  assert.equal(db.data('mediaUploadSessions/profile_u1').stagingGeneration, '7')
  assert.equal(db.data('mediaUploadSessions/profile_u1').state, 'uploaded')
})

test('delayed, missing, and forged markers never bind a generation to a newer session', async () => {
  for (const marker of ['old-request', null, 'forged-request']) {
    const path = 'users/u1/staging/profile/avatar'
    const db = new FakeFirestore({ 'mediaUploadSessions/profile_u1': {
      requestId: 'new-request', principalUid: 'u1', kind: 'profile', state: 'prepared',
      stagingPath: path, expiresAt: new Date(9000),
    } })
    await cleanFinalizedStagingObject({ object: { name: path, generation: '7' }, db,
      bucket: bucketWithMetadata(path, '7', marker), clean: async () => undefined,
      now: new Date(2000) })
    assert.equal(db.data('mediaUploadSessions/profile_u1').stagingGeneration, undefined)
  }
})

test('repeated matching uploads bind only the newest exact generation', async () => {
  const path = 'users/u1/staging/profile/avatar'
  const db = new FakeFirestore({ 'mediaUploadSessions/profile_u1': {
    requestId: 'request', principalUid: 'u1', kind: 'profile', state: 'prepared',
    stagingPath: path, expiresAt: new Date(9000),
  } })
  for (const generation of ['7', '8', '7']) {
    await cleanFinalizedStagingObject({ object: { name: path, generation }, db,
      bucket: bucketWithMetadata(path, generation, 'request'), clean: async () => undefined,
      now: new Date(2000) })
  }
  assert.equal(db.data('mediaUploadSessions/profile_u1').stagingGeneration, '8')
})

test('invalid staging cleanup deletes only the event generation', async () => {
  const calls = []
  await assert.rejects(cleanFinalizedStagingObject({
    object: { name: 'businesses/b1/staging/photos/0', generation: '9' },
    bucket: bucketWithMetadata('businesses/b1/staging/photos/0', '9', 'request-12345678'),
    clean: async () => { throw new Error('invalid') },
    remove: async (input) => calls.push(input),
  }), /invalid/)
  assert.equal(calls[0].generation, '9')
})

test('sweeper retains retry responsibility on transient and generation-mismatch cleanup failures', async () => {
  for (const code of [500, 412]) {
    const db = new FakeFirestore({ 'mediaUploadSessions/profile_u1': {
      requestId: 'r', state: 'uploaded', expiresAt: new Date(1000),
      stagingPath: 'users/u1/staging/profile/avatar', stagingGeneration: '4',
    } })
    await sweepExpiredMediaSessions({ db, bucket: {}, now: new Date(5000),
      remove: async () => { throw Object.assign(new Error('cleanup'), { code }) } })
    assert.equal(db.data('mediaUploadSessions/profile_u1').state, 'cleanup_retry')
    assert.equal(db.data('mediaUploadSessions/profile_u1').cleanupFailure,
      code === 412 ? 'generation-mismatch' : 'transient')
    await sweepExpiredMediaSessions({ db, bucket: {}, now: new Date(6000), remove: async () => undefined })
    assert.equal(db.data('mediaUploadSessions/profile_u1'), undefined)
  }
})

test('sweeper preserves unexpired state and conditionally deletes recorded expired generation', async () => {
  const db = new FakeFirestore({
    'mediaUploadSessions/expired': { requestId: 'a', state: 'uploaded', expiresAt: new Date(1000), stagingPath: 'users/u1/staging/profile/avatar', stagingGeneration: '4' },
    'mediaUploadSessions/live': { requestId: 'b', state: 'uploaded', expiresAt: new Date(9000), stagingPath: 'users/u2/staging/profile/avatar', stagingGeneration: '5' },
  })
  const calls = []
  assert.deepEqual(await sweepExpiredMediaSessions({ db, bucket: {}, now: new Date(5000), remove: async (input) => calls.push(input) }), { expired: 1 })
  assert.equal(calls[0].generation, '4')
  assert.equal(db.data('mediaUploadSessions/expired'), undefined)
  assert.equal(db.data('mediaUploadSessions/live').state, 'uploaded')
})
