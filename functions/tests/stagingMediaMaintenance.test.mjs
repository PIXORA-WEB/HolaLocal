import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FakeFirestore } from './fakeFirestore.mjs'
import { cleanFinalizedStagingObject, sweepExpiredMediaSessions } from '../src/stagingMediaMaintenance.js'
import {
  assertFinalizableSession, checkpointStagingCleanupResponsibility,
  CONFLICTING_STAGING_CLEANUP_COLLECTION,
} from '../src/mediaUploadSessions.js'

function bucketWithMetadata(path, generation, marker, extraMetadata = {}) {
  return { file(requestPath) { return { async getMetadata() { return [{
    name: requestPath, generation, metageneration: '1', size: '100', contentType: 'image/png',
    metadata: { ...(marker == null ? {} : { holalocalUploadSession: marker }), ...extraMetadata },
  }] } } } }
}

function finalizedObject(path, generation, marker, extraMetadata = {}) {
  return {
    name: path,
    generation,
    metadata: { ...(marker == null ? {} : { holalocalUploadSession: marker }), ...extraMetadata },
  }
}

function conflictDb(path, { withObligation = false } = {}) {
  return new FakeFirestore({
    'mediaUploadSessions/profile_u1': {
      requestId: 'request', principalUid: 'u1', kind: 'profile', state: 'uploaded',
      stagingPath: path, stagingGeneration: '7', expiresAt: new Date(9000),
    },
    ...(withObligation ? {
      [`${CONFLICTING_STAGING_CLEANUP_COLLECTION}/request_8`]: {
        requestId: 'request', sessionId: 'profile_u1', principalUid: 'u1', kind: 'profile',
        stagingPath: path, stagingGeneration: '8', state: 'cleanup_retry',
        cleanupFailure: 'transient', cleanupAfter: new Date(2000),
        createdAt: new Date(2000), updatedAt: new Date(2000),
      },
    } : {}),
  })
}

test('finalize trigger touches staging exact generation only and ignores canonical/legacy paths', async () => {
  const calls = []
  const clean = async (input) => calls.push(['clean', input.path, input.generation])
  const path = 'users/u1/staging/profile/avatar'
  assert.deepEqual(await cleanFinalizedStagingObject({ object: finalizedObject(path, '7', 'request-12345678'), bucket: bucketWithMetadata(path, '7', 'request-12345678'), clean }), { status: 'cleaned' })
  assert.deepEqual(await cleanFinalizedStagingObject({ object: { name: 'users/u1/profile/avatar', generation: '8' }, bucket: {}, clean }), { status: 'ignored' })
  assert.deepEqual(calls, [['clean', 'users/u1/staging/profile/avatar', '7']])
})

test('valid event checkpoints exact cleanup responsibility before authoritative metadata read failure', async () => {
  const path = 'users/u1/staging/profile/avatar'
  const db = new FakeFirestore({ 'mediaUploadSessions/profile_u1': {
    requestId: 'request-12345678', principalUid: 'u1', kind: 'profile', state: 'prepared',
    stagingPath: path, expiresAt: new Date(3000),
  } })
  const operations = []
  const bucket = { file(requestPath, { generation }) { return {
    async getMetadata() {
      operations.push(['metadata', requestPath, generation])
      throw Object.assign(new Error('storage-unavailable'), { code: 503 })
    },
  } } }

  await assert.rejects(cleanFinalizedStagingObject({
    object: finalizedObject(path, '7', 'request-12345678'), db, bucket,
    checkpoint: async (input) => {
      operations.push(['checkpoint', input.path, input.generation])
      return checkpointStagingCleanupResponsibility(input)
    },
    now: new Date(2000),
  }), /storage-unavailable/)

  assert.deepEqual(operations, [
    ['checkpoint', path, '7'],
    ['metadata', path, '7'],
  ])
  const pending = db.data('mediaUploadSessions/profile_u1')
  assert.equal(pending.state, 'cleanup_pending')
  assert.equal(pending.cleanupPending, true)
  assert.equal(pending.stagingPath, path)
  assert.equal(pending.stagingGeneration, '7')
  assert.throws(() => assertFinalizableSession(pending, {
    requestId: 'request-12345678', principalUid: 'u1', stagingGeneration: '7', now: 2000,
  }), /media-staging-not-clean/)

  const removals = []
  assert.deepEqual(await sweepExpiredMediaSessions({
    db, bucket: {}, now: new Date(4000),
    remove: async ({ path: targetPath, generation }) => removals.push({ path: targetPath, generation }),
  }), { expired: 1 })
  assert.deepEqual(removals, [{ path, generation: '7' }])
  assert.equal(db.data('mediaUploadSessions/profile_u1'), undefined)
})

test('conflicting generation obligation is durable before authoritative metadata read failure', async () => {
  const path = 'users/u1/staging/profile/avatar'
  const db = conflictDb(path)
  const bucket = { file() { return {
    async getMetadata() {
      throw Object.assign(new Error('storage-unavailable'), { code: 503 })
    },
  } } }

  await assert.rejects(cleanFinalizedStagingObject({
    object: finalizedObject(path, '8', 'request'), db, bucket, now: new Date(2000),
  }), /storage-unavailable/)

  const obligationPath = `${CONFLICTING_STAGING_CLEANUP_COLLECTION}/request_8`
  const obligation = db.data(obligationPath)
  assert.equal(obligation.state, 'cleanup_pending')
  assert.equal(obligation.stagingPath, path)
  assert.equal(obligation.stagingGeneration, '8')
  assert.equal(db.data('mediaUploadSessions/profile_u1').stagingGeneration, '7')

  const removals = []
  await sweepExpiredMediaSessions({
    db, bucket: {}, now: new Date(3000),
    remove: async ({ kind, path: targetPath, generation }) => {
      if (kind === 'conflicting-staging') removals.push({ path: targetPath, generation })
    },
  })
  assert.deepEqual(removals, [{ path, generation: '8' }])
  assert.equal(db.data(obligationPath), undefined)
  assert.equal(db.data('mediaUploadSessions/profile_u1').stagingGeneration, '7')
})

test('authoritative marker mismatch fails closed through exact-generation cleanup', async () => {
  const path = 'users/u1/staging/profile/avatar'
  const db = new FakeFirestore({ 'mediaUploadSessions/profile_u1': {
    requestId: 'request-12345678', principalUid: 'u1', kind: 'profile', state: 'prepared',
    stagingPath: path, expiresAt: new Date(9000),
  } })
  const removals = []
  let markedClean = false

  await assert.rejects(cleanFinalizedStagingObject({
    object: finalizedObject(path, '7', 'request-12345678'), db,
    bucket: bucketWithMetadata(path, '7', 'different-request'),
    clean: async () => { throw new Error('clean-must-not-run') },
    markClean: async () => { markedClean = true },
    remove: async ({ path: targetPath, generation }) => removals.push({ path: targetPath, generation }),
    now: new Date(2000),
  }), /media-upload-session-mismatch/)

  assert.equal(markedClean, false)
  assert.deepEqual(removals, [{ path, generation: '7' }])
  const failed = db.data('mediaUploadSessions/profile_u1')
  assert.equal(failed.state, 'failed')
  assert.equal(failed.stagingGeneration, '7')
  assert.notEqual(failed.state, 'uploaded')
})

test('finalize trigger records the newest generation for abandoned-upload sweeping', async () => {
  const db = new FakeFirestore({
    'mediaUploadSessions/profile_u1': {
      requestId: 'request', principalUid: 'u1', kind: 'profile', state: 'prepared',
      stagingPath: 'users/u1/staging/profile/avatar', expiresAt: new Date(9000),
    },
  })
  await cleanFinalizedStagingObject({
    object: finalizedObject('users/u1/staging/profile/avatar', '7', 'request'),
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
    await cleanFinalizedStagingObject({ object: finalizedObject(path, '7', marker), db,
      bucket: bucketWithMetadata(path, '7', marker), clean: async () => undefined,
      now: new Date(2000) })
    assert.equal(db.data('mediaUploadSessions/profile_u1').stagingGeneration, undefined)
  }
})

test('first valid exact generation binding is immutable for a request', async () => {
  const path = 'users/u1/staging/profile/avatar'
  const db = new FakeFirestore({ 'mediaUploadSessions/profile_u1': {
    requestId: 'request', principalUid: 'u1', kind: 'profile', state: 'prepared',
    stagingPath: path, expiresAt: new Date(9000),
  } })
  const cleaned = []
  const removed = []
  for (const generation of ['7', '8', '7']) {
    await cleanFinalizedStagingObject({ object: finalizedObject(path, generation, 'request'), db,
      bucket: bucketWithMetadata(path, generation, 'request'),
      clean: async () => cleaned.push(generation),
      remove: async ({ generation: removedGeneration }) => removed.push(removedGeneration),
      now: new Date(2000) })
  }
  assert.equal(db.data('mediaUploadSessions/profile_u1').stagingGeneration, '7')
  assert.equal(db.data('mediaUploadSessions/profile_u1').state, 'uploaded')
  assert.deepEqual(cleaned, ['7', '8'])
  assert.deepEqual(removed, ['8'])
})

test('same-generation duplicate completes pending cleanup without regressing clean states', async () => {
  const path = 'users/u1/staging/profile/avatar'
  const db = new FakeFirestore({ 'mediaUploadSessions/profile_u1': {
    requestId: 'request', principalUid: 'u1', kind: 'profile', state: 'cleanup_pending',
    cleanupPending: true, stagingPath: path, stagingGeneration: '7', expiresAt: new Date(9000),
  } })
  assert.deepEqual(await cleanFinalizedStagingObject({
    object: finalizedObject(path, '7', 'request'), db,
    bucket: bucketWithMetadata(path, '7', 'request'), clean: async () => undefined,
    now: new Date(2000),
  }), { status: 'cleaned' })
  assert.equal(db.data('mediaUploadSessions/profile_u1').state, 'uploaded')
  assert.equal(db.data('mediaUploadSessions/profile_u1').cleanupPending, false)

  for (const state of ['uploaded', 'promoting', 'promoted', 'completed']) {
    db.data('mediaUploadSessions/profile_u1').state = state
    const result = await cleanFinalizedStagingObject({
      object: finalizedObject(path, '7', 'request'), db,
      bucket: bucketWithMetadata(path, '7', 'request'),
      clean: async () => { throw new Error('must-not-reclean') }, now: new Date(2000),
    })
    assert.deepEqual(result, { status: 'already-clean' })
    assert.equal(db.data('mediaUploadSessions/profile_u1').state, state)
  }
})

test('different generation never regresses uploaded or promotion states', async () => {
  const path = 'users/u1/staging/profile/avatar'
  for (const state of ['cleanup_pending', 'uploaded', 'promoting', 'promoted', 'completed']) {
    const db = new FakeFirestore({ 'mediaUploadSessions/profile_u1': {
      requestId: 'request', principalUid: 'u1', kind: 'profile', state,
      cleanupPending: state === 'cleanup_pending', stagingPath: path, stagingGeneration: '7',
      promotedGeneration: '70', expiresAt: new Date(9000),
    } })
    const removed = []
    await cleanFinalizedStagingObject({
      object: finalizedObject(path, '8', 'request'), db,
      bucket: bucketWithMetadata(path, '8', 'request'), clean: async () => undefined,
      remove: async ({ generation }) => removed.push(generation),
      now: new Date(2000),
    })
    const session = db.data('mediaUploadSessions/profile_u1')
    assert.equal(session.state, state)
    assert.equal(session.stagingGeneration, '7')
    assert.equal(session.promotedGeneration, '70')
    assert.deepEqual(removed, ['8'])
  }
})

test('conflicting generation cleanup and delete failure creates durable non-promotable obligation', async () => {
  const path = 'users/u1/staging/profile/avatar'
  const db = new FakeFirestore({
    'users/u1': { profilePhoto: { storagePath: 'users/u1/profile/avatar/a' } },
    'mediaUploadSessions/profile_u1': {
      requestId: 'request', principalUid: 'u1', kind: 'profile', state: 'uploaded',
      stagingPath: path, stagingGeneration: '7', expiresAt: new Date(9000),
    },
  })
  await assert.rejects(cleanFinalizedStagingObject({
    object: finalizedObject(path, '8', 'request'), db,
    bucket: bucketWithMetadata(path, '8', 'request', {
      firebaseStorageDownloadTokens: 'inert-fixture',
    }),
    clean: async () => { throw new Error('metadata-cleanup') },
    remove: async () => { throw Object.assign(new Error('storage-unavailable'), { code: 503 }) },
    now: new Date(2000),
  }), /metadata-cleanup/)

  const primary = db.data('mediaUploadSessions/profile_u1')
  assert.equal(primary.state, 'uploaded')
  assert.equal(primary.stagingGeneration, '7')
  assert.deepEqual(db.data('users/u1').profilePhoto, { storagePath: 'users/u1/profile/avatar/a' })
  assert.throws(() => assertFinalizableSession(primary, {
    requestId: 'request', principalUid: 'u1', stagingGeneration: '8', now: 2000,
  }), /media-generation-mismatch/)

  const obligationPath = `${CONFLICTING_STAGING_CLEANUP_COLLECTION}/request_8`
  const obligation = db.data(obligationPath)
  assert.equal(obligation.state, 'cleanup_retry')
  assert.equal(obligation.stagingPath, path)
  assert.equal(obligation.stagingGeneration, '8')
  const removals = []
  await sweepExpiredMediaSessions({
    db, bucket: {}, now: new Date(3000),
    remove: async ({ kind, path: targetPath, generation }) => {
      if (kind === 'conflicting-staging') removals.push({ path: targetPath, generation })
    },
  })
  assert.deepEqual(removals, [{ path, generation: '8' }])
  assert.equal(db.data(obligationPath), undefined)
  assert.equal(db.data('mediaUploadSessions/profile_u1').stagingGeneration, '7')
})

test('conflicting generation immediate delete and 404 reconcile the obligation', async () => {
  for (const deletion of ['success', 'not-found']) {
    const path = 'users/u1/staging/profile/avatar'
    const db = conflictDb(path)
    const result = await cleanFinalizedStagingObject({
      object: finalizedObject(path, '8', 'request'), db,
      bucket: bucketWithMetadata(path, '8', 'request'),
      clean: async () => undefined,
      remove: async () => {
        if (deletion === 'not-found') throw Object.assign(new Error('absent'), { code: 404 })
      },
      now: new Date(2000),
    })
    assert.deepEqual(result, { status: 'conflict-removed' })
    assert.equal(db.data(`${CONFLICTING_STAGING_CLEANUP_COLLECTION}/request_8`), undefined)
    assert.equal(db.data('mediaUploadSessions/profile_u1').stagingGeneration, '7')
  }
})

test('conflicting cleanup obligation handles transient and exact-generation 412 safely', async () => {
  const path = 'users/u1/staging/profile/avatar'
  for (const scenario of [
    { code: 503, exactExists: async () => true, retained: true },
    { code: 412, exactExists: async () => true, retained: true },
    { code: 412, exactExists: async () => { throw new Error('unknown') }, retained: true },
    { code: 412, exactExists: async () => false, retained: false },
  ]) {
    const db = conflictDb(path)
    const operation = cleanFinalizedStagingObject({
      object: finalizedObject(path, '8', 'request'), db,
      bucket: bucketWithMetadata(path, '8', 'request'), clean: async () => undefined,
      remove: async () => { throw Object.assign(new Error('delete-failed'), { code: scenario.code }) },
      exactExists: scenario.exactExists, now: new Date(2000),
    })
    if (scenario.retained) await assert.rejects(operation, /delete-failed/)
    else assert.deepEqual(await operation, { status: 'conflict-removed' })
    const obligation = db.data(`${CONFLICTING_STAGING_CLEANUP_COLLECTION}/request_8`)
    assert.equal(Boolean(obligation), scenario.retained)
    if (obligation) assert.equal(obligation.stagingGeneration, '8')
    assert.equal(db.data('mediaUploadSessions/profile_u1').stagingGeneration, '7')
  }
})

test('duplicate and multiple conflicting generations retain independent cleanup obligations', async () => {
  const path = 'users/u1/staging/profile/avatar'
  const db = conflictDb(path)
  for (const generation of ['8', '8', '9']) {
    await assert.rejects(cleanFinalizedStagingObject({
      object: finalizedObject(path, generation, 'request'), db,
      bucket: bucketWithMetadata(path, generation, 'request'),
      clean: async () => { throw new Error('metadata-cleanup') },
      remove: async () => { throw Object.assign(new Error('storage-unavailable'), { code: 503 }) },
      now: new Date(2000),
    }), /metadata-cleanup/)
  }
  const obligations = [...db.store.entries()]
    .filter(([key]) => key.startsWith(`${CONFLICTING_STAGING_CLEANUP_COLLECTION}/`))
  assert.deepEqual(obligations.map(([, value]) => value.stagingGeneration).sort(), ['8', '9'])
  assert.equal(db.data('mediaUploadSessions/profile_u1').stagingGeneration, '7')
})

test('conflicting-obligation sweeper retains transient and 412, then reconciles exact absence', async () => {
  const path = 'users/u1/staging/profile/avatar'
  for (const code of [503, 412]) {
    const db = conflictDb(path, { withObligation: true })
    await sweepExpiredMediaSessions({
      db, bucket: {}, now: new Date(3000),
      remove: async ({ kind }) => {
        if (kind === 'conflicting-staging') throw Object.assign(new Error('delete-failed'), { code })
      },
      exactExists: async () => true,
    })
    const obligationPath = `${CONFLICTING_STAGING_CLEANUP_COLLECTION}/request_8`
    assert.equal(db.data(obligationPath).state, 'cleanup_retry')
    assert.equal(db.data(obligationPath).stagingGeneration, '8')
    await sweepExpiredMediaSessions({
      db, bucket: {}, now: new Date(4000),
      remove: async ({ kind }) => {
        if (kind === 'conflicting-staging') {
          throw Object.assign(new Error('precondition'), { code: 412 })
        }
      },
      exactExists: async ({ generation }) => generation === '7',
    })
    assert.equal(db.data(obligationPath), undefined)
    assert.equal(db.data('mediaUploadSessions/profile_u1').stagingGeneration, '7')
  }
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

test('cleanup plus immediate-delete failure retains exact non-promotable responsibility for the sweeper', async () => {
  const path = 'users/u1/staging/profile/avatar'
  const db = new FakeFirestore({
    'users/u1': { profilePhoto: { storagePath: 'users/u1/profile/avatar/a' } },
    'mediaUploadSessions/profile_u1': {
      requestId: 'request-12345678', principalUid: 'u1', kind: 'profile', state: 'prepared',
      stagingPath: path, expiresAt: new Date(3000),
    },
  })
  await assert.rejects(cleanFinalizedStagingObject({
    object: finalizedObject(path, '9', 'request-12345678'), db,
    bucket: bucketWithMetadata(path, '9', 'request-12345678', {
      firebaseStorageDownloadTokens: 'inert-fixture',
    }),
    clean: async () => { throw new Error('metadata-cleanup') },
    remove: async () => { throw Object.assign(new Error('storage-unavailable'), { code: 503 }) },
    now: new Date(2000),
  }), /metadata-cleanup/)
  const pending = db.data('mediaUploadSessions/profile_u1')
  assert.equal(pending.state, 'cleanup_retry')
  assert.equal(pending.cleanupPending, true)
  assert.equal(pending.cleanupFailure, 'transient')
  assert.equal(pending.cleanupReason, 'metadata-cleanup-failed')
  assert.equal(pending.stagingPath, path)
  assert.equal(pending.stagingGeneration, '9')
  assert.throws(() => assertFinalizableSession(pending, {
    requestId: pending.requestId, principalUid: 'u1', stagingGeneration: '9', now: 2000,
  }), /media-staging-not-clean/)
  assert.deepEqual(db.data('users/u1').profilePhoto, { storagePath: 'users/u1/profile/avatar/a' })

  const removals = []
  assert.deepEqual(await sweepExpiredMediaSessions({
    db, bucket: {}, now: new Date(4000),
    remove: async (target) => removals.push({ path: target.path, generation: target.generation }),
  }), { expired: 1 })
  assert.deepEqual(removals, [{ path, generation: '9' }])
  assert.equal(db.data('mediaUploadSessions/profile_u1'), undefined)
})

test('verified cleanup followed by uploaded-state persistence failure remains recoverable and non-promotable', async () => {
  const path = 'users/u1/staging/profile/avatar'
  const db = new FakeFirestore({
    'users/u1': { profilePhoto: { storagePath: 'users/u1/profile/avatar/a' } },
    'mediaUploadSessions/profile_u1': {
      requestId: 'request', principalUid: 'u1', kind: 'profile', state: 'prepared',
      stagingPath: path, expiresAt: new Date(3000),
    },
  })
  await assert.rejects(cleanFinalizedStagingObject({
    object: finalizedObject(path, '9', 'request'), db,
    bucket: bucketWithMetadata(path, '9', 'request'), clean: async () => undefined,
    markClean: async () => { throw new Error('firestore-unavailable') },
    remove: async () => { throw Object.assign(new Error('storage-unavailable'), { code: 503 }) },
    now: new Date(2000),
  }), /firestore-unavailable/)
  const pending = db.data('mediaUploadSessions/profile_u1')
  assert.equal(pending.state, 'cleanup_retry')
  assert.equal(pending.cleanupPending, true)
  assert.equal(pending.stagingGeneration, '9')
  assert.throws(() => assertFinalizableSession(pending, {
    requestId: 'request', principalUid: 'u1', stagingGeneration: '9', now: 2000,
  }), /media-staging-not-clean/)
  assert.deepEqual(db.data('users/u1').profilePhoto, { storagePath: 'users/u1/profile/avatar/a' })
})

test('successful fallback deletion reconciles failed cleanup without leaving promotable state', async () => {
  const path = 'users/u1/staging/profile/avatar'
  const db = new FakeFirestore({ 'mediaUploadSessions/profile_u1': {
    requestId: 'request-12345678', principalUid: 'u1', kind: 'profile', state: 'prepared',
    stagingPath: path, expiresAt: new Date(9000),
  } })
  await assert.rejects(cleanFinalizedStagingObject({
    object: finalizedObject(path, '9', 'request-12345678'), db,
    bucket: bucketWithMetadata(path, '9', 'request-12345678'),
    clean: async () => { throw new Error('metadata-cleanup') },
    remove: async () => undefined, now: new Date(2000),
  }), /metadata-cleanup/)
  const failed = db.data('mediaUploadSessions/profile_u1')
  assert.equal(failed.state, 'failed')
  assert.equal(failed.cleanupPending, false)
  assert.equal(failed.stagingGeneration, '9')
  assert.throws(() => assertFinalizableSession(failed, {
    requestId: failed.requestId, principalUid: 'u1', stagingGeneration: '9', now: 2000,
  }), /media-session-expired/)
})

test('not-found fallback deletion safely reconciles failed cleanup', async () => {
  const path = 'users/u1/staging/profile/avatar'
  const db = new FakeFirestore({ 'mediaUploadSessions/profile_u1': {
    requestId: 'request-12345678', principalUid: 'u1', kind: 'profile', state: 'prepared',
    stagingPath: path, expiresAt: new Date(9000),
  } })
  await assert.rejects(cleanFinalizedStagingObject({
    object: finalizedObject(path, '9', 'request-12345678'), db,
    bucket: bucketWithMetadata(path, '9', 'request-12345678'),
    clean: async () => { throw new Error('metadata-cleanup') },
    remove: async () => { throw Object.assign(new Error('not-found'), { code: 404 }) },
    now: new Date(2000),
  }), /metadata-cleanup/)
  const failed = db.data('mediaUploadSessions/profile_u1')
  assert.equal(failed.state, 'failed')
  assert.equal(failed.cleanupPending, false)
  assert.equal(failed.stagingGeneration, '9')
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
    assert.equal(db.data('mediaUploadSessions/profile_u1').cleanupPending, true)
    assert.equal(db.data('mediaUploadSessions/profile_u1').cleanupFailure,
      code === 412 ? 'generation-mismatch' : 'transient')
    await sweepExpiredMediaSessions({ db, bucket: {}, now: new Date(6000), remove: async () => undefined })
    assert.equal(db.data('mediaUploadSessions/profile_u1'), undefined)
  }
})

test('sweeper safely reconciles an exact staging generation that is already absent', async () => {
  const db = new FakeFirestore({ 'mediaUploadSessions/profile_u1': {
    requestId: 'r', state: 'cleanup_retry', cleanupPending: true, expiresAt: new Date(1000),
    stagingPath: 'users/u1/staging/profile/avatar', stagingGeneration: '4',
  } })
  assert.deepEqual(await sweepExpiredMediaSessions({
    db, bucket: {}, now: new Date(5000),
    remove: async () => { throw Object.assign(new Error('not-found'), { code: 404 }) },
  }), { expired: 1 })
  assert.equal(db.data('mediaUploadSessions/profile_u1'), undefined)
})

test('sweeper reconciles 412 only when the exact recorded generation is proven absent', async () => {
  const makeDb = () => new FakeFirestore({ 'mediaUploadSessions/profile_u1': {
    requestId: 'r', state: 'cleanup_retry', cleanupPending: true, expiresAt: new Date(1000),
    stagingPath: 'users/u1/staging/profile/avatar', stagingGeneration: '4',
  } })
  const deletionTargets = []
  const absent = makeDb()
  assert.deepEqual(await sweepExpiredMediaSessions({
    db: absent, bucket: {}, now: new Date(5000),
    remove: async ({ path, generation }) => {
      deletionTargets.push({ path, generation })
      throw Object.assign(new Error('precondition'), { code: 412 })
    },
    exactExists: async ({ generation }) => generation !== '4',
  }), { expired: 1 })
  assert.equal(absent.data('mediaUploadSessions/profile_u1'), undefined)
  assert.deepEqual(deletionTargets, [{
    path: 'users/u1/staging/profile/avatar', generation: '4',
  }])

  for (const exactExists of [async () => true, async () => { throw new Error('unknown') }]) {
    const retained = makeDb()
    await sweepExpiredMediaSessions({
      db: retained, bucket: {}, now: new Date(5000),
      remove: async () => { throw Object.assign(new Error('precondition'), { code: 412 }) },
      exactExists,
    })
    assert.equal(retained.data('mediaUploadSessions/profile_u1').state, 'cleanup_retry')
    assert.equal(retained.data('mediaUploadSessions/profile_u1').cleanupPending, true)
    assert.equal(retained.data('mediaUploadSessions/profile_u1').stagingGeneration, '4')
  }
})

test('trigger and sweeper race cannot clear a changed session checkpoint', async () => {
  const path = 'users/u1/staging/profile/avatar'
  const db = new FakeFirestore({ 'mediaUploadSessions/profile_u1': {
    requestId: 'request', principalUid: 'u1', kind: 'profile', state: 'cleanup_pending',
    cleanupPending: true, stagingPath: path, stagingGeneration: '7', expiresAt: new Date(1000),
  } })
  await sweepExpiredMediaSessions({
    db, bucket: {}, now: new Date(5000),
    remove: async () => {
      await cleanFinalizedStagingObject({
        object: finalizedObject(path, '7', 'request'), db,
        bucket: bucketWithMetadata(path, '7', 'request'), clean: async () => undefined,
        now: new Date(5000),
      })
    },
  })
  assert.equal(db.data('mediaUploadSessions/profile_u1').state, 'uploaded')
  assert.equal(db.data('mediaUploadSessions/profile_u1').stagingGeneration, '7')
})

test('sweeper preserves expired promoting and promoted recovery checkpoints', async () => {
  for (const state of ['promoting', 'promoted']) {
    const db = new FakeFirestore({
      'mediaUploadSessions/profile_u1': {
        requestId: 'request', principalUid: 'u1', kind: 'profile', state,
        stagingPath: 'users/u1/staging/profile/avatar', stagingGeneration: '7',
        promotedGeneration: '70', expiresAt: new Date(1000),
      },
    })
    let removals = 0
    assert.deepEqual(await sweepExpiredMediaSessions({
      db, bucket: {}, now: new Date(5000),
      remove: async () => { removals += 1 },
    }), { expired: 0 })
    assert.equal(removals, 0)
    assert.equal(db.data('mediaUploadSessions/profile_u1').state, state)
    assert.equal(db.data('mediaUploadSessions/profile_u1').promotedGeneration, '70')
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
