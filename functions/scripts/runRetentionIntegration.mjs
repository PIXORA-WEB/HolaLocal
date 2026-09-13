import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const [mode, directory] = process.argv.slice(2)
if (!['backend', 'rules', 'browser-closed', 'browser-enabled'].includes(mode) || !directory || !isAbsolute(directory) || resolve(directory).startsWith('/tmp')) throw new Error('Specify backend|rules|browser-closed|browser-enabled and a durable absolute evidence directory outside /tmp')
const output = resolve(directory)
await mkdir(output, { recursive: true })
const browser = mode.startsWith('browser-')
const project = browser ? 'demo-holalocal-admin-browser' : mode === 'rules' ? 'demo-holalocal-rules' : 'demo-holalocal-retention'
const config = { firestore: { rules: resolve(root, 'firestore.rules') }, emulators: { auth: { host: '127.0.0.1', port: 19099 }, firestore: { host: '127.0.0.1', port: 18080, websocketPort: 19150 }, hub: { host: '127.0.0.1', port: 14400 }, logging: { host: '127.0.0.1', port: 14500 }, ui: { enabled: false }, singleProjectMode: false } }
if (browser) { config.functions = { source: relative(output, resolve(root, 'functions')), codebase: 'default' }; config.emulators.functions = { host: '127.0.0.1', port: 15001 } }
if (mode === 'rules') { config.storage = { rules: resolve(root, 'storage.rules') }; config.emulators.storage = { host: '127.0.0.1', port: 19199 } }
const path = resolve(output, 'emulator.json')
await writeFile(path, JSON.stringify(config, null, 2))
const command = browser ? 'node tests/browser/retentionIntegration.mjs' : mode === 'rules' ? 'node --test tests/rules.test.mjs' : 'node --test --test-concurrency=1 functions/tests/adminRetentionEmulator.test.mjs functions/tests/acknowledgmentRetentionEmulator.test.mjs functions/tests/businessReportRetentionEmulator.test.mjs functions/tests/conversationRetentionEmulator.test.mjs'
const child = spawn(resolve(root, 'functions/node_modules/.bin/firebase'), ['emulators:exec', '--config', path, '--project', project, '--only', browser ? 'auth,firestore,functions' : mode === 'rules' ? 'firestore,storage' : 'auth,firestore', command], { cwd: browser || mode === 'rules' ? resolve(root, 'apps/holalocal-website') : root, env: { ...process.env, GCLOUD_PROJECT: project, HOLALOCAL_RETENTION_EMULATOR: '1', HOLALOCAL_RETENTION_EVIDENCE: output, RECORD_RETENTION_CLEANUP_ENABLED: mode === 'browser-enabled' ? 'true' : 'false' }, stdio: 'inherit' })
child.on('error', error => { console.error(error.message); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
