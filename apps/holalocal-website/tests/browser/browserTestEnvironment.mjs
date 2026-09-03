import { mkdtemp, mkdir, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TEST_PROJECT_ID } from './fixtures.js'

const credentialVariableNames = Object.freeze([
  'GOOGLE_APPLICATION_CREDENTIALS',
  'FIREBASE_TOKEN',
  'GOOGLE_OAUTH_ACCESS_TOKEN',
])

export const BROWSER_TEST_CORE_ENVIRONMENT = Object.freeze({
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  GCLOUD_PROJECT: TEST_PROJECT_ID,
  GOOGLE_CLOUD_PROJECT: TEST_PROJECT_ID,
  STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
  VITE_BROWSER_TEST_RUNNER: 'true',
  VITE_FIREBASE_API_KEY: 'demo-api-key',
  VITE_FIREBASE_APP_ID: '1:123456789:web:adminbrowser',
  VITE_FIREBASE_APPCHECK_ENABLED: 'false',
  VITE_FIREBASE_AUTH_DOMAIN: `${TEST_PROJECT_ID}.firebaseapp.com`,
  VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
  VITE_FIREBASE_MEASUREMENT_ID: '',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '123456789',
  VITE_FIREBASE_PROJECT_ID: TEST_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET: `${TEST_PROJECT_ID}.appspot.com`,
  VITE_FIRESTORE_EMULATOR_URL: 'http://127.0.0.1:8080',
  VITE_FUNCTIONS_EMULATOR_URL: 'http://127.0.0.1:5001',
  VITE_STORAGE_EMULATOR_URL: 'http://127.0.0.1:9199',
  VITE_USE_FIREBASE_EMULATORS: 'true',
})

export async function createProtectedBrowserTestEnvironment({
  cache = process.env.FIREBASE_EMULATORS_PATH
    ?? join(tmpdir(), 'holalocal-firebase-emulators-cache'),
  prefix = 'holalocal-admin-browser-',
  playwrightBrowsersPath,
} = {}) {
  for (const name of credentialVariableNames) {
    if (process.env[name]) throw new Error(`Protected browser tests refuse to run while ${name} is set.`)
  }

  const cacheEntries = await readdir(cache).catch(() => [])
  if (!cacheEntries.some((entry) => /^cloud-firestore-emulator-v.*\.jar$/.test(entry))) {
    throw new Error(`A preseeded Firestore emulator cache is required at ${cache}.`)
  }

  const isolatedRoot = await mkdtemp(join(tmpdir(), prefix))
  const xdg = join(isolatedRoot, 'xdg')
  await mkdir(join(xdg, 'configstore'), { recursive: true })
  await writeFile(
    join(xdg, 'configstore', 'firebase-tools.json'),
    `${JSON.stringify({ motd: { fetched: 4102444800000 } })}\n`,
  )

  const environment = {
    ...process.env,
    ...BROWSER_TEST_CORE_ENVIRONMENT,
    CLOUDSDK_CONFIG: join(isolatedRoot, 'gcloud'),
    FIREBASE_EMULATORS_PATH: cache,
    FIREBASE_TOOLS_DISABLE_UPDATE_NOTIFIER: 'true',
    GOOGLE_APPLICATION_CREDENTIALS: '',
    FIREBASE_TOKEN: '',
    GOOGLE_OAUTH_ACCESS_TOKEN: '',
    HOME: join(isolatedRoot, 'home'),
    MESSAGE_TRANSLATION_PROVIDER: 'disabled',
    NO_GCE_CHECK: 'true',
    NO_UPDATE_NOTIFIER: '1',
    XDG_CONFIG_HOME: xdg,
  }
  if (playwrightBrowsersPath) environment.PLAYWRIGHT_BROWSERS_PATH = playwrightBrowsersPath
  delete environment.DEBUG

  return { cache, environment, isolatedRoot }
}
