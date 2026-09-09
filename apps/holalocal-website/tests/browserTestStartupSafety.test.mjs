import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import viteConfiguration from '../vite.config.js'
import {
  BROWSER_TEST_PROJECT_ID,
  validateBrowserTestSafety,
} from '../src/firebase/browserTestSafety.js'
import {
  ADMIN_BROWSER_ACCEPTANCE_PLAN,
  ADMIN_BROWSER_SCENARIO_TITLES,
  adminBrowserEmulatorArguments,
  adminBrowserPlaywrightArguments,
  getAdminBrowserLifecycle,
  parseAdminBrowserSmokeArguments,
} from './browser/adminBrowserSmokeSelection.mjs'

const approvedEnvironment = Object.freeze({
  VITE_BROWSER_TEST_RUNNER: 'true',
  VITE_USE_FIREBASE_EMULATORS: 'true',
  VITE_FIREBASE_PROJECT_ID: BROWSER_TEST_PROJECT_ID,
  VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
  VITE_FIRESTORE_EMULATOR_URL: 'http://127.0.0.1:8080',
  VITE_FUNCTIONS_EMULATOR_URL: 'http://127.0.0.1:5001',
  VITE_STORAGE_EMULATOR_URL: 'http://127.0.0.1:9199',
})

function validate(environment = approvedEnvironment, overrides = {}) {
  return validateBrowserTestSafety({
    mode: 'browser-test',
    production: false,
    environment,
    ...overrides,
  })
}

test('only the complete exact browser-test configuration is accepted', () => {
  const configuration = validate()
  assert.equal(configuration.projectId, BROWSER_TEST_PROJECT_ID)
  assert.deepEqual(configuration.endpoints, {
    auth: { host: '127.0.0.1', port: 9099, url: 'http://127.0.0.1:9099' },
    firestore: { host: '127.0.0.1', port: 8080, url: 'http://127.0.0.1:8080' },
    functions: { host: '127.0.0.1', port: 5001, url: 'http://127.0.0.1:5001' },
    storage: { host: '127.0.0.1', port: 9199, url: 'http://127.0.0.1:9199' },
  })
})

for (const name of [
  'VITE_BROWSER_TEST_RUNNER',
  'VITE_USE_FIREBASE_EMULATORS',
  'VITE_FIREBASE_AUTH_EMULATOR_URL',
  'VITE_FIRESTORE_EMULATOR_URL',
  'VITE_FUNCTIONS_EMULATOR_URL',
  'VITE_STORAGE_EMULATOR_URL',
]) {
  test(`browser-test rejects missing ${name}`, () => {
    const environment = { ...approvedEnvironment }
    delete environment[name]
    assert.throws(() => validate(environment), new RegExp(name))
  })
}

for (const projectId of ['demo-another-project', 'holalocal-491c9', '', 'example-project']) {
  test(`browser-test rejects project ${projectId || '(missing)'}`, () => {
    assert.throws(() => validate({ ...approvedEnvironment, VITE_FIREBASE_PROJECT_ID: projectId }), /VITE_FIREBASE_PROJECT_ID/)
  })
}

const endpointVariables = {
  VITE_FIREBASE_AUTH_EMULATOR_URL: 9099,
  VITE_FIRESTORE_EMULATOR_URL: 8080,
  VITE_FUNCTIONS_EMULATOR_URL: 5001,
  VITE_STORAGE_EMULATOR_URL: 9199,
}

for (const [name, port] of Object.entries(endpointVariables)) {
  for (const [caseName, value] of [
    ['HTTPS', `https://127.0.0.1:${port}`],
    ['localhost', `http://localhost:${port}`],
    ['non-loopback host', `http://example.invalid:${port}`],
    ['wrong port', `http://127.0.0.1:${port + 1}`],
    ['credentials', `http://user:password@127.0.0.1:${port}`],
    ['path', `http://127.0.0.1:${port}/path`],
    ['query', `http://127.0.0.1:${port}?query=1`],
    ['fragment', `http://127.0.0.1:${port}#fragment`],
    ['IPv6', `http://[::1]:${port}`],
    ['unspecified address', `http://0.0.0.0:${port}`],
    ['protocol-relative URL', `//127.0.0.1:${port}`],
    ['malformed URL', 'not a URL'],
  ]) {
    test(`${name} rejects ${caseName}`, () => {
      assert.throws(() => validate({ ...approvedEnvironment, [name]: value }), new RegExp(name))
    })
  }
}

test('browser-test rejects production while other modes remain unchanged', () => {
  assert.throws(() => validate(approvedEnvironment, { production: true }), /cannot run as a production build/)
  assert.equal(validateBrowserTestSafety({ mode: 'development', environment: {} }), null)
  assert.equal(validateBrowserTestSafety({ mode: 'production', production: true, environment: {} }), null)
  assert.throws(
    () => validateBrowserTestSafety({ mode: 'development', environment: { VITE_USE_FIREBASE_EMULATORS: 'true' } }),
    /restricted to browser-test mode/,
  )
})

test('Vite evaluates the fail-closed guard before returning browser-test configuration', async () => {
  const names = Object.keys(approvedEnvironment)
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]))
  for (const name of names) delete process.env[name]
  try {
    assert.throws(
      () => viteConfiguration({ command: 'serve', mode: 'browser-test' }),
      /Unsafe browser-test configuration: VITE_BROWSER_TEST_RUNNER is required/,
    )
    assert.doesNotThrow(() => viteConfiguration({ command: 'serve', mode: 'development' }))
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name]
      else process.env[name] = previous[name]
    }
  }

  const source = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8')
  assert.match(source, /defineConfig\(\(\{ command, mode \}\) =>/)
  assert.match(source, /loadEnv\(mode, process\.cwd\(\), ''\)/)
  assert.ok(source.indexOf('validateBrowserTestSafety') < source.indexOf('return {'))
})

test('Firebase, Analytics and App Check boundaries remain fail closed without remote fallbacks', async () => {
  const [config, main, analytics, appCheck, index, ...clients] = await Promise.all([
    readFile(new URL('../src/firebase/config.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/firebase/analyticsClient.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/firebase/appCheckClient.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    ...['auth.js', 'firestoreClient.js', 'functionsClient.js', 'storageClient.js'].map((file) => (
      readFile(new URL(`../src/firebase/${file}`, import.meta.url), 'utf8')
    )),
  ])
  assert.ok(config.indexOf('assertFirebaseBrowserTestSafety()') < config.indexOf('initializeApp(firebaseConfig)'))
  assert.ok(config.indexOf('assertFirebaseBrowserTestSafety()') < config.indexOf('initializeWebsiteAppCheck(firebaseApp)'))
  assert.match(main, /MODE !== 'browser-test'/)
  assert.match(analytics, /MODE === 'browser-test'[\s\S]*?shouldUseFirebaseEmulators\(\)[\s\S]*?return null/)
  assert.match(appCheck, /isFirebaseEmulatorMode\(\)/)
  assert.doesNotMatch(index, /googletagmanager|gtag\(|google-analytics/i)
  for (const client of clients) {
    assert.match(client, /getFirebaseEmulatorEndpoint/)
    assert.doesNotMatch(client, /googleapis\.com|firebaseio\.com|firebaseapp\.com/)
  }
})

test('admin browser runner no-argument invocation selects the complete fixed acceptance plan', () => {
  const selection = parseAdminBrowserSmokeArguments([])
  assert.deepEqual(selection, {
    lifecycleIds: ['lifecycle-a', 'lifecycle-b', 'lifecycle-c'],
    mode: 'acceptance',
  })
})

test('admin browser runner maps the fixed route-claims alias to one exact scenario with zero retries', () => {
  const selection = parseAdminBrowserSmokeArguments(['--scenario', 'route-claims'])
  assert.deepEqual(selection, {
    lifecycleIds: ['lifecycle-b'],
    mode: 'diagnostic',
  })
  assert.deepEqual(getAdminBrowserLifecycle('lifecycle-b').scenarioTitles, [ADMIN_BROWSER_SCENARIO_TITLES[1]])
  assert.equal(adminBrowserPlaywrightArguments('lifecycle-b').at(-1), '--retries=0')
})

for (const [name, args] of [
  ['unknown alias', ['--scenario', 'subscription']],
  ['missing alias value', ['--scenario']],
  ['duplicate selector', ['--scenario', 'route-claims', '--scenario', 'route-claims']],
  ['unknown flag', ['--project', 'demo-holalocal-admin-browser']],
  ['positional argument', ['route-claims']],
  ['raw grep', ['--grep', 'route claims']],
  ['arbitrary Playwright argument', ['--retries=9']],
]) {
  test(`admin browser runner rejects ${name} before environment startup`, () => {
    assert.throws(
      () => parseAdminBrowserSmokeArguments(args),
      /accepts only --scenario route-claims or no arguments/,
    )
  })
}

test('admin browser emulator arguments use one fixed inner command and retain protected services', () => {
  assert.deepEqual(adminBrowserEmulatorArguments(BROWSER_TEST_PROJECT_ID), [
    'emulators:exec',
    '--config',
    '../../firebase.json',
    '--project',
    BROWSER_TEST_PROJECT_ID,
    '--only',
    'auth,firestore,storage,functions',
    'node tests/browser/runAdminBrowserSmokeInsideEmulators.mjs',
  ])
})

test('acceptance plan covers all four scenarios exactly once in original order', () => {
  const plannedTitles = ADMIN_BROWSER_ACCEPTANCE_PLAN.flatMap(({ scenarioTitles }) => scenarioTitles)
  assert.deepEqual(plannedTitles, ADMIN_BROWSER_SCENARIO_TITLES)
  assert.equal(new Set(plannedTitles).size, 4)
  assert.deepEqual(ADMIN_BROWSER_ACCEPTANCE_PLAN.map(({ id }) => id), [
    'lifecycle-a', 'lifecycle-b', 'lifecycle-c',
  ])
  assert.deepEqual(ADMIN_BROWSER_ACCEPTANCE_PLAN[1].scenarioTitles, [ADMIN_BROWSER_SCENARIO_TITLES[1]])
  assert.deepEqual(ADMIN_BROWSER_ACCEPTANCE_PLAN[2].scenarioTitles, [
    ADMIN_BROWSER_SCENARIO_TITLES[2], ADMIN_BROWSER_SCENARIO_TITLES[3],
  ])
  for (const lifecycle of ADMIN_BROWSER_ACCEPTANCE_PLAN) {
    assert.equal(lifecycle.retries, 0)
    const args = adminBrowserPlaywrightArguments(lifecycle.id)
    assert.deepEqual(args.slice(0, 4), ['test', '--config', 'playwright.admin.config.js', '--grep'])
    assert.equal(args.at(-1), '--retries=0')
    for (const title of ADMIN_BROWSER_SCENARIO_TITLES) {
      assert.equal(new RegExp(lifecycle.selectionPattern).test(title), lifecycle.scenarioTitles.includes(title))
    }
  }
})

test('runner validates arguments before environments and uses fixed-array child boundaries', async () => {
  const [source, innerSource, packageSource] = await Promise.all([
    readFile(new URL('./browser/runAdminBrowserSmoke.mjs', import.meta.url), 'utf8'),
    readFile(new URL('./browser/runAdminBrowserSmokeInsideEmulators.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
  ])
  const parse = source.indexOf('parseAdminBrowserSmokeArguments(process.argv.slice(2))')
  const environment = source.indexOf('await createProtectedBrowserTestEnvironment')
  assert.ok(parse >= 0 && parse < environment)
  assert.match(source, /adminBrowserEmulatorArguments\(TEST_PROJECT_ID\)/)
  assert.match(innerSource, /spawn\('playwright', adminBrowserPlaywrightArguments\(lifecycle\.id\)/)
  assert.ok(innerSource.indexOf("import('./seedAdminBrowser.mjs')")
    < innerSource.indexOf("import('./warmAdminBrowser.mjs')"))
  assert.ok(innerSource.indexOf("import('./warmAdminBrowser.mjs')") < innerSource.indexOf("spawn('playwright'"))
  assert.doesNotMatch(source, /process\.argv[\s\S]*?--grep|\.join\(['"] ['"]\)/)
  assert.doesNotMatch(innerSource, /exec\(|execFile\(|&&/)
  assert.equal(JSON.parse(packageSource).scripts['test:admin-browser'], 'node tests/browser/runAdminBrowserSmoke.mjs')
})

test('onboarding test ports are isolated and remain restricted to loopback demo development', () => {
  const environment = {
    ...approvedEnvironment,
    VITE_ONBOARDING_REGRESSION: 'true',
    VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://127.0.0.1:19099',
    VITE_FIRESTORE_EMULATOR_URL: 'http://127.0.0.1:18080',
    VITE_FUNCTIONS_EMULATOR_URL: 'http://127.0.0.1:15001',
    VITE_STORAGE_EMULATOR_URL: 'http://127.0.0.1:19199',
  }
  assert.equal(validate(environment).endpoints.storage.port, 19199)
  assert.throws(() => validate(environment, { production: true }))
  assert.throws(() => validate({ ...environment, VITE_FIREBASE_PROJECT_ID: 'holalocal-491c9' }))
  assert.throws(() => validate({ ...environment, VITE_STORAGE_EMULATOR_URL: 'http://example.com:19199' }))
  assert.throws(() => validate({ ...environment, VITE_STORAGE_EMULATOR_URL: 'http://127.0.0.1:9199' }))
})
