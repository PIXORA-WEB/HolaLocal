const EMULATOR_MODE = 'browser-test'
const DEMO_PROJECT_PREFIX = 'demo-'
const CONNECTIONS_KEY = Symbol.for('holalocal.firebaseEmulatorConnections')
const emulatorConnections = globalThis[CONNECTIONS_KEY] ??= new WeakSet()

export const FIREBASE_EMULATOR_ENDPOINTS = Object.freeze({
  auth: Object.freeze({ host: '127.0.0.1', port: 9099 }),
  firestore: Object.freeze({ host: '127.0.0.1', port: 8080 }),
  functions: Object.freeze({ host: '127.0.0.1', port: 5001 }),
  storage: Object.freeze({ host: '127.0.0.1', port: 9199 }),
})

export function shouldUseFirebaseEmulators() {
  const requested = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
  if (!requested) return false

  if (import.meta.env.MODE !== EMULATOR_MODE || import.meta.env.PROD) {
    throw new Error('Firebase emulator mode is restricted to the browser-test Vite development mode.')
  }
  if (!import.meta.env.VITE_FIREBASE_PROJECT_ID?.startsWith(DEMO_PROJECT_PREFIX)) {
    throw new Error('Firebase emulator mode requires an explicit demo-* Firebase project ID.')
  }
  return true
}

export function connectFirebaseEmulatorOnce(client, connect) {
  if (emulatorConnections.has(client)) return
  connect()
  emulatorConnections.add(client)
}
