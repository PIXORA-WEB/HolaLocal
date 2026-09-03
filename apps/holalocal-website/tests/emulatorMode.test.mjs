import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Firebase emulator mode validates every browser-test request and cannot fail open', async () => {
  const source = await readFile(new URL('../src/firebase/emulatorMode.js', import.meta.url), 'utf8')
  assert.match(source, /validateBrowserTestSafety/)
  assert.match(source, /mode: environment\.MODE/)
  assert.match(source, /production: environment\.PROD === true/)
  assert.match(source, /if \(currentEnvironment\(\)\.MODE === BROWSER_TEST_MODE\) return true/)
  assert.doesNotMatch(source, /if \(!requested\) return false|startsWith\(/)
  assert.doesNotMatch(source, /window\.|location\.|localStorage/)
})

test('all Firebase product clients use fixed emulator endpoints through the shared one-time gate', async () => {
  const files = ['auth.js', 'firestoreClient.js', 'functionsClient.js', 'storageClient.js']
  for (const file of files) {
    const source = await readFile(new URL(`../src/firebase/${file}`, import.meta.url), 'utf8')
    assert.match(source, /shouldUseFirebaseEmulators\(\)/, file)
    assert.match(source, /connectFirebaseEmulatorOnce/, file)
    assert.match(source, /getFirebaseEmulatorEndpoint/, file)
  }
  const functions = await readFile(new URL('../src/firebase/functionsClient.js', import.meta.url), 'utf8')
  assert.match(functions, /getFunctions\(getFirebaseApp\(\), 'europe-west1'\)/)
})

test('analytics stays disabled in explicit emulator browser-test mode', async () => {
  const [source, main] = await Promise.all([
    readFile(new URL('../src/firebase/analyticsClient.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.jsx', import.meta.url), 'utf8'),
  ])
  assert.match(source, /import\.meta\.env\.MODE === 'browser-test'/)
  assert.match(source, /shouldUseFirebaseEmulators\(\)/)
  assert.match(main, /if \(import\.meta\.env\.MODE !== 'browser-test'\)/)
  assert.ok(main.indexOf("MODE !== 'browser-test'") < main.indexOf("import('./firebase/analyticsClient.js')"))
})
