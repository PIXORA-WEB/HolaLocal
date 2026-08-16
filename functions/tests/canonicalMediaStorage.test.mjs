import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  cleanStagingGeneration, deleteExactGeneration, promoteCleanGeneration,
} from '../src/canonicalMediaStorage.js'

function fakeBucket(seed) {
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
          objects.set(path, { ...value, metadata: update.metadata, metageneration: String(Number(value.metageneration) + 1) })
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
  assert.equal(JSON.stringify(bucket.calls).includes('never-report-this'), false)
})

test('staging cleanup preserves only the trusted session marker while removing the bearer token', async () => {
  const bucket = fakeBucket({ staging: { ...staging, metadata: {
    firebaseStorageDownloadTokens: 'never-report-this', holalocalUploadSession: 'request-12345678',
  } } })
  const result = await cleanStagingGeneration({ path: 'staging', generation: '10', bucket })
  assert.deepEqual(result.metadata, { holalocalUploadSession: 'request-12345678' })
  assert.equal(JSON.stringify(bucket.calls).includes('never-report-this'), false)
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
    ifSourceMetagenerationMatch: '2', ifGenerationMatch: '7', dropContextGroups: 'custom',
  })
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

test('unexpected custom metadata and stale generations fail closed', async () => {
  const bucket = fakeBucket({ staging: { ...staging, metadata: { attacker: 'x' } } })
  await assert.rejects(cleanStagingGeneration({ path: 'staging', generation: '10', bucket }), /media-forbidden-metadata/)
  await assert.rejects(cleanStagingGeneration({ path: 'staging', generation: '11', bucket }), /media-generation-mismatch/)
})
