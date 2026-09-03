import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BROWSER_STORAGE_READ_DIAGNOSTIC_DEADLINE_MS,
  classifyStorageReadError,
  formatStorageReadAssertionMessage,
  formatStorageReadDiagnostic,
  runStorageReadDiagnostic,
  validateStorageReadPath,
} from './browser/storageReadDiagnostics.mjs'

test('allowed reads return a complete serializable diagnostic result', async () => {
  const result = await runStorageReadDiagnostic(async () => new Uint8Array([1]), {
    deadlineMs: 50,
  })
  assert.deepEqual(Object.keys(result), ['outcome', 'code', 'name', 'message', 'elapsedMs'])
  assert.equal(result.outcome, 'allowed')
  assert.equal(result.code, null)
  assert.equal(result.name, null)
  assert.equal(result.message, null)
  assert.equal(Number.isFinite(result.elapsedMs), true)
  assert.doesNotThrow(() => structuredClone(result))
})

test('formatter includes only all five approved fields with explicit nulls', () => {
  const formatted = formatStorageReadDiagnostic({ outcome: 'allowed', extra: 'ignored' })
  assert.equal(formatted, '{"outcome":"allowed","code":null,"name":null,"message":null,"elapsedMs":null}')
  assert.equal(formatted.includes('extra'), false)
  assert.doesNotThrow(() => formatStorageReadDiagnostic(null))
})

test('formatter reapplies bounded sanitization and neutralizes terminal controls', () => {
  const syntheticSecret = ['synthetic', 'marker'].join('-')
  const formatted = formatStorageReadDiagnostic({
    outcome: 'error',
    code: null,
    name: 'TransportError',
    message: `\u001b[31mAuthorization: ${syntheticSecret} Bearer ${syntheticSecret} https://local.invalid/?token=${syntheticSecret} ${'x'.repeat(400)}`,
    elapsedMs: 7.4,
    headers: { authorization: syntheticSecret },
  })
  const parsed = JSON.parse(formatted)
  assert.deepEqual(Object.keys(parsed), ['outcome', 'code', 'name', 'message', 'elapsedMs'])
  assert.equal(parsed.message.length, 240)
  assert.doesNotMatch(formatted, /\u001b|synthetic-marker/)
  assert.equal(parsed.elapsedMs, 7)
})

test('assertion message contains the complete safely formatted diagnostic', () => {
  const diagnostic = { outcome: 'timeout', code: null, name: null, message: null, elapsedMs: 10_001 }
  const formatted = formatStorageReadDiagnostic(diagnostic)
  const message = formatStorageReadAssertionMessage({
    actor: 'admin', pathCategory: 'canonical business logo', expected: 'allowed',
  }, diagnostic)
  assert.match(message, /admin/)
  assert.match(message, /canonical business logo/)
  assert.match(message, /expected allowed/)
  assert.ok(message.includes(formatted))
})

test('storage read paths must use the explicit non-empty string contract', async () => {
  assert.equal(validateStorageReadPath('businesses/example/logos/logo'), 'businesses/example/logos/logo')
  for (const invalidPath of [undefined, null, '', {}, ['businesses/example/logos/logo']]) {
    const result = await runStorageReadDiagnostic(
      () => Promise.resolve(validateStorageReadPath(invalidPath)),
      { deadlineMs: 50 },
    )
    assert.deepEqual(result, {
      outcome: 'error',
      code: null,
      name: 'TypeError',
      message: 'Storage read path must be a non-empty string.',
      elapsedMs: result.elapsedMs,
    })
  }
})

test('known Firebase Storage authorization rejection is classified as denied', async () => {
  const error = Object.assign(new Error('Permission denied.'), {
    code: 'storage/unauthorized',
    name: 'FirebaseError',
  })
  const result = await runStorageReadDiagnostic(() => Promise.reject(error), { deadlineMs: 50 })
  assert.deepEqual(result, {
    outcome: 'denied',
    code: 'storage/unauthorized',
    name: 'FirebaseError',
    message: 'Permission denied.',
    elapsedMs: result.elapsedMs,
  })
})

test('generic coded and uncoded failures remain errors with absent fields normalized', () => {
  assert.deepEqual(classifyStorageReadError({ code: 'storage/retry-limit-exceeded' }, 4), {
    outcome: 'error', code: 'storage/retry-limit-exceeded', name: null, message: null, elapsedMs: 4,
  })
  assert.deepEqual(classifyStorageReadError({}, 5), {
    outcome: 'error', code: null, name: null, message: null, elapsedMs: 5,
  })
})

test('a never-settling read returns timeout well before the Playwright test timeout', async () => {
  const startedAt = performance.now()
  const result = await runStorageReadDiagnostic(() => new Promise(() => {}), { deadlineMs: 15 })
  const actualElapsedMs = performance.now() - startedAt
  assert.equal(result.outcome, 'timeout')
  assert.equal(result.code, null)
  assert.ok(actualElapsedMs < 1_000)
  assert.ok(BROWSER_STORAGE_READ_DIAGNOSTIC_DEADLINE_MS < 180_000)
})

test('diagnostics bound and redact messages without returning sensitive error fields', () => {
  const error = {
    code: 'transport/failure',
    name: 'TransportError',
    message: `Authorization: secret-value Bearer token-value https://local.invalid/?access_token=secret&key=secret ${'x'.repeat(400)}`,
    authorization: 'secret-header',
    accessToken: 'secret-token',
    headers: { authorization: 'secret-header' },
  }
  const result = classifyStorageReadError(error, 2)
  assert.ok(result.message.length <= 240)
  assert.doesNotMatch(result.message, /secret-value|token-value|access_token=secret|key=secret/)
  assert.deepEqual(Object.keys(result), ['outcome', 'code', 'name', 'message', 'elapsedMs'])
  assert.equal('headers' in result, false)
  assert.equal('authorization' in result, false)
  assert.equal('accessToken' in result, false)
})
