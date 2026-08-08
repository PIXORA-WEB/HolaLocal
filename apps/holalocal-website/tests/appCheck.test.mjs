import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { initializeWebsiteAppCheck } from '../src/firebase/appCheckClient.js'

function browserGlobal() {
  return { document: {} }
}

function enabledEnvironment(overrides = {}) {
  return {
    VITE_FIREBASE_APPCHECK_ENABLED: 'true',
    VITE_FIREBASE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY: 'public-site-key',
    DEV: false,
    PROD: true,
    ...overrides,
  }
}

function sdkRecorder({ failure = null } = {}) {
  const calls = { providers: [], initializations: [] }
  class Provider {
    constructor(siteKey) {
      calls.providers.push(siteKey)
      if (failure === 'provider') throw new Error('provider contained secret-value')
    }
  }
  return {
    calls,
    sdk: {
      ReCaptchaEnterpriseProvider: Provider,
      initializeAppCheck(app, options) {
        calls.initializations.push({ app, options })
        if (failure === 'initialize') throw new Error('initialize contained secret-value')
        return { appCheckFor: app }
      },
    },
  }
}

test('disabled App Check and non-browser contexts skip provider initialization', () => {
  const disabled = sdkRecorder()
  assert.equal(initializeWebsiteAppCheck({}, {
    environment: { VITE_FIREBASE_APPCHECK_ENABLED: 'false' },
    globalObject: browserGlobal(),
    sdk: disabled.sdk,
  }), null)
  assert.deepEqual(disabled.calls.initializations, [])

  const server = sdkRecorder()
  assert.equal(initializeWebsiteAppCheck({}, {
    environment: enabledEnvironment(),
    globalObject: {},
    sdk: server.sdk,
  }), null)
  assert.deepEqual(server.calls.initializations, [])
})

test('enabled browser initialization uses Enterprise, auto-refresh and one attempt per app', () => {
  const app = {}
  const recorder = sdkRecorder()
  const options = {
    environment: enabledEnvironment(),
    globalObject: browserGlobal(),
    isFirebaseEmulatorMode: () => false,
    sdk: recorder.sdk,
  }
  const first = initializeWebsiteAppCheck(app, options)
  const second = initializeWebsiteAppCheck(app, options)

  assert.equal(first, second)
  assert.deepEqual(recorder.calls.providers, ['public-site-key'])
  assert.equal(recorder.calls.initializations.length, 1)
  assert.equal(recorder.calls.initializations[0].app, app)
  assert.equal(recorder.calls.initializations[0].options.isTokenAutoRefreshEnabled, true)
  assert.ok(recorder.calls.initializations[0].options.provider instanceof recorder.sdk.ReCaptchaEnterpriseProvider)
})

test('missing site key fails safely, warns once and leaves later application work usable', () => {
  const app = {}
  const recorder = sdkRecorder()
  const warnings = []
  const options = {
    environment: enabledEnvironment({ VITE_FIREBASE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY: '' }),
    globalObject: browserGlobal(),
    isFirebaseEmulatorMode: () => false,
    sdk: recorder.sdk,
    logger: { warn: (message) => warnings.push(message) },
  }

  assert.doesNotThrow(() => initializeWebsiteAppCheck(app, options))
  assert.equal(initializeWebsiteAppCheck(app, options), null)
  assert.equal(warnings.length, 1)
  assert.deepEqual(recorder.calls.initializations, [])
  const createFirebaseService = (firebaseApp) => ({ app: firebaseApp })
  assert.equal(createFirebaseService(app).app, app)
})

for (const failure of ['provider', 'initialize']) {
  test(`${failure} failure is contained without logging configuration or exception values`, () => {
    const recorder = sdkRecorder({ failure })
    const warnings = []
    assert.equal(initializeWebsiteAppCheck({}, {
      environment: enabledEnvironment({
        VITE_FIREBASE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY: 'secret-site-key-value',
        VITE_FIREBASE_APPCHECK_DEBUG_TOKEN: 'secret-debug-token-value',
      }),
      globalObject: browserGlobal(),
      isFirebaseEmulatorMode: () => false,
      sdk: recorder.sdk,
      logger: { warn: (message) => warnings.push(message) },
    }), null)
    assert.equal(warnings.length, 1)
    assert.doesNotMatch(warnings[0], /secret|token|key-value/i)
  })
}

test('emulator browser-test mode skips App Check without touching provider code', () => {
  const recorder = sdkRecorder()
  assert.equal(initializeWebsiteAppCheck({}, {
    environment: enabledEnvironment(),
    globalObject: browserGlobal(),
    isFirebaseEmulatorMode: () => true,
    sdk: recorder.sdk,
  }), null)
  assert.deepEqual(recorder.calls.providers, [])
  assert.deepEqual(recorder.calls.initializations, [])
})

test('debug mode supports generated and fixed tokens only in non-production development', () => {
  for (const [configured, expected] of [['true', true], ['fixed-local-token', 'fixed-local-token']]) {
    const globalObject = browserGlobal()
    const recorder = sdkRecorder()
    initializeWebsiteAppCheck({}, {
      environment: enabledEnvironment({
        DEV: true,
        PROD: false,
        VITE_FIREBASE_APPCHECK_DEBUG_TOKEN: configured,
      }),
      globalObject,
      isFirebaseEmulatorMode: () => false,
      sdk: recorder.sdk,
    })
    assert.equal(globalObject.FIREBASE_APPCHECK_DEBUG_TOKEN, expected)
  }

  for (const environment of [
    enabledEnvironment({ DEV: false, PROD: true, VITE_FIREBASE_APPCHECK_DEBUG_TOKEN: 'production-token' }),
    enabledEnvironment({ DEV: true, PROD: true, VITE_FIREBASE_APPCHECK_DEBUG_TOKEN: 'production-token' }),
  ]) {
    const globalObject = browserGlobal()
    initializeWebsiteAppCheck({}, {
      environment,
      globalObject,
      isFirebaseEmulatorMode: () => false,
      sdk: sdkRecorder().sdk,
    })
    assert.equal(Object.hasOwn(globalObject, 'FIREBASE_APPCHECK_DEBUG_TOKEN'), false)
  }
})

test('Firebase App Check is attempted synchronously before service clients receive the app', async () => {
  const [config, auth, firestore, functions, storage] = await Promise.all([
    readFile(new URL('../src/firebase/config.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/firebase/auth.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/firebase/firestoreClient.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/firebase/functionsClient.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/firebase/storageClient.js', import.meta.url), 'utf8'),
  ])
  const appCreation = config.indexOf('firebaseApp = getApps()')
  const appCheckAttempt = config.indexOf('initializeWebsiteAppCheck(firebaseApp)')
  const appReturn = config.indexOf('return firebaseApp', appCreation)
  assert.ok(appCreation >= 0 && appCreation < appCheckAttempt && appCheckAttempt < appReturn)
  assert.match(auth, /getAuth\(getFirebaseApp\(\)\)/)
  assert.match(firestore, /getFirestore\(getFirebaseApp\(\)\)/)
  assert.match(functions, /getFunctions\(getFirebaseApp\(\), 'europe-west1'\)/)
  assert.match(storage, /getStorage\(getFirebaseApp\(\)\)/)
})

test('all website callables remain standard httpsCallable declarations with no custom App Check headers', async () => {
  const source = await readFile(new URL('../src/firebase/functionsClient.js', import.meta.url), 'utf8')
  const callables = [
    'listPublicBusinesses', 'getPublicBusiness', 'recordBusinessInsight', 'ensureOwnerBusiness',
    'updateAccountRole', 'sendMessage', 'getOwnerSubscriptionStatus', 'getOwnerBusinessInsights',
    'moderateBusiness', 'getAdminBusinessReview', 'assignBusinessSubscriptionPlan',
  ]
  for (const callable of callables) {
    assert.match(source, new RegExp(`httpsCallable\\(functions, '${callable}'\\)`), callable)
  }
  assert.doesNotMatch(source, /X-Firebase-AppCheck|FIREBASE_APPCHECK_DEBUG_TOKEN/)
  assert.doesNotMatch(source, /countBusinessEnquiry/)
})
