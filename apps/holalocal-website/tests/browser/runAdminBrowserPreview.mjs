import { mkdtemp, mkdir, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { TEST_BUSINESS_ID, TEST_PASSWORD, TEST_PROJECT_ID, TEST_USERS } from './fixtures.js'

if (TEST_PROJECT_ID !== 'demo-holalocal-admin-browser') {
  throw new Error(`Refusing to preview unexpected project ${TEST_PROJECT_ID}.`)
}
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error('Admin browser preview refuses to run while GOOGLE_APPLICATION_CREDENTIALS is set.')
}

const cache = process.env.FIREBASE_EMULATORS_PATH
  ?? join(tmpdir(), 'holalocal-firebase-emulators-cache')
const cacheEntries = await readdir(cache).catch(() => [])
if (!cacheEntries.some((entry) => /^cloud-firestore-emulator-v.*\.jar$/.test(entry))) {
  throw new Error(`A preseeded Firestore emulator cache is required at ${cache}.`)
}

const isolatedRoot = await mkdtemp(join(tmpdir(), 'holalocal-admin-preview-'))
const xdg = join(isolatedRoot, 'xdg')
await mkdir(join(xdg, 'configstore'), { recursive: true })
await writeFile(
  join(xdg, 'configstore', 'firebase-tools.json'),
  `${JSON.stringify({ motd: { fetched: 4102444800000 } })}\n`,
)

const env = {
  ...process.env,
  CLOUDSDK_CONFIG: join(isolatedRoot, 'gcloud'),
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIREBASE_EMULATORS_PATH: cache,
  FIREBASE_TOOLS_DISABLE_UPDATE_NOTIFIER: 'true',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  GCLOUD_PROJECT: TEST_PROJECT_ID,
  GOOGLE_APPLICATION_CREDENTIALS: '',
  GOOGLE_CLOUD_PROJECT: TEST_PROJECT_ID,
  HOME: join(isolatedRoot, 'home'),
  MESSAGE_TRANSLATION_PROVIDER: 'disabled',
  NO_UPDATE_NOTIFIER: '1',
  STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
  VITE_FIREBASE_API_KEY: 'demo-api-key',
  VITE_FIREBASE_APP_ID: '1:123456789:web:adminbrowser',
  VITE_FIREBASE_AUTH_DOMAIN: `${TEST_PROJECT_ID}.firebaseapp.com`,
  VITE_FIREBASE_MESSAGING_SENDER_ID: '123456789',
  VITE_FIREBASE_PROJECT_ID: TEST_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET: `${TEST_PROJECT_ID}.appspot.com`,
  VITE_USE_FIREBASE_EMULATORS: 'true',
  XDG_CONFIG_HOME: xdg,
}
delete env.DEBUG

console.log([
  'Starting isolated HolaLocal admin preview.',
  'URL: http://127.0.0.1:4175',
  `Admin email: ${TEST_USERS.admin.email}`,
  `Password: ${TEST_PASSWORD}`,
  `Business review: http://127.0.0.1:4175/admin/businesses/${TEST_BUSINESS_ID}`,
  'Press Ctrl+C to stop the website and all emulators.',
].join('\n'))

const child = spawn('firebase', [
  'emulators:exec',
  '--config',
  '../../firebase.json',
  '--project',
  TEST_PROJECT_ID,
  '--only',
  'auth,firestore,storage,functions',
  'node tests/browser/seedAdminBrowser.mjs && npm run dev -- --mode browser-test --host 127.0.0.1 --port 4175 --strictPort',
], { env, stdio: 'inherit' })

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => child.kill(signal))
}

child.on('exit', (code, signal) => {
  process.exitCode = signal ? 1 : code ?? 1
})
