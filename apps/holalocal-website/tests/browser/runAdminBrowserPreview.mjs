import { spawn } from 'node:child_process'
import { TEST_BUSINESS_ID, TEST_PASSWORD, TEST_PROJECT_ID, TEST_USERS } from './fixtures.js'
import { createProtectedBrowserTestEnvironment } from './browserTestEnvironment.mjs'

if (TEST_PROJECT_ID !== 'demo-holalocal-admin-browser') {
  throw new Error(`Refusing to preview unexpected project ${TEST_PROJECT_ID}.`)
}
const { environment: env } = await createProtectedBrowserTestEnvironment({
  prefix: 'holalocal-admin-preview-',
})

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
