import { mkdtemp, mkdir, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const PRODUCTION_PROJECT_IDS = new Set(['holalocal-491c9'])

export function parseProjectId(argv = process.argv.slice(2)) {
  const index = argv.indexOf('--project')
  return index >= 0 ? argv[index + 1] : 'demo-holalocal-functions'
}

export function assertDemoProject(projectId) {
  if (!projectId || !projectId.startsWith('demo-') || PRODUCTION_PROJECT_IDS.has(projectId)) {
    throw new Error(`Refusing to start callable emulator tests for non-demo project: ${projectId || '(missing)'}`)
  }
}

export function assertCredentialIsolation(env = process.env) {
  if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('Refusing to start callable emulator tests while GOOGLE_APPLICATION_CREDENTIALS is set.')
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
    FIREBASE_CONFIG: JSON.stringify({ projectId }),
    GOOGLE_APPLICATION_CREDENTIALS: '',
    FIREBASE_EMULATORS_PATH: emulatorCache,
    MESSAGE_TRANSLATION_PROVIDER: 'disabled',
    HOLALOCAL_CALLABLE_BOUNDARY: '1',
    FIREBASE_TOOLS_DISABLE_UPDATE_NOTIFIER: 'true',
    NO_UPDATE_NOTIFIER: '1',
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
    'firestore,functions',
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
