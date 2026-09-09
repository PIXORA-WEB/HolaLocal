export const BROWSER_TEST_MODE = 'browser-test'
export const BROWSER_TEST_PROJECT_ID = 'demo-holalocal-admin-browser'

export const BROWSER_TEST_ENVIRONMENT_KEYS = Object.freeze({
  marker: 'VITE_BROWSER_TEST_RUNNER',
  emulatorFlag: 'VITE_USE_FIREBASE_EMULATORS',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  auth: 'VITE_FIREBASE_AUTH_EMULATOR_URL',
  firestore: 'VITE_FIRESTORE_EMULATOR_URL',
  functions: 'VITE_FUNCTIONS_EMULATOR_URL',
  storage: 'VITE_STORAGE_EMULATOR_URL',
})

const ENDPOINT_REQUIREMENTS = Object.freeze({
  auth: Object.freeze({ port: 9099 }),
  firestore: Object.freeze({ port: 8080 }),
  functions: Object.freeze({ port: 5001 }),
  storage: Object.freeze({ port: 9199 }),
})

function safetyError(name, reason) {
  return new Error(`Unsafe browser-test configuration: ${name} ${reason}.`)
}

function requiredExactValue(environment, name, expected) {
  const value = environment?.[name]
  if (value !== expected) {
    throw safetyError(name, value == null || value === '' ? 'is required' : 'is invalid')
  }
  return value
}

function validatedEndpoint(environment, service) {
  const name = BROWSER_TEST_ENVIRONMENT_KEYS[service]
  const value = environment?.[name]
  if (typeof value !== 'string' || value === '') throw safetyError(name, 'is required')

  let url
  try {
    url = new URL(value)
  } catch {
    throw safetyError(name, 'must be a valid absolute URL')
  }

  // A separate fixed port set keeps onboarding regressions isolated from other local demos.
  const offset = environment.VITE_ONBOARDING_REGRESSION === 'true' ? 10000 : 0
  const expectedPort = String(ENDPOINT_REQUIREMENTS[service].port + offset)
  if (
    url.protocol !== 'http:'
    || url.hostname !== '127.0.0.1'
    || url.port !== expectedPort
    || url.username !== ''
    || url.password !== ''
    || (url.pathname !== '' && url.pathname !== '/')
    || url.search !== ''
    || url.hash !== ''
  ) {
    throw safetyError(name, 'must use its exact approved HTTP loopback endpoint')
  }

  return Object.freeze({
    host: url.hostname,
    port: Number(url.port),
    url: `http://${url.hostname}:${url.port}`,
  })
}

export function validateBrowserTestSafety({ mode, production = false, environment = {} } = {}) {
  const requested = environment[BROWSER_TEST_ENVIRONMENT_KEYS.emulatorFlag] === 'true'
  const marked = environment[BROWSER_TEST_ENVIRONMENT_KEYS.marker] === 'true'

  if (mode !== BROWSER_TEST_MODE) {
    if (requested || marked) {
      throw new Error('Browser-test emulator configuration is restricted to browser-test mode.')
    }
    return null
  }

  if (production === true) {
    throw new Error('Browser-test mode cannot run as a production build.')
  }

  requiredExactValue(environment, BROWSER_TEST_ENVIRONMENT_KEYS.marker, 'true')
  requiredExactValue(environment, BROWSER_TEST_ENVIRONMENT_KEYS.emulatorFlag, 'true')
  const projectId = requiredExactValue(
    environment,
    BROWSER_TEST_ENVIRONMENT_KEYS.projectId,
    BROWSER_TEST_PROJECT_ID,
  )

  return Object.freeze({
    projectId,
    endpoints: Object.freeze({
      auth: validatedEndpoint(environment, 'auth'),
      firestore: validatedEndpoint(environment, 'firestore'),
      functions: validatedEndpoint(environment, 'functions'),
      storage: validatedEndpoint(environment, 'storage'),
    }),
  })
}
