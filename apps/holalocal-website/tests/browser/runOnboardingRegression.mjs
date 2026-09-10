import { spawn } from 'node:child_process'
import { writeFile, copyFile, symlink } from 'node:fs/promises'
import { resolve, join, dirname } from 'node:path'
import { createProtectedBrowserTestEnvironment } from './browserTestEnvironment.mjs'
import { TEST_PROJECT_ID } from './fixtures.js'
process.env.PATH = `${dirname(process.execPath)}:${resolve('node_modules/.bin')}:${process.env.PATH}`
const { environment, isolatedRoot } = await createProtectedBrowserTestEnvironment({
  cache: process.env.FIREBASE_EMULATORS_PATH ?? join(process.env.HOME, '.cache/firebase/emulators'),
  playwrightBrowsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH ?? join(process.env.HOME, '.cache/ms-playwright'),
})
const servicesOnly = process.argv.includes('--services-only')
const rulesOnly = process.argv.includes('--rules-only')
const profileSaveOnly = process.argv.includes('--profile-save-only')
const infrastructureOnly = rulesOnly
const projectId = rulesOnly ? 'demo-holalocal-rules' : TEST_PROJECT_ID
const ports = { auth: 19099, firestore: 18080, storage: 19199, functions: 15001 }
for (const [service, port] of Object.entries(ports)) {
  environment[`VITE_${service === 'auth' ? 'FIREBASE_AUTH' : service.toUpperCase()}_EMULATOR_URL`] = `http://127.0.0.1:${port}`
}
Object.assign(environment, {
  GCLOUD_PROJECT: projectId, GOOGLE_CLOUD_PROJECT: projectId,
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:19099', FIRESTORE_EMULATOR_HOST: '127.0.0.1:18080',
  STORAGE_EMULATOR_HOST: '127.0.0.1:19199', FUNCTIONS_DISCOVERY_TIMEOUT: '120', JAVA_TOOL_OPTIONS: '-Xmx256m -XX:ActiveProcessorCount=2', VITE_ONBOARDING_REGRESSION: 'true',
})
const config = join(isolatedRoot, 'firebase.json')
await copyFile(resolve('../../firestore.rules'), join(isolatedRoot, 'firestore.rules'))
await copyFile(resolve('../../storage.rules'), join(isolatedRoot, 'storage.rules'))
await symlink(resolve('../../functions'), join(isolatedRoot, 'functions'), 'dir')
await writeFile(config, JSON.stringify({
  firestore: { rules: 'firestore.rules' }, storage: { rules: 'storage.rules' },
  functions: [{ source: 'functions', runtime: 'nodejs20' }],
  emulators: { ...Object.fromEntries(Object.entries(ports).map(([key, port]) => [key, { host: '127.0.0.1', port }])),
    hub: { port: 14400 }, logging: { port: 14500 }, ui: { enabled: false }, singleProjectMode: true },
}))
const child = spawn('firebase', ['emulators:exec', '--config', config, '--project', projectId,
  ...(infrastructureOnly || profileSaveOnly ? [] : ['--inspect-functions=19229']), '--only', infrastructureOnly ? 'firestore,storage' : profileSaveOnly ? 'auth,firestore,storage' : 'auth,firestore,storage,functions',
  rulesOnly ? 'node --test tests/rules.test.mjs' : profileSaveOnly ? 'playwright test --config playwright.onboarding.config.js --grep "business profile save"' : servicesOnly ? 'playwright test --config playwright.services.config.js' : 'playwright test --config playwright.onboarding.config.js'],
{ env: environment, stdio: 'inherit' })
child.on('exit', code => { process.exitCode = code ?? 1 })
