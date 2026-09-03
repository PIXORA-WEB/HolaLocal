import assert from 'node:assert/strict'
import { test } from 'node:test'
import { OperationTimeoutError, withTimeout } from '../src/utils/withTimeout.js'

test('withTimeout preserves values and clears its timer after resolution', async () => {
  const cleared = []
  const value = await withTimeout(Promise.resolve('complete'), 25, {
    clearTimer: (timer) => cleared.push(timer),
    setTimer: () => 'resolution-timer',
  })
  assert.equal(value, 'complete')
  assert.deepEqual(cleared, ['resolution-timer'])
})

test('withTimeout preserves ordinary rejection errors and clears its timer', async () => {
  const failure = new Error('ordinary-failure')
  const cleared = []
  await assert.rejects(withTimeout(Promise.reject(failure), 25, {
    clearTimer: (timer) => cleared.push(timer),
    setTimer: () => 'rejection-timer',
  }), (error) => error === failure)
  assert.deepEqual(cleared, ['rejection-timer'])
})

test('withTimeout rejects with an identifiable timeout error', async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 5, {
    timeoutCode: 'focused-timeout',
  }), (error) => (
    error instanceof OperationTimeoutError
    && error.code === 'focused-timeout'
    && error.message === 'The operation exceeded its allowed duration.'
  ))
})

test('late resolution cannot change a timed-out result', async () => {
  let resolveSource
  const source = new Promise((resolve) => { resolveSource = resolve })
  const result = withTimeout(source, 5)
  await assert.rejects(result, OperationTimeoutError)
  resolveSource('late')
  await new Promise((resolve) => setTimeout(resolve, 0))
  await assert.rejects(result, OperationTimeoutError)
})

test('late rejection is observed without becoming unhandled', async () => {
  let rejectSource
  const source = new Promise((_resolve, reject) => { rejectSource = reject })
  const unhandled = []
  const onUnhandled = (error) => unhandled.push(error)
  process.on('unhandledRejection', onUnhandled)
  try {
    await assert.rejects(withTimeout(source, 5), OperationTimeoutError)
    rejectSource(new Error('late-rejection'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.deepEqual(unhandled, [])
  } finally {
    process.off('unhandledRejection', onUnhandled)
  }
})

test('withTimeout safely rejects invalid durations', async () => {
  for (const duration of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    await assert.rejects(withTimeout(Promise.resolve(), duration), TypeError)
  }
})
