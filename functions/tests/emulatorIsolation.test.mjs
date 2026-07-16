import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  assertCredentialIsolation,
  assertDemoProject,
  assertEmulatorCache,
  buildIsolatedEnv,
  parseProjectId,
} from '../scripts/runIsolatedEmulatorTests.mjs'

test('callable emulator harness accepts demo projects only', () => {
  assert.doesNotThrow(() => assertDemoProject('demo-holalocal-functions'))
  assert.throws(() => assertDemoProject('holalocal-491c9'), /non-demo project/)
  assert.throws(() => assertDemoProject('prod-like-project'), /non-demo project/)
})

test('callable emulator harness rejects detectable application default credentials', () => {
  assert.doesNotThrow(() => assertCredentialIsolation({}))
  assert.throws(() => assertCredentialIsolation({
    GOOGLE_APPLICATION_CREDENTIALS: '/private/key.json',
  }), /GOOGLE_APPLICATION_CREDENTIALS/)
})

test('callable emulator harness builds isolated demo-only environment', async () => {
  const cache = await mkdtemp(join(tmpdir(), 'holalocal-emulator-cache-test-'))
  await writeFile(join(cache, 'cloud-firestore-emulator-v1.19.8.jar'), '')
  const env = await buildIsolatedEnv('demo-holalocal-functions', {
    PATH: process.env.PATH,
    FIREBASE_EMULATORS_PATH: cache,
  })

  assert.equal(env.GCLOUD_PROJECT, 'demo-holalocal-functions')
  assert.equal(env.GOOGLE_CLOUD_PROJECT, 'demo-holalocal-functions')
  assert.equal(JSON.parse(env.FIREBASE_CONFIG).projectId, 'demo-holalocal-functions')
  assert.equal(env.GOOGLE_APPLICATION_CREDENTIALS, '')
  assert.equal(env.FIREBASE_EMULATORS_PATH, cache)
  assert.equal(env.MESSAGE_TRANSLATION_PROVIDER, 'disabled')
  assert.match(env.HOME, /holalocal-functions-emulator-/)
  assert.match(env.CLOUDSDK_CONFIG, /holalocal-functions-emulator-/)
  assert.match(env.XDG_CONFIG_HOME, /holalocal-functions-emulator-/)
})

test('callable emulator harness requires a preseeded Firestore emulator cache', async () => {
  const emptyCache = await mkdtemp(join(tmpdir(), 'holalocal-empty-cache-test-'))
  await assert.rejects(() => assertEmulatorCache(emptyCache), /Firestore emulator jar/)
  await assert.rejects(() => assertEmulatorCache(join(tmpdir(), 'missing-holalocal-cache')), /preseeded emulator cache/)
})

test('callable emulator harness parses project argument', () => {
  assert.equal(parseProjectId(['--project', 'demo-test']), 'demo-test')
  assert.equal(parseProjectId([]), 'demo-holalocal-functions')
})
