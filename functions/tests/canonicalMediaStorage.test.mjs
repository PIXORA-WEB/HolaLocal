import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Storage } from '@google-cloud/storage'
import {
  cleanStagingGeneration, clearPromotionContext, deleteExactGeneration, exactGenerationExists,
  promoteCleanGeneration,
} from '../src/canonicalMediaStorage.js'
import { cleanFinalizedStagingObject } from '../src/stagingMediaMaintenance.js'
import { FakeFirestore } from './fakeFirestore.mjs'

function fakeBucket(seed, { ignoreMetadataTombstones = false } = {}) {
  const objects = new Map(Object.entries(structuredClone(seed)))
  const calls = []
  return {
    name: 'test-bucket', objects, calls,
    file(path, options = {}) {
      return {
        name: path, bucket: this, generation: options.generation,
        request(request, callback) {
          calls.push(['rewrite', request])
          const canonical = objects.get('canonical')
          objects.set('canonical', { ...canonical, contexts: request.json.contexts })
          callback(null, { done: true, resource: objects.get('canonical') })
        },
        async getMetadata() { return [structuredClone(objects.get(path))] },
        async setMetadata(update) {
          calls.push(['metadata', path, options, update])
          const value = objects.get(path)
          const metadata = { ...(value.metadata ?? {}) }
          for (const [key, entry] of Object.entries(update.metadata ?? {})) {
            if (entry === null) {
              if (!ignoreMetadataTombstones) delete metadata[key]
            } else {
              metadata[key] = entry
            }
          }
          objects.set(path, {
            ...value,
            ...(Object.hasOwn(update, 'metadata') ? { metadata } : {}),
            ...(Object.hasOwn(update, 'contexts') ? { contexts: update.contexts } : {}),
            metageneration: String(Number(value.metageneration) + 1),
          })
        },
        async delete(deleteOptions) { calls.push(['delete', path, options, deleteOptions]) },
      }
    },
  }
}

const staging = {
  name: 'staging', generation: '10', metageneration: '1', size: '100', contentType: 'image/png',
  metadata: { firebaseStorageDownloadTokens: 'never-report-this' },
}

test('cleanup removes only the token with generation and metageneration preconditions', async () => {
  const bucket = fakeBucket({ staging })
  const result = await cleanStagingGeneration({ path: 'staging', generation: '10', bucket })
  assert.deepEqual(result.metadata, {})
  assert.deepEqual(bucket.calls[0][2].preconditionOpts, { ifGenerationMatch: '10', ifMetagenerationMatch: '1' })
  assert.deepEqual(bucket.calls[0][3], { metadata: { firebaseStorageDownloadTokens: null } })
  assert.equal(JSON.stringify(bucket.calls).includes('never-report-this'), false)
})

test('staging cleanup preserves only the trusted session marker while removing the bearer token', async () => {
  const bucket = fakeBucket({ staging: { ...staging, metadata: {
    firebaseStorageDownloadTokens: 'never-report-this', holalocalUploadSession: 'request-12345678',
  } } })
  const result = await cleanStagingGeneration({ path: 'staging', generation: '10', bucket })
  assert.deepEqual(result.metadata, { holalocalUploadSession: 'request-12345678' })
  assert.deepEqual(bucket.calls[0][3], { metadata: {
    holalocalUploadSession: 'request-12345678', firebaseStorageDownloadTokens: null,
  } })
  assert.equal(JSON.stringify(bucket.calls).includes('never-report-this'), false)
})

test('installed storage client sends an explicit token-deletion tombstone in the PATCH body', async () => {
  const storage = new Storage({ projectId: 'test-project' })
  const bucket = storage.bucket('test-bucket')
  let request
  bucket.request = (options, callback) => {
    request = options
    callback(null, { name: 'staging' }, {})
  }
  await bucket.file('staging', {
    generation: '10',
    preconditionOpts: { ifGenerationMatch: '10', ifMetagenerationMatch: '1' },
  }).setMetadata({ metadata: {
    holalocalUploadSession: 'request-12345678', firebaseStorageDownloadTokens: null,
  } })
  assert.equal(request.method, 'PATCH')
  assert.deepEqual(request.json, { metadata: {
    holalocalUploadSession: 'request-12345678', firebaseStorageDownloadTokens: null,
  } })
  assert.equal(request.qs.generation, 10)
  assert.equal(request.qs.ifGenerationMatch, '10')
  assert.equal(request.qs.ifMetagenerationMatch, '1')
})

test('post-PATCH reread fails closed when the backend leaves the token in place', async () => {
  const bucket = fakeBucket({ staging: { ...staging, metadata: {
    firebaseStorageDownloadTokens: 'never-report-this', holalocalUploadSession: 'request-12345678',
  } } }, { ignoreMetadataTombstones: true })
  await assert.rejects(
    cleanStagingGeneration({ path: 'staging', generation: '10', bucket }),
    /media-forbidden-metadata/,
  )
  assert.equal(bucket.calls.filter(([kind]) => kind === 'metadata').length, 1)
  assert.equal(JSON.stringify(bucket.calls).includes('never-report-this'), false)
})

test('exact generation presence uses generation-qualified metadata and only reconciles 404', async () => {
  const calls = []
  const bucket = { file(path, options) { return { async getMetadata() {
    calls.push({ path, options })
    return [{ name: path, generation: options.generation }]
  } } } }
  assert.equal(await exactGenerationExists({ path: 'staging', generation: '10', bucket }), true)
  assert.deepEqual(calls, [{ path: 'staging', options: { generation: '10' } }])

  const absent = { file() { return { async getMetadata() {
    throw Object.assign(new Error('not-found'), { code: 404 })
  } } } }
  assert.equal(await exactGenerationExists({ path: 'staging', generation: '10', bucket: absent }), false)

  const unknown = { file() { return { async getMetadata() {
    throw Object.assign(new Error('unavailable'), { code: 503 })
  } } } }
  await assert.rejects(exactGenerationExists({ path: 'staging', generation: '10', bucket: unknown }), /unavailable/)

  const storage = new Storage({ projectId: 'test-project' })
  const installedBucket = storage.bucket('test-bucket')
  let request
  installedBucket.request = (options, callback) => {
    request = options
    callback(null, { name: 'staging', generation: '10' }, {})
  }
  assert.equal(await exactGenerationExists({
    path: 'staging', generation: '10', bucket: installedBucket,
  }), true)
  assert.equal(request.method ?? 'GET', 'GET')
  assert.equal(request.qs.generation, 10)
})

test('Production canary lifecycle cleans the injected token and binds the staging generation', async () => {
  const path = 'users/u1/staging/profile/avatar'
  const marker = 'request-12345678'
  const bucket = fakeBucket({ [path]: { ...staging, name: path, metadata: {
    holalocalUploadSession: marker, firebaseStorageDownloadTokens: 'inert-fixture',
  } } })
  const db = new FakeFirestore({ 'mediaUploadSessions/profile_u1': {
    requestId: marker, principalUid: 'u1', kind: 'profile', state: 'prepared',
    stagingPath: path, expiresAt: new Date(9000),
  } })
  const result = await cleanFinalizedStagingObject({
    object: { name: path, generation: '10' }, db, bucket, now: new Date(2000),
  })
  assert.deepEqual(result, { status: 'cleaned' })
  assert.deepEqual(bucket.objects.get(path).metadata, { holalocalUploadSession: marker })
  assert.equal(db.data('mediaUploadSessions/profile_u1').stagingGeneration, '10')
  assert.equal(db.data('mediaUploadSessions/profile_u1').state, 'uploaded')
  assert.equal(JSON.stringify(bucket.calls).includes('inert-fixture'), false)
})

test('promotion sends exact source conditions, destination condition, and empty destination metadata', async () => {
  const cleaned = { ...staging, metadata: {}, metageneration: '2' }
  const canonical = { ...cleaned, name: 'canonical', generation: '20', metageneration: '1' }
  const bucket = fakeBucket({ staging: cleaned, canonical })
  const result = await promoteCleanGeneration({
    stagingPath: 'staging', stagingGeneration: '10', stagingMetageneration: '2',
    canonicalPath: 'canonical', expectedCanonicalGeneration: '7',
    promotionId: '12345678-1234-1234-1234-123456789012', bucket,
  })
  assert.equal(result.generation, '20')
  const request = bucket.calls.find(([kind]) => kind === 'rewrite')[1]
  assert.deepEqual(request.qs, {
    sourceGeneration: '10', ifSourceGenerationMatch: '10',
    ifSourceMetagenerationMatch: '2', ifGenerationMatch: '7',
  })
  assert.equal(Object.hasOwn(request.qs, 'dropContextGroups'), false)
  assert.deepEqual(request.json, {
    contentType: 'image/png', metadata: {},
    contexts: { custom: { 'holalocal-media-request': { value: '12345678-1234-1234-1234-123456789012' } } },
  })
})

test('first creation uses destination generation zero and conditional deletion cannot target newer bytes', async () => {
  const cleaned = { ...staging, metadata: {}, metageneration: '2' }
  const canonical = { ...cleaned, name: 'canonical', generation: '20', metageneration: '1' }
  const bucket = fakeBucket({ staging: cleaned, canonical })
  await promoteCleanGeneration({ stagingPath: 'staging', stagingGeneration: '10', stagingMetageneration: '2', canonicalPath: 'canonical', expectedCanonicalGeneration: 0, promotionId: '12345678-1234-1234-1234-123456789012', bucket })
  assert.equal(bucket.calls[0][1].qs.ifGenerationMatch, '0')
  await deleteExactGeneration({ path: 'staging', generation: '10', bucket })
  assert.deepEqual(bucket.calls.at(-1)[2].preconditionOpts, { ifGenerationMatch: '10' })
})

test('promotion overrides source contexts and clears its retry context before authority', async () => {
  const cleaned = {
    ...staging, metadata: {}, metageneration: '2',
    contexts: { custom: { inherited: { value: 'must-not-copy' } } },
  }
  const canonical = { ...cleaned, name: 'canonical', generation: '20', metageneration: '1' }
  const bucket = fakeBucket({ staging: cleaned, canonical })
  await promoteCleanGeneration({
    stagingPath: 'staging', stagingGeneration: '10', stagingMetageneration: '2',
    canonicalPath: 'canonical', expectedCanonicalGeneration: 0,
    promotionId: '12345678-1234-1234-1234-123456789012', bucket,
  })
  assert.deepEqual(bucket.objects.get('canonical').contexts, {
    custom: { 'holalocal-media-request': { value: '12345678-1234-1234-1234-123456789012' } },
  })
  await clearPromotionContext({ path: 'canonical', generation: '20', bucket })
  assert.deepEqual(bucket.objects.get('canonical').contexts, { custom: null })
  const contextUpdate = bucket.calls.find(([kind, path, , update]) => (
    kind === 'metadata' && path === 'canonical' && Object.hasOwn(update, 'contexts')
  ))
  assert.deepEqual(contextUpdate[2].preconditionOpts, {
    ifGenerationMatch: '20', ifMetagenerationMatch: '1',
  })
})

test('unexpected custom metadata and stale generations fail closed', async () => {
  const bucket = fakeBucket({ staging: { ...staging, metadata: { attacker: 'x' } } })
  await assert.rejects(cleanStagingGeneration({ path: 'staging', generation: '10', bucket }), /media-forbidden-metadata/)
  await assert.rejects(cleanStagingGeneration({ path: 'staging', generation: '11', bucket }), /media-generation-mismatch/)
})
