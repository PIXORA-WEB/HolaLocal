import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { test } from 'node:test'
import {
  createMediaSubmissionGuard,
  mediaFileContentIdentity,
} from '../src/utils/mediaSubmissionGuard.js'

function testFile(name, bytes, overrides = {}) {
  const content = Uint8Array.from(bytes)
  return {
    name,
    size: content.byteLength,
    type: 'image/png',
    lastModified: 1_786_000_000_000,
    async arrayBuffer() {
      return content.slice().buffer
    },
    ...overrides,
  }
}

function submissionGuard() {
  return createMediaSubmissionGuard({
    identify: (file) => mediaFileContentIdentity(file, webcrypto.subtle),
  })
}

function uploader(guard, { failOnce = new Set(), pause } = {}) {
  const calls = { prepare: [], upload: [], finalize: [] }
  async function submit(files) {
    if (!guard.tryAcquire()) return 'busy'
    try {
      const pending = await guard.pendingFiles(files)
      if (pending.length === 0) return 'duplicate'
      for (const file of pending) {
        calls.prepare.push(file.name)
        await pause?.(file)
        calls.upload.push(file.name)
        if (failOnce.has(file.name)) {
          failOnce.delete(file.name)
          throw new Error(`failed:${file.name}`)
        }
        calls.finalize.push(file.name)
        await guard.markSuccessful(file)
      }
      return 'completed'
    } finally {
      guard.release()
    }
  }
  return { calls, submit }
}

test('profile synchronous duplicate and successful same-file replay make one backend workflow', async () => {
  const guard = submissionGuard()
  let release
  const blocked = new Promise((resolve) => { release = resolve })
  const profile = uploader(guard, { pause: () => blocked })
  const avatar = testFile('avatar.png', [1, 2, 3])

  const first = profile.submit([avatar])
  const duplicate = await profile.submit([avatar])
  assert.equal(duplicate, 'busy')
  release()
  assert.equal(await first, 'completed')
  assert.equal(await profile.submit([avatar]), 'duplicate')
  assert.deepEqual(profile.calls, {
    prepare: ['avatar.png'], upload: ['avatar.png'], finalize: ['avatar.png'],
  })
})

test('profile permits a different file and failed files remain retryable exactly once', async () => {
  const guard = submissionGuard()
  const failed = testFile('failed.png', [4, 5, 6])
  const replacement = testFile('replacement.png', [7, 8, 9])
  let releaseRetry
  let retrying = false
  const profile = uploader(guard, {
    failOnce: new Set(['failed.png']),
    pause: (file) => retrying && file === failed
      ? new Promise((resolve) => { releaseRetry = resolve })
      : undefined,
  })

  await assert.rejects(profile.submit([failed]), /failed:failed\.png/)
  retrying = true
  const retry = profile.submit([failed])
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(await profile.submit([failed]), 'busy')
  releaseRetry()
  assert.equal(await retry, 'completed')
  retrying = false
  assert.equal(await profile.submit([replacement]), 'completed')
  assert.deepEqual(profile.calls.prepare, ['failed.png', 'failed.png', 'replacement.png'])
  assert.deepEqual(profile.calls.finalize, ['failed.png', 'replacement.png'])
})

test('profile remount gets fresh success memory and cannot retain an old retry closure', async () => {
  const avatar = testFile('avatar.png', [10, 11])
  const firstMount = uploader(submissionGuard())
  assert.equal(await firstMount.submit([avatar]), 'completed')
  assert.equal(await firstMount.submit([avatar]), 'duplicate')

  const secondMount = uploader(submissionGuard())
  assert.equal(await secondMount.submit([avatar]), 'completed')
  assert.equal(secondMount.calls.prepare.length, 1)
})

test('business logo duplicate intent cannot cause an unintended A to B replacement', async () => {
  const guard = submissionGuard()
  const logo = testFile('logo.webp', [12, 13, 14], { type: 'image/webp' })
  const differentLogo = testFile('logo-new.webp', [15, 16, 17], { type: 'image/webp' })
  const logoUpload = uploader(guard)

  assert.equal(await logoUpload.submit([logo]), 'completed')
  assert.equal(await logoUpload.submit([logo]), 'duplicate')
  assert.equal(await logoUpload.submit([differentLogo]), 'completed')
  assert.deepEqual(logoUpload.calls.prepare, ['logo.webp', 'logo-new.webp'])
  assert.deepEqual(logoUpload.calls.finalize, ['logo.webp', 'logo-new.webp'])
})

test('business logo synchronous and double-retry submissions each start at most one workflow', async () => {
  const guard = submissionGuard()
  const logo = testFile('retry-logo.png', [18, 19])
  const logoUpload = uploader(guard, { failOnce: new Set(['retry-logo.png']) })
  await assert.rejects(logoUpload.submit([logo]), /failed:retry-logo\.png/)

  let unblock
  const guardedRetry = uploader(guard, { pause: () => new Promise((resolve) => { unblock = resolve }) })
  const firstRetry = guardedRetry.submit([logo])
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(await guardedRetry.submit([logo]), 'busy')
  unblock()
  assert.equal(await firstRetry, 'completed')
  assert.equal(guardedRetry.calls.prepare.length, 1)
})

test('gallery replay processes each distinct successful file only once', async () => {
  const guard = submissionGuard()
  const files = [
    testFile('a.png', [21]), testFile('b.png', [22]), testFile('c.png', [23]),
  ]
  const gallery = uploader(guard)
  assert.equal(await gallery.submit(files), 'completed')
  assert.equal(await gallery.submit(files), 'duplicate')
  assert.deepEqual(gallery.calls.prepare, ['a.png', 'b.png', 'c.png'])
  assert.deepEqual(gallery.calls.finalize, ['a.png', 'b.png', 'c.png'])
})

test('gallery retry skips committed members and resumes failed and unattempted members', async () => {
  const guard = submissionGuard()
  const files = [
    testFile('a.png', [31]), testFile('b.png', [32]), testFile('c.png', [33]),
  ]
  const gallery = uploader(guard, { failOnce: new Set(['b.png']) })
  await assert.rejects(gallery.submit(files), /failed:b\.png/)
  assert.equal(await gallery.submit(files), 'completed')
  assert.deepEqual(gallery.calls.prepare, ['a.png', 'b.png', 'b.png', 'c.png'])
  assert.deepEqual(gallery.calls.finalize, ['a.png', 'b.png', 'c.png'])
})

test('gallery content hashing distinguishes files with identical metadata but different bytes', async () => {
  const sharedMetadata = { size: 3, type: 'image/png', lastModified: 42 }
  const first = testFile('same.png', [41, 42, 43], sharedMetadata)
  const second = testFile('same.png', [41, 42, 44], sharedMetadata)
  const gallery = uploader(submissionGuard())

  assert.equal(await gallery.submit([first, second]), 'completed')
  assert.equal(gallery.calls.prepare.length, 2)
  assert.equal(gallery.calls.finalize.length, 2)
})
