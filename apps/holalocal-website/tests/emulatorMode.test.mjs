import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Firebase emulator mode is explicit, demo-only and impossible in production builds', async () => {
  const source = await readFile(new URL('../src/firebase/emulatorMode.js', import.meta.url), 'utf8')
  assert.match(source, /VITE_USE_FIREBASE_EMULATORS === 'true'/)
  assert.match(source, /import\.meta\.env\.MODE !== EMULATOR_MODE \|\| import\.meta\.env\.PROD/)
  assert.match(source, /startsWith\(DEMO_PROJECT_PREFIX\)/)
  assert.doesNotMatch(source, /window\.|location\.|localStorage/)
})

test('all Firebase product clients use fixed emulator endpoints through the shared one-time gate', async () => {
  const files = ['auth.js', 'firestoreClient.js', 'functionsClient.js', 'storageClient.js']
  for (const file of files) {
    const source = await readFile(new URL(`../src/firebase/${file}`, import.meta.url), 'utf8')
    assert.match(source, /shouldUseFirebaseEmulators\(\)/, file)
    assert.match(source, /connectFirebaseEmulatorOnce/, file)
  }
  const functions = await readFile(new URL('../src/firebase/functionsClient.js', import.meta.url), 'utf8')
  assert.match(functions, /getFunctions\(getFirebaseApp\(\), 'europe-west1'\)/)
})

test('analytics stays disabled in explicit emulator browser-test mode', async () => {
  const source = await readFile(new URL('../src/firebase/analyticsClient.js', import.meta.url), 'utf8')
  assert.match(source, /shouldUseFirebaseEmulators\(\)/)
})
