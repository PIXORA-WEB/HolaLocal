import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'vite'

// Harmless syntactically valid values: this check initializes local SDK objects
// only. It does not make a network request or access a Firebase project.
Object.assign(process.env, {
  VITE_FIREBASE_API_KEY: 'firebase-initialization-check',
  VITE_FIREBASE_AUTH_DOMAIN: 'example.invalid',
  VITE_FIREBASE_PROJECT_ID: 'firebase-initialization-check',
  VITE_FIREBASE_STORAGE_BUCKET: 'firebase-initialization-check.invalid',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  VITE_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000000000',
})

const projectRoot = resolve(import.meta.dirname, '..')
const temporaryRoot = join('/tmp', 'holalocal-firebase-initialization-check')
const entryFile = join(temporaryRoot, 'entry.mjs')
const outputDirectory = join(temporaryRoot, 'dist')

await rm(temporaryRoot, { force: true, recursive: true })
await mkdir(temporaryRoot, { recursive: true })
await writeFile(entryFile, `
  import { getFirebaseApp } from ${JSON.stringify(join(projectRoot, 'src/firebase/config.js'))}
  import { getFirebaseAuth } from ${JSON.stringify(join(projectRoot, 'src/firebase/auth.js'))}

  const app = getFirebaseApp()
  const auth = getFirebaseAuth()
  if (app.options.projectId !== 'firebase-initialization-check') throw new Error('Unexpected Firebase project configuration.')
  if (auth.app !== app) throw new Error('Firebase Auth does not use the shared Firebase App.')
  if (getFirebaseApp() !== app || getFirebaseAuth() !== auth) throw new Error('Firebase initialization is not idempotent.')
`)

try {
  await build({
    configFile: false,
    logLevel: 'silent',
    mode: 'production',
    root: projectRoot,
    ssr: { noExternal: true },
    build: {
      emptyOutDir: true,
      minify: true,
      outDir: outputDirectory,
      rolldownOptions: { output: { entryFileNames: 'entry.mjs' } },
      ssr: entryFile,
    },
  })

  await import(`${pathToFileURL(join(outputDirectory, 'entry.mjs')).href}?run=${Date.now()}`)
  console.log('Firebase App/Auth production-build initialization check passed.')
} finally {
  await rm(temporaryRoot, { force: true, recursive: true })
}
