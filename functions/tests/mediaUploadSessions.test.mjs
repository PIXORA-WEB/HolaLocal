import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FakeFirestore } from './fakeFirestore.mjs'
import {
  assertFinalizableSession, prepareBoundedMediaSession, profileSessionId,
  recordFinalizedStagingGeneration,
} from '../src/mediaUploadSessions.js'

test('bounded session permits one active operation and supersedes only expired state', async () => {
  const db = new FakeFirestore()
  const input = { db, sessionId: profileSessionId('u1'), principalUid: 'u1', kind: 'profile', stagingPath: 'users/u1/staging/profile/avatar', canonicalPath: 'users/u1/profile/avatar', expectedCanonicalGeneration: 0, now: new Date(1000), requestId: 'r1' }
  assert.deepEqual(await prepareBoundedMediaSession(input), { requestId: 'r1', stagingPath: input.stagingPath })
  await assert.rejects(prepareBoundedMediaSession({ ...input, requestId: 'r2', now: new Date(2000) }), /media-upload-already-active/)
  const session = db.data('mediaUploadSessions/profile_u1')
  session.expiresAt = new Date(0)
  await prepareBoundedMediaSession({ ...input, requestId: 'r3', now: new Date(3000) })
  assert.equal(db.data('mediaUploadSessions/profile_u1').requestId, 'r3')
  assert.equal(db.data('mediaUploadSessions/profile_u1').version, 2)
})

test('the real trigger checkpoint requires the current request marker and exact event generation', async () => {
  const db = new FakeFirestore()
  const input = { db, sessionId: profileSessionId('u1'), principalUid: 'u1', kind: 'profile',
    stagingPath: 'users/u1/staging/profile/avatar', canonicalPath: 'users/u1/profile/avatar/a',
    expectedCanonicalGeneration: 0, now: new Date(1000), requestId: 'new-request' }
  await prepareBoundedMediaSession(input)
  const parsedPath = { kind: 'profile', uid: 'u1' }
  await recordFinalizedStagingGeneration({ db, parsedPath, path: input.stagingPath,
    generation: '5', uploadSessionId: 'old-request', now: new Date(2000) })
  assert.equal(db.data('mediaUploadSessions/profile_u1').stagingGeneration, undefined)
  assert.throws(() => assertFinalizableSession(db.data('mediaUploadSessions/profile_u1'), {
    requestId: 'new-request', principalUid: 'u1', stagingGeneration: '5', now: 2000,
  }), /media-generation-mismatch/)
  await recordFinalizedStagingGeneration({ db, parsedPath, path: input.stagingPath,
    generation: '6', uploadSessionId: 'new-request', now: new Date(2000) })
  assert.equal(assertFinalizableSession(db.data('mediaUploadSessions/profile_u1'), {
    requestId: 'new-request', principalUid: 'u1', stagingGeneration: '6', now: 2000,
  }), 'active')
})
