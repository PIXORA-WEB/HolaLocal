export const BROWSER_STORAGE_READ_DIAGNOSTIC_DEADLINE_MS = 10_000
export const STORAGE_AUTHORIZATION_DENIAL_CODES = Object.freeze([
  'storage/unauthenticated',
  'storage/unauthorized',
])

const MAX_DIAGNOSTIC_FIELD_LENGTH = 240
const denialCodes = new Set(STORAGE_AUTHORIZATION_DENIAL_CODES)

function sanitizeDiagnosticField(value) {
  if (typeof value !== 'string') return null
  return value
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/([?&](?:access_token|auth|key|token)=)[^&\s]+/gi, '$1[redacted]')
    .replace(/(authorization\s*[:=]\s*)\S+/gi, '$1[redacted]')
    .slice(0, MAX_DIAGNOSTIC_FIELD_LENGTH)
}

export function formatStorageReadDiagnostic(diagnostic) {
  const input = diagnostic && typeof diagnostic === 'object' ? diagnostic : {}
  return JSON.stringify({
    outcome: sanitizeDiagnosticField(input.outcome),
    code: sanitizeDiagnosticField(input.code),
    name: sanitizeDiagnosticField(input.name),
    message: sanitizeDiagnosticField(input.message),
    elapsedMs: Number.isFinite(input.elapsedMs) ? Math.max(0, Math.round(input.elapsedMs)) : null,
  })
}

export function formatStorageReadAssertionMessage({ actor, pathCategory, expected }, diagnostic) {
  return [
    `Storage read assertion failed for ${sanitizeDiagnosticField(actor) ?? 'unknown actor'}`,
    `(${sanitizeDiagnosticField(pathCategory) ?? 'unknown path category'});`,
    `expected ${sanitizeDiagnosticField(expected) ?? 'unknown outcome'};`,
    `diagnostic=${formatStorageReadDiagnostic(diagnostic)}`,
  ].join(' ')
}

export function validateStorageReadPath(storagePath) {
  if (typeof storagePath !== 'string' || storagePath.length === 0) {
    throw new TypeError('Storage read path must be a non-empty string.')
  }
  return storagePath
}

function result(outcome, elapsedMs, error = null) {
  return Object.freeze({
    outcome,
    code: sanitizeDiagnosticField(error?.code),
    name: sanitizeDiagnosticField(error?.name),
    message: sanitizeDiagnosticField(error?.message),
    elapsedMs: Math.max(0, Math.round(elapsedMs)),
  })
}

export function classifyStorageReadError(error, elapsedMs) {
  const code = sanitizeDiagnosticField(error?.code)
  return result(denialCodes.has(code) ? 'denied' : 'error', elapsedMs, error)
}

export async function runStorageReadDiagnostic(operation, {
  deadlineMs = BROWSER_STORAGE_READ_DIAGNOSTIC_DEADLINE_MS,
  now = () => performance.now(),
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout,
} = {}) {
  const startedAt = now()
  let timer
  const operationResult = Promise.resolve().then(operation).then(
    () => result('allowed', now() - startedAt),
    (error) => classifyStorageReadError(error, now() - startedAt),
  )
  // This diagnostic deadline does not cancel the Firebase request. Closing the
  // scenario's browser context remains responsible for terminating a late request.
  const deadlineResult = new Promise((resolve) => {
    timer = setTimer(
      () => resolve(result('timeout', now() - startedAt)),
      deadlineMs,
    )
  })

  try {
    return await Promise.race([operationResult, deadlineResult])
  } finally {
    clearTimer(timer)
  }
}
