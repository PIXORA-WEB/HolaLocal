import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  loadPublicBusinessDirectory,
  PUBLIC_DIRECTORY_TIMEOUT_CODE,
} from '../src/services/publicBusinessDirectoryLoader.js'
import { OperationTimeoutError } from '../src/utils/withTimeout.js'

const business = (businessId, name = businessId) => ({ businessId, name })

test('a never-settling public callable times out with a directory-specific error', async () => {
  await assert.rejects(loadPublicBusinessDirectory({
    callPublicBusinesses: async () => new Promise(() => {}),
    fallbackBusiness: async (value) => value,
    maxResults: 60,
    presentBusiness: async (value) => value,
    timeoutMs: 5,
  }), (error) => (
    error instanceof OperationTimeoutError && error.code === PUBLIC_DIRECTORY_TIMEOUT_CODE
  ))
})

test('ordinary callable rejection remains distinguishable from timeout', async () => {
  const failure = new Error('callable-failed')
  await assert.rejects(loadPublicBusinessDirectory({
    callPublicBusinesses: async () => { throw failure },
    fallbackBusiness: async (value) => value,
    maxResults: 60,
    presentBusiness: async (value) => value,
    timeoutMs: 20,
  }), (error) => error === failure)
})

test('manual retry creates a fresh callable attempt after timeout', async () => {
  let calls = 0
  const callPublicBusinesses = async () => {
    calls += 1
    return calls === 1
      ? new Promise(() => {})
      : { data: { businesses: [business('retry-business')] } }
  }
  const dependencies = {
    callPublicBusinesses,
    fallbackBusiness: async (value) => value,
    maxResults: 60,
    presentBusiness: async (value) => ({ ...value, presented: true }),
    timeoutMs: 5,
  }
  await assert.rejects(loadPublicBusinessDirectory(dependencies), OperationTimeoutError)
  assert.deepEqual(await loadPublicBusinessDirectory(dependencies), [
    { businessId: 'retry-business', name: 'retry-business', presented: true },
  ])
  assert.equal(calls, 2)
})

test('successful callable results are enriched concurrently', async () => {
  let releaseFirst
  const firstPending = new Promise((resolve) => { releaseFirst = resolve })
  const started = []
  const result = loadPublicBusinessDirectory({
    callPublicBusinesses: async () => ({ data: { businesses: [business('first'), business('second')] } }),
    fallbackBusiness: async (value) => value,
    maxResults: 60,
    presentBusiness: async (value) => {
      started.push(value.businessId)
      if (value.businessId === 'first') await firstPending
      return { ...value, presented: true }
    },
    timeoutMs: 25,
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(started, ['first', 'second'])
  releaseFirst()
  assert.equal((await result).length, 2)
})

test('one media presentation failure degrades only that business', async () => {
  let callableInvocations = 0
  const result = await loadPublicBusinessDirectory({
    callPublicBusinesses: async () => {
      callableInvocations += 1
      return { data: { businesses: [business('broken-media'), business('healthy-media')] } }
    },
    fallbackBusiness: async (value) => ({ ...value, logoUrl: null }),
    maxResults: 60,
    presentBusiness: async (value) => {
      if (value.businessId === 'broken-media') throw new Error('media-failed')
      return { ...value, logoUrl: 'blob:healthy' }
    },
    timeoutMs: 25,
  })
  assert.deepEqual(result.map(({ businessId, logoUrl }) => ({ businessId, logoUrl })), [
    { businessId: 'broken-media', logoUrl: null },
    { businessId: 'healthy-media', logoUrl: 'blob:healthy' },
  ])
  assert.equal(callableInvocations, 1)
})

test('invalid and incomplete callable entries remain excluded', async () => {
  const result = await loadPublicBusinessDirectory({
    callPublicBusinesses: async () => ({ data: { businesses: [null, {}, business('valid')] } }),
    fallbackBusiness: async (value) => value,
    maxResults: 60,
    presentBusiness: async (value) => value,
    timeoutMs: 25,
  })
  assert.deepEqual(result, [business('valid')])
})
