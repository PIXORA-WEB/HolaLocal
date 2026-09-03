export class OperationTimeoutError extends Error {
  constructor(code = 'operation-timeout') {
    super('The operation exceeded its allowed duration.')
    this.name = 'OperationTimeoutError'
    this.code = code
  }
}

export function withTimeout(operation, timeoutMs, {
  clearTimer = globalThis.clearTimeout,
  setTimer = globalThis.setTimeout,
  timeoutCode = 'operation-timeout',
} = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new TypeError('A positive finite timeout duration is required.'))
  }
  if (typeof setTimer !== 'function' || typeof clearTimer !== 'function') {
    return Promise.reject(new TypeError('Valid timer functions are required.'))
  }

  let source
  try {
    source = Promise.resolve(typeof operation === 'function' ? operation() : operation)
  } catch (error) {
    return Promise.reject(error)
  }

  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimer(() => {
      if (settled) return
      settled = true
      reject(new OperationTimeoutError(timeoutCode))
    }, timeoutMs)

    source.then(
      (value) => {
        if (settled) return
        settled = true
        clearTimer(timer)
        resolve(value)
      },
      (error) => {
        if (settled) return
        settled = true
        clearTimer(timer)
        reject(error)
      },
    )
  })
}
