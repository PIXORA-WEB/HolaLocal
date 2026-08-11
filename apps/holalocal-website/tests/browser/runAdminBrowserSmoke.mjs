import { mkdtemp, mkdir, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const projectId = 'demo-holalocal-admin-browser'
const cache = process.env.FIREBASE_EMULATORS_PATH
  ?? join(tmpdir(), 'holalocal-firebase-emulators-cache')

if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error('Browser smoke tests refuse to run while GOOGLE_APPLICATION_CREDENTIALS is set.')
}
const cacheEntries = await readdir(cache).catch(() => [])
if (!cacheEntries.some((entry) => /^cloud-firestore-emulator-v.*\.jar$/.test(entry))) {
  throw new Error(`A preseeded Firestore emulator cache is required at ${cache}.`)
}

const isolatedRoot = await mkdtemp(join(tmpdir(), 'holalocal-admin-browser-'))
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
  GCLOUD_PROJECT: projectId,
  GOOGLE_APPLICATION_CREDENTIALS: '',
  GOOGLE_CLOUD_PROJECT: projectId,
  HOME: join(isolatedRoot, 'home'),
  MESSAGE_TRANSLATION_PROVIDER: 'disabled',
  NO_UPDATE_NOTIFIER: '1',
  PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH
    ?? join(process.env.HOME, '.cache', 'ms-playwright'),
  STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
  VITE_FIREBASE_API_KEY: 'demo-api-key',
  VITE_FIREBASE_APP_ID: '1:123456789:web:adminbrowser',
  VITE_FIREBASE_AUTH_DOMAIN: `${projectId}.firebaseapp.com`,
  VITE_FIREBASE_MESSAGING_SENDER_ID: '123456789',
  VITE_FIREBASE_PROJECT_ID: projectId,
  VITE_FIREBASE_STORAGE_BUCKET: `${projectId}.appspot.com`,
  VITE_USE_FIREBASE_EMULATORS: 'true',
  XDG_CONFIG_HOME: xdg,
}
delete env.DEBUG

const child = spawn('firebase', [
  'emulators:exec',
  '--config',
  '../../firebase.json',
  '--project',
  projectId,
  '--only',
  'auth,firestore,storage,functions',
  'node tests/browser/seedAdminBrowser.mjs && node tests/browser/warmAdminBrowser.mjs && playwright test --config playwright.admin.config.js',
], { env, stdio: 'inherit' })

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    child.kill(signal)
  })
}

child.on('exit', (code, signal) => {
  process.exitCode = signal ? 1 : code ?? 1
})
