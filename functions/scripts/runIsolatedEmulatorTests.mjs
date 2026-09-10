import { mkdtemp, mkdir, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const FUNCTIONS_EMULATOR_PROJECT_ID = 'demo-holalocal-functions'
const FUNCTIONS_EMULATOR_STORAGE_BUCKET = `${FUNCTIONS_EMULATOR_PROJECT_ID}.appspot.com`
const FUNCTIONS_EMULATOR_HOSTS = Object.freeze({
  auth: '127.0.0.1:9099',
  firestore: '127.0.0.1:8080',
  storage: '127.0.0.1:9199',
})

export function parseProjectId(argv = process.argv.slice(2)) {
  if (argv.length === 0) return FUNCTIONS_EMULATOR_PROJECT_ID
  if (argv.length !== 2 || argv[0] !== '--project' || !argv[1]) {
    throw new Error('Callable emulator tests accept only --project demo-holalocal-functions.')
  }
  return argv[1]
}

export function assertDemoProject(projectId) {
  if (projectId !== FUNCTIONS_EMULATOR_PROJECT_ID) {
    throw new Error(`Refusing to start callable emulator tests for non-demo project: ${projectId || '(missing)'}`)
  }
}

export function assertCredentialIsolation(env = process.env) {
  for (const name of [
    'GOOGLE_APPLICATION_CREDENTIALS',
    'FIREBASE_TOKEN',
    'GOOGLE_OAUTH_ACCESS_TOKEN',
  ]) {
    if (env[name]) {
      throw new Error(`Refusing to start callable emulator tests while ${name} is set.`)
    }
  }
}

export async function assertEmulatorCache(cachePath) {
  let entries
  try {
    entries = await readdir(cachePath)
  } catch {
    throw new Error(`Refusing to start callable emulator tests without a preseeded emulator cache: ${cachePath}`)
  }
  if (!entries.some((entry) => /^cloud-firestore-emulator-v.*\.jar$/.test(entry))) {
    throw new Error(`Refusing to start callable emulator tests without the Firestore emulator jar in: ${cachePath}`)
  }
  if (!entries.some((entry) => /^cloud-storage-rules-runtime-v.*\.jar$/.test(entry))) {
    throw new Error(`Refusing to start callable emulator tests without the Storage emulator jar in: ${cachePath}`)
  }
}

export function assertCallableBoundaryEnvironment(env = process.env) {
  assertDemoProject(env.GCLOUD_PROJECT)
  if (env.GOOGLE_CLOUD_PROJECT !== FUNCTIONS_EMULATOR_PROJECT_ID) {
    throw new Error('Callable emulator tests require the exact demo Google Cloud project.')
  }
  if (env.FIREBASE_AUTH_EMULATOR_HOST !== FUNCTIONS_EMULATOR_HOSTS.auth
    || env.FIRESTORE_EMULATOR_HOST !== FUNCTIONS_EMULATOR_HOSTS.firestore
    || env.FIREBASE_STORAGE_EMULATOR_HOST !== FUNCTIONS_EMULATOR_HOSTS.storage
    || env.STORAGE_EMULATOR_HOST !== `http://${FUNCTIONS_EMULATOR_HOSTS.storage}`) {
    throw new Error('Callable emulator tests require the fixed loopback emulator endpoints.')
  }
  let config
  try { config = JSON.parse(env.FIREBASE_CONFIG ?? '') } catch { config = null }
  if (!config || Object.keys(config).sort().join(',') !== 'projectId,storageBucket'
    || config.projectId !== FUNCTIONS_EMULATOR_PROJECT_ID
    || config.storageBucket !== FUNCTIONS_EMULATOR_STORAGE_BUCKET) {
    throw new Error('Callable emulator tests require the exact demo project and Storage bucket configuration.')
  }
  if (env.GOOGLE_APPLICATION_CREDENTIALS || env.FIREBASE_TOKEN || env.GOOGLE_OAUTH_ACCESS_TOKEN) {
    throw new Error('Callable emulator boundary refuses credential variables.')
  }
  if (env.MESSAGE_TRANSLATION_PROVIDER !== 'disabled') {
    throw new Error('Callable emulator boundary requires the disabled translation provider.')
  }
}

async function seedOfflineFirebaseConfig(xdgConfigHome) {
  const configstoreDir = join(xdgConfigHome, 'configstore')
  await mkdir(configstoreDir, { recursive: true })
  await writeFile(
    join(configstoreDir, 'firebase-tools.json'),
    `${JSON.stringify({ motd: { fetched: 4102444800000 } }, null, 2)}\n`,
  )
}

export async function buildIsolatedEnv(projectId, baseEnv = process.env) {
  assertDemoProject(projectId)
  assertCredentialIsolation(baseEnv)
  const emulatorCache = baseEnv.FIREBASE_EMULATORS_PATH ?? join(tmpdir(), 'holalocal-firebase-emulators-cache')
  await assertEmulatorCache(emulatorCache)
  const root = await mkdtemp(join(tmpdir(), 'holalocal-functions-emulator-'))
  const home = join(root, 'home')
  const config = join(root, 'gcloud')
  const xdg = join(root, 'xdg')
  await seedOfflineFirebaseConfig(xdg)
  return {
    ...baseEnv,
    GCLOUD_PROJECT: projectId,
    GOOGLE_CLOUD_PROJECT: projectId,
    GCP_PROJECT: projectId,
    FIREBASE_CONFIG: JSON.stringify({
      projectId,
      storageBucket: FUNCTIONS_EMULATOR_STORAGE_BUCKET,
    }),
    FIREBASE_AUTH_EMULATOR_HOST: FUNCTIONS_EMULATOR_HOSTS.auth,
    FIRESTORE_EMULATOR_HOST: FUNCTIONS_EMULATOR_HOSTS.firestore,
    FIREBASE_STORAGE_EMULATOR_HOST: FUNCTIONS_EMULATOR_HOSTS.storage,
    STORAGE_EMULATOR_HOST: `http://${FUNCTIONS_EMULATOR_HOSTS.storage}`,
    GOOGLE_APPLICATION_CREDENTIALS: '',
    FIREBASE_TOKEN: '',
    GOOGLE_OAUTH_ACCESS_TOKEN: '',
    FIREBASE_EMULATORS_PATH: emulatorCache,
    MESSAGE_TRANSLATION_PROVIDER: 'disabled',
    HOLALOCAL_CALLABLE_BOUNDARY: '1',
    CUSTOMER_REVIEWS_ENABLED: 'true',
    FIREBASE_TOOLS_DISABLE_UPDATE_NOTIFIER: 'true',
    NO_UPDATE_NOTIFIER: '1',
    NO_GCE_CHECK: 'true',
    HOME: home,
    CLOUDSDK_CONFIG: config,
    XDG_CONFIG_HOME: xdg,
  }
}

async function main() {
  const projectId = parseProjectId()
  const env = await buildIsolatedEnv(projectId)
  const child = spawn('firebase', [
    'emulators:exec',
    '--config',
    '../firebase.json',
    '--project',
    projectId,
    '--only',
    'auth,firestore,functions,storage',
    'node --test tests/callableBoundary.test.mjs',
  ], { stdio: 'inherit', env })

  child.on('exit', (code, signal) => {
    process.exitCode = signal ? 1 : code ?? 1
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
