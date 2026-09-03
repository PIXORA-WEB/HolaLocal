import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  TEST_BUSINESS_ID,
  TEST_LEGACY_GALLERY_PATH,
  TEST_LEGACY_GALLERY_URL,
  TEST_LEGACY_LOGO_PATH,
  TEST_LEGACY_LOGO_URL,
  TEST_PROJECT_ID,
  TEST_PUBLIC_BUSINESSES,
  TEST_PUBLIC_BUSINESS_IDS,
  TEST_STORAGE_BUCKET,
  TEST_STORAGE_EMULATOR_HOST,
  TEST_STORAGE_EMULATOR_PORT,
  assertLoopbackFixtureMediaUrl,
  normalizeStorageEmulatorHost,
  testLegacyMediaUrl,
} from './browser/fixtures.js'
import {
  SERVICE_TAXONOMY_SERVICE_IDS,
  isPublicBusinessEligible,
  normalizeLanguages,
  normalizeServiceAreas,
} from '../../../shared/firebase-contract/index.js'

const runnerUrl = new URL('./browser/runAdminBrowserPreview.mjs', import.meta.url)
const smokeRunnerUrl = new URL('./browser/runAdminBrowserSmoke.mjs', import.meta.url)
const environmentUrl = new URL('./browser/browserTestEnvironment.mjs', import.meta.url)
const seedUrl = new URL('./browser/seedAdminBrowser.mjs', import.meta.url)
const emulatorModeUrl = new URL('../src/firebase/emulatorMode.js', import.meta.url)

test('browser fixture identity and every Firebase endpoint are fixed to isolated loopback values', async () => {
  const [runner, smokeRunner, environment, seed, emulatorMode] = await Promise.all([
    readFile(runnerUrl, 'utf8'),
    readFile(smokeRunnerUrl, 'utf8'),
    readFile(environmentUrl, 'utf8'),
    readFile(seedUrl, 'utf8'),
    readFile(emulatorModeUrl, 'utf8'),
  ])

  assert.equal(TEST_PROJECT_ID, 'demo-holalocal-admin-browser')
  assert.equal(TEST_STORAGE_EMULATOR_HOST, '127.0.0.1')
  assert.equal(TEST_STORAGE_EMULATOR_PORT, '9199')
  assert.equal(TEST_STORAGE_BUCKET, 'demo-holalocal-admin-browser.appspot.com')
  for (const endpoint of ['127.0.0.1:9099', '127.0.0.1:8080']) {
    const pattern = new RegExp(endpoint.replaceAll('.', '\\.'))
    assert.match(environment, pattern)
    assert.match(seed, pattern)
  }
  assert.match(environment, /STORAGE_EMULATOR_HOST: '127\.0\.0\.1:9199'/)
  const normalizationIndex = seed.indexOf('normalizeStorageEmulatorHost(process.env.STORAGE_EMULATOR_HOST)')
  const assignmentIndex = seed.indexOf('process.env.STORAGE_EMULATOR_HOST = storageEmulatorHost')
  const storageUseIndex = seed.indexOf('getStorage(app)')
  assert.ok(normalizationIndex >= 0)
  assert.ok(assignmentIndex > normalizationIndex)
  assert.ok(storageUseIndex > assignmentIndex)
  assert.match(runner, /--mode browser-test --host 127\.0\.0\.1 --port 4175 --strictPort/)
  assert.match(environment, /VITE_BROWSER_TEST_RUNNER: 'true'/)
  assert.match(environment, /VITE_USE_FIREBASE_EMULATORS: 'true'/)
  assert.match(environment, /VITE_FUNCTIONS_EMULATOR_URL: 'http:\/\/127\.0\.0\.1:5001'/)
  assert.match(environment, /GOOGLE_APPLICATION_CREDENTIALS: ''/)
  assert.match(environment, /FIREBASE_TOKEN: ''/)
  assert.match(environment, /GOOGLE_OAUTH_ACCESS_TOKEN: ''/)
  assert.match(environment, /NO_GCE_CHECK: 'true'/)
  assert.match(runner, /createProtectedBrowserTestEnvironment/)
  assert.match(smokeRunner, /createProtectedBrowserTestEnvironment/)
  assert.doesNotMatch(emulatorMode, /startsWith\(/)
  assert.match(seed, /refuses application credentials/)
})

test('Storage emulator host accepts only the canonical HTTP endpoint and its exact legacy form', () => {
  const canonical = 'http://127.0.0.1:9199'
  assert.equal(normalizeStorageEmulatorHost(canonical), canonical)
  assert.equal(normalizeStorageEmulatorHost('127.0.0.1:9199'), canonical)

  for (const unsafe of [
    'https://127.0.0.1:9199',
    'http://localhost:9199',
    'http://127.0.0.1:9198',
    'http://127.0.0.1:9199/path',
    'http://127.0.0.1:9199?query=1',
    'http://127.0.0.1:9199#fragment',
    'http://user:pass@127.0.0.1:9199',
    'http://127.0.0.1:9199.example.com',
    'http://firebasestorage.googleapis.com',
    'https://storage.googleapis.com',
    '0.0.0.0:9199',
    '//127.0.0.1:9199',
    'http://[::1]:9199',
    '',
    'not a URL',
  ]) {
    assert.throws(() => normalizeStorageEmulatorHost(unsafe))
  }
})

test('fixture media URLs are encoded and restricted to the local Storage emulator', () => {
  const entries = [
    [TEST_LEGACY_LOGO_URL, TEST_LEGACY_LOGO_PATH],
    [TEST_LEGACY_GALLERY_URL, TEST_LEGACY_GALLERY_PATH],
    ...TEST_PUBLIC_BUSINESSES.flatMap((business) => [
      [testLegacyMediaUrl(business.logoStoragePath), business.logoStoragePath],
      ...business.galleryStoragePaths.map((path) => [testLegacyMediaUrl(path), path]),
    ]),
  ]
  for (const [url, storagePath] of entries) {
    assert.equal(assertLoopbackFixtureMediaUrl(url, storagePath), url)
    assert.equal(new URL(url).hostname, '127.0.0.1')
    assert.equal(new URL(url).port, '9199')
    assert.match(new URL(url).pathname, /%2F/)
    assert.doesNotMatch(url, /(?:firebasestorage|storage)\.googleapis\.com|holalocal-491c9/)
  }
  for (const unsafe of [
    'https://firebasestorage.googleapis.com/v0/b/demo/o/file?alt=media',
    'https://storage.googleapis.com/demo/file',
    'http://example.invalid:9199/v0/b/demo/o/file?alt=media',
    'https://127.0.0.1:9199/v0/b/demo/o/file?alt=media',
  ]) {
    assert.throws(() => assertLoopbackFixtureMediaUrl(unsafe))
  }
})

test('pending admin fixture remains distinct from two canonical active public QA businesses', () => {
  assert.equal(TEST_BUSINESS_ID, 'browser-smoke-business')
  assert.deepEqual(TEST_PUBLIC_BUSINESS_IDS, [
    'browser-public-business-short',
    'browser-public-business-long',
  ])
  assert.equal(new Set([TEST_BUSINESS_ID, ...TEST_PUBLIC_BUSINESS_IDS]).size, 3)
  assert.equal(TEST_PUBLIC_BUSINESSES.length, 2)

  for (const business of TEST_PUBLIC_BUSINESSES) {
    assert.equal(TEST_PUBLIC_BUSINESS_IDS.includes(business.businessId), true)
    assert.equal(SERVICE_TAXONOMY_SERVICE_IDS.includes(business.primaryCategoryId), true)
    assert.equal(business.categoryIds.every((id) => SERVICE_TAXONOMY_SERVICE_IDS.includes(id)), true)
    assert.deepEqual(normalizeLanguages(business.languages).identifiers, [...business.languages])
    assert.deepEqual(normalizeServiceAreas(business.serviceAreas).identifiers, [...business.serviceAreas])
    assert.equal(isPublicBusinessEligible({
      ...business,
      managerIds: [business.ownerId],
      contact: {
        phone: '', phoneVisible: false, email: '', emailVisible: false,
        whatsappNumber: '', whatsappVisible: false, website: '', websiteVisible: false,
        preferredContactMethod: 'holalocal', allowCallbackRequests: false,
      },
      status: 'active',
      publishedAt: new Date('2026-07-02T12:00:00.000Z'),
      deletionRequestedAt: null,
      deletedAt: null,
    }), true)
  }
  assert.notEqual(TEST_PUBLIC_BUSINESSES[0].name.length, TEST_PUBLIC_BUSINESSES[1].name.length)
  assert.notEqual(TEST_PUBLIC_BUSINESSES[0].description.length, TEST_PUBLIC_BUSINESSES[1].description.length)
})

test('seed reset and cleanup remain scoped to the exact fresh emulator project', async () => {
  const [runner, seed] = await Promise.all([readFile(runnerUrl, 'utf8'), readFile(seedUrl, 'utf8')])
  assert.match(runner, /firebase', \[/)
  assert.match(runner, /'emulators:exec'/)
  assert.match(runner, /'--project',\s*TEST_PROJECT_ID/)
  assert.match(runner, /'--only',\s*'auth,firestore,storage,functions'/)
  assert.match(seed, /GCLOUD_PROJECT !== TEST_PROJECT_ID/)
  assert.match(seed, /db\.doc\(`businesses\/\$\{TEST_BUSINESS_ID\}`\)\.set\([\s\S]*?status: 'pending_review',[\s\S]*?publishedAt: null,/)
  assert.match(seed, /for \(const \[index, fixture\] of TEST_PUBLIC_BUSINESSES\.entries\(\)\)[\s\S]*?status: 'active',[\s\S]*?publishedAt,/)
  assert.match(seed, /\/emulator\/v1\/projects\/\$\{TEST_PROJECT_ID\}\/accounts/)
  assert.match(seed, /\/emulator\/v1\/projects\/\$\{TEST_PROJECT_ID\}\/databases\/\(default\)\/documents/)
  assert.match(seed, /\/emulator\/v1\/projects\/\$\{TEST_PROJECT_ID\}\/buckets\/\$\{storageBucket\}/)
  assert.doesNotMatch(runner, /firebase\s+(?:deploy|use)|--project\s+holalocal-491c9/)
  assert.doesNotMatch(seed, /firebase\s+(?:deploy|use)|holalocal-491c9/)
})

test('Preview and Smoke inherit one identical protected core environment', async () => {
  const [runner, smokeRunner, environment] = await Promise.all([
    readFile(runnerUrl, 'utf8'),
    readFile(smokeRunnerUrl, 'utf8'),
    readFile(environmentUrl, 'utf8'),
  ])
  assert.match(runner, /createProtectedBrowserTestEnvironment/)
  assert.match(smokeRunner, /createProtectedBrowserTestEnvironment/)
  for (const name of [
    'VITE_BROWSER_TEST_RUNNER', 'VITE_USE_FIREBASE_EMULATORS', 'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_AUTH_EMULATOR_URL', 'VITE_FIRESTORE_EMULATOR_URL',
    'VITE_FUNCTIONS_EMULATOR_URL', 'VITE_STORAGE_EMULATOR_URL',
  ]) {
    assert.match(environment, new RegExp(`${name}:`), name)
    assert.doesNotMatch(`${runner}\n${smokeRunner}`, new RegExp(`${name}:`), `${name} is not duplicated`)
  }
})
