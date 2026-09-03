import {
  BROWSER_TEST_MODE,
  validateBrowserTestSafety,
} from './browserTestSafety.js'

const CONNECTIONS_KEY = Symbol.for('holalocal.firebaseEmulatorConnections')
const emulatorConnections = globalThis[CONNECTIONS_KEY] ??= new WeakSet()
let validatedConfiguration

function currentEnvironment() {
  return import.meta.env
}

export function getFirebaseEmulatorConfiguration() {
  const environment = currentEnvironment()
  if (validatedConfiguration !== undefined) return validatedConfiguration

  validatedConfiguration = validateBrowserTestSafety({
    mode: environment.MODE,
    production: environment.PROD === true,
    environment,
  })
  return validatedConfiguration
}

export function assertFirebaseBrowserTestSafety() {
  return getFirebaseEmulatorConfiguration()
}

export function shouldUseFirebaseEmulators() {
  const configuration = getFirebaseEmulatorConfiguration()
  if (currentEnvironment().MODE === BROWSER_TEST_MODE) return true
  return configuration !== null
}

export function getFirebaseEmulatorEndpoint(service) {
  const configuration = getFirebaseEmulatorConfiguration()
  if (!configuration?.endpoints?.[service]) {
    throw new Error(`Firebase ${service} emulator endpoint is unavailable outside protected browser-test mode.`)
  }
  return configuration.endpoints[service]
}

export function connectFirebaseEmulatorOnce(client, connect) {
  if (emulatorConnections.has(client)) return
  connect()
  emulatorConnections.add(client)
}
