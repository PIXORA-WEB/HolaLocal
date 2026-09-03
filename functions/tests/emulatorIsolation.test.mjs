import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  assertCredentialIsolation,
  assertCallableBoundaryEnvironment,
  assertDemoProject,
  assertEmulatorCache,
  buildIsolatedEnv,
  parseProjectId,
} from '../scripts/runIsolatedEmulatorTests.mjs'

test('callable emulator harness accepts demo projects only', () => {
  assert.doesNotThrow(() => assertDemoProject('demo-holalocal-functions'))
  assert.throws(() => assertDemoProject('holalocal-491c9'), /non-demo project/)
  assert.throws(() => assertDemoProject('demo-other-project'), /non-demo project/)
  assert.throws(() => assertDemoProject('prod-like-project'), /non-demo project/)
})

test('callable emulator harness rejects detectable application default credentials', () => {
  assert.doesNotThrow(() => assertCredentialIsolation({}))
  for (const name of [
    'GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_TOKEN', 'GOOGLE_OAUTH_ACCESS_TOKEN',
  ]) {
    assert.throws(() => assertCredentialIsolation({ [name]: 'synthetic-value' }), new RegExp(name))
  }
})

test('callable emulator harness builds isolated demo-only environment', async () => {
  const cache = await mkdtemp(join(tmpdir(), 'holalocal-emulator-cache-test-'))
  await writeFile(join(cache, 'cloud-firestore-emulator-v1.19.8.jar'), '')
  await writeFile(join(cache, 'cloud-storage-rules-runtime-v1.1.3.jar'), '')
  const env = await buildIsolatedEnv('demo-holalocal-functions', {
    PATH: process.env.PATH,
    FIREBASE_EMULATORS_PATH: cache,
  })

  assert.equal(env.GCLOUD_PROJECT, 'demo-holalocal-functions')
  assert.equal(env.GOOGLE_CLOUD_PROJECT, 'demo-holalocal-functions')
  assert.deepEqual(JSON.parse(env.FIREBASE_CONFIG), {
    projectId: 'demo-holalocal-functions',
    storageBucket: 'demo-holalocal-functions.appspot.com',
  })
  assert.equal(env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099')
  assert.equal(env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080')
  assert.equal(env.FIREBASE_STORAGE_EMULATOR_HOST, '127.0.0.1:9199')
  assert.equal(env.STORAGE_EMULATOR_HOST, 'http://127.0.0.1:9199')
  assert.equal(env.GOOGLE_APPLICATION_CREDENTIALS, '')
  assert.equal(env.FIREBASE_TOKEN, '')
  assert.equal(env.GOOGLE_OAUTH_ACCESS_TOKEN, '')
  assert.equal(env.FIREBASE_EMULATORS_PATH, cache)
  assert.equal(env.MESSAGE_TRANSLATION_PROVIDER, 'disabled')
  assert.match(env.HOME, /holalocal-functions-emulator-/)
  assert.match(env.CLOUDSDK_CONFIG, /holalocal-functions-emulator-/)
  assert.match(env.XDG_CONFIG_HOME, /holalocal-functions-emulator-/)
})

test('callable emulator harness requires a preseeded Firestore emulator cache', async () => {
  const emptyCache = await mkdtemp(join(tmpdir(), 'holalocal-empty-cache-test-'))
  await assert.rejects(() => assertEmulatorCache(emptyCache), /Firestore emulator jar/)
  await writeFile(join(emptyCache, 'cloud-firestore-emulator-v1.19.8.jar'), '')
  await assert.rejects(() => assertEmulatorCache(emptyCache), /Storage emulator jar/)
  await assert.rejects(() => assertEmulatorCache(join(tmpdir(), 'missing-holalocal-cache')), /preseeded emulator cache/)
})

test('callable boundary environment requires exact local services and demo bucket', () => {
  const valid = {
    GCLOUD_PROJECT: 'demo-holalocal-functions',
    GOOGLE_CLOUD_PROJECT: 'demo-holalocal-functions',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
    STORAGE_EMULATOR_HOST: 'http://127.0.0.1:9199',
    FIREBASE_CONFIG: JSON.stringify({
      projectId: 'demo-holalocal-functions',
      storageBucket: 'demo-holalocal-functions.appspot.com',
    }),
    GOOGLE_APPLICATION_CREDENTIALS: '',
    FIREBASE_TOKEN: '',
    GOOGLE_OAUTH_ACCESS_TOKEN: '',
    MESSAGE_TRANSLATION_PROVIDER: 'disabled',
  }
  assert.doesNotThrow(() => assertCallableBoundaryEnvironment(valid))
  for (const update of [
    { FIREBASE_AUTH_EMULATOR_HOST: '' },
    { FIRESTORE_EMULATOR_HOST: 'firestore.example:8080' },
    { FIREBASE_STORAGE_EMULATOR_HOST: '' },
    { FIREBASE_STORAGE_EMULATOR_HOST: 'storage.example:9199' },
    { STORAGE_EMULATOR_HOST: 'https://storage.example' },
    { FIREBASE_CONFIG: JSON.stringify({ projectId: 'demo-holalocal-functions' }) },
    { FIREBASE_CONFIG: JSON.stringify({ projectId: 'demo-holalocal-functions', storageBucket: 'holalocal-491c9.firebasestorage.app' }) },
    { FIREBASE_CONFIG: JSON.stringify({ projectId: 'holalocal-491c9', storageBucket: 'holalocal-491c9.firebasestorage.app' }) },
    { FIREBASE_TOKEN: 'synthetic-value' },
    { MESSAGE_TRANSLATION_PROVIDER: 'remote' },
  ]) {
    assert.throws(() => assertCallableBoundaryEnvironment({ ...valid, ...update }))
  }
})

test('callable emulator harness parses project argument', () => {
  assert.equal(
    parseProjectId(['--project', 'demo-holalocal-functions']),
    'demo-holalocal-functions',
  )
  assert.equal(parseProjectId([]), 'demo-holalocal-functions')
  for (const argv of [
    ['--project'],
    ['--project', 'demo-holalocal-functions', '--extra'],
    ['--project', 'demo-holalocal-functions', '--project', 'demo-other-project'],
    ['demo-holalocal-functions'],
    ['--test', 'tests/other.test.mjs'],
  ]) {
    assert.throws(() => parseProjectId(argv), /accept only/)
  }
})

test('callable emulator harness fixes Auth Firestore Functions Storage and test selection', async () => {
  const { readFile } = await import('node:fs/promises')
  const [runner, boundary] = await Promise.all([
    readFile(new URL('../scripts/runIsolatedEmulatorTests.mjs', import.meta.url), 'utf8'),
    readFile(new URL('./callableBoundary.test.mjs', import.meta.url), 'utf8'),
  ])
  assert.match(runner, /'auth,firestore,functions,storage'/)
  assert.match(runner, /'node --test tests\/callableBoundary\.test\.mjs'/)
  assert.doesNotMatch(runner, /process\.argv.*node --test/)
  for (const fixedTest of [
    'accountDeletionPrimitivesEmulator.test.mjs',
    'accountDeletionCallableEmulator.test.mjs',
    'businessInsightsEmulator.test.mjs',
    'businessMediaEmulator.test.mjs',
    'savedBusinessesEmulator.test.mjs',
  ]) {
    assert.match(boundary, new RegExp(fixedTest.replaceAll('.', '\\.')))
  }
})
