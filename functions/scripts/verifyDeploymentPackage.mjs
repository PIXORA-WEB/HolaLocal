import { constants } from 'node:fs'
import { access, cp, lstat, mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'
import { CONTRACT_PACKAGE_NAME, prepareFirebaseContractPackage } from './prepareFirebaseContractPackage.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const functionsRoot = resolve(scriptDir, '..')
const contractPackagePath = resolve(functionsRoot, 'vendor', CONTRACT_PACKAGE_NAME)

const REQUIRED_CONTRACT_FILES = [
  'package.json',
  'index.js',
  'account.js',
  'adapters.js',
  'contact.js',
  'legalConsent.js',
  'deletion.js',
  'media.js',
  'messaging.js',
  'publication.js',
  'subscriptions.js',
]

const REQUIRED_FUNCTION_FILES = [
  'package.json',
  'package-lock.json',
  `vendor/${CONTRACT_PACKAGE_NAME}`,
  'src/index.js',
  'src/legalConsent.js',
  'src/accountDeletion.js',
  'src/accountDeletionPrimitives.js',
  'src/accountDeletionFinalizer.js',
  'src/adminAccountDeletion.js',
  'src/businessMedia.js',
  'src/canonicalMediaStorage.js',
  'src/mediaUploadSessions.js',
  'src/profileMedia.js',
  'src/stagingMediaMaintenance.js',
  'src/businessMediaProjection.js',
  'src/accountRoleTransition.js',
  'src/ownerBusinessCreation.js',
  'src/messageSending.js',
  'src/businessModeration.js',
  'src/subscriptionPlanAssignment.js',
  'src/ownerSubscriptionStatus.js',
  'src/publicBusinessDirectory.js',
]

const FORBIDDEN_SEGMENTS = new Set([
  'node_modules',
  'dist',
  'audit-reports',
  'firebase-export',
  'emulator-data',
  'emulator-export',
])

async function main() {
  await prepareFirebaseContractPackage({ stdout: 'pipe', stderr: 'pipe' })
  await assertContractTarball(contractPackagePath)

  const artifactRoot = await mkdtemp(join(tmpdir(), 'holalocal-functions-artifact-'))
  try {
    await copyDeployableFunctionsSource(artifactRoot)
    await assertRequiredFiles(artifactRoot)
    await assertForbiddenFilesExcluded(artifactRoot)
    await assertNoBrokenSymlinks(artifactRoot)
    await run('npm', ['install', '--omit=dev'], { cwd: artifactRoot })
    await assertRuntimeDependenciesInstalled(artifactRoot)
    await assertContractInstalledInsideArtifact(artifactRoot)
    await run('node', ['-e', "import('./src/index.js').then(() => console.log('functions_startup_import_ok'))"], {
      cwd: artifactRoot,
      env: {
        ...process.env,
        MESSAGE_TRANSLATION_PROVIDER: 'disabled',
        GCLOUD_PROJECT: 'demo-holalocal-package',
        GOOGLE_CLOUD_PROJECT: 'demo-holalocal-package',
        GCP_PROJECT: 'demo-holalocal-package',
      },
    })
    console.log(JSON.stringify({
      ok: true,
      artifactRoot,
      contractPackage: relative(functionsRoot, contractPackagePath),
      installCommand: 'npm install --omit=dev',
      checked: REQUIRED_FUNCTION_FILES,
      excluded: ['apps', '.env', 'reports', 'node_modules'],
    }, null, 2))
  } finally {
    await rm(artifactRoot, { recursive: true, force: true })
  }
}

async function assertContractTarball(packagePath) {
  await access(packagePath, constants.R_OK)
  const listing = await npmPackList(packagePath)
  for (const file of REQUIRED_CONTRACT_FILES) {
    if (!listing.includes(`package/${file}`)) {
      throw new Error(`Contract package is missing ${file}`)
    }
  }
  if (listing.some((file) => file.includes('/tests/') || file.includes('.env'))) {
    throw new Error('Contract package contains test or environment files.')
  }
}

async function copyDeployableFunctionsSource(targetRoot) {
  const entries = await readdir(functionsRoot)
  for (const entry of entries) {
    if (shouldSkipRootEntry(entry)) continue
    await cp(resolve(functionsRoot, entry), join(targetRoot, entry), {
      recursive: true,
      dereference: false,
      filter: (source) => !isForbiddenPath(relative(functionsRoot, source)),
    })
  }
}

function shouldSkipRootEntry(entry) {
  return entry === 'node_modules'
    || entry === 'firebase-debug.log'
    || entry === 'firestore-debug.log'
    || entry === 'ui-debug.log'
}

function isForbiddenPath(pathText) {
  if (!pathText) return false
  const parts = pathText.split(sep)
  if (parts.some((part) => FORBIDDEN_SEGMENTS.has(part))) return true
  const name = basename(pathText)
  return name === '.env'
    || name.startsWith('.env.')
    || name.endsWith('.log')
    || name.includes('service-account')
    || name.includes('serviceAccount')
    || name === 'google-application-credentials.json'
    || name.endsWith('.pem')
    || name.endsWith('.key')
    || name.endsWith('.p12')
}

async function assertRequiredFiles(root) {
  for (const file of REQUIRED_FUNCTION_FILES) {
    await access(join(root, file), constants.R_OK)
  }
}

async function assertForbiddenFilesExcluded(root) {
  const files = await walk(root)
  for (const file of files) {
    const relativePath = relative(root, file)
    if (isForbiddenPath(relativePath)) {
      throw new Error(`Deployment artifact includes forbidden path: ${relativePath}`)
    }
    if (relativePath.startsWith(`..${sep}apps${sep}`) || relativePath.split(sep)[0] === 'apps') {
      throw new Error(`Deployment artifact includes unrelated app path: ${relativePath}`)
    }
  }
}

async function assertNoBrokenSymlinks(root) {
  const files = await walk(root, { includeDirectories: true })
  for (const file of files) {
    const info = await lstat(file)
    if (!info.isSymbolicLink()) continue
    const target = await stat(file).catch(() => null)
    if (!target) throw new Error(`Deployment artifact contains broken symlink: ${relative(root, file)}`)
    const realRelative = relative(root, await realpath(file))
    if (realRelative.startsWith('..')) {
      throw new Error(`Deployment artifact symlink points outside artifact: ${relative(root, file)}`)
    }
  }
}

async function assertContractInstalledInsideArtifact(root) {
  const packageRoot = join(root, 'node_modules/@holalocal/firebase-contract')
  await access(join(packageRoot, 'package.json'), constants.R_OK)
  for (const file of REQUIRED_CONTRACT_FILES) {
    await access(join(packageRoot, file), constants.R_OK)
  }
  const linkInfo = await lstat(packageRoot)
  if (linkInfo.isSymbolicLink()) {
    throw new Error('@holalocal/firebase-contract installed as a symlink in deployment artifact.')
  }
  const imported = await import(pathToFileURL(join(packageRoot, 'index.js')).href)
  if (
    typeof imported.hasCompleteUserProfile !== 'function' ||
    typeof imported.resolveBusinessEntitlements !== 'function' ||
    typeof imported.buildEarlyAccessSubscriptionState !== 'function' ||
    typeof imported.resolveAuthoritativeBusinessEntitlements !== 'function' ||
    typeof imported.hasCurrentLegalConsent !== 'function'
    || typeof imported.isCanonicalBusinessLogoPath !== 'function'
  ) {
    throw new Error('@holalocal/firebase-contract import smoke test failed.')
  }
}

async function assertRuntimeDependenciesInstalled(root) {
  const runtimePackages = [
    'firebase-admin',
    'firebase-functions',
    '@google-cloud/translate',
  ]
  for (const packageName of runtimePackages) {
    await access(join(root, 'node_modules', packageName, 'package.json'), constants.R_OK)
  }
}

async function npmPackList(packagePath) {
  const output = await collect('tar', ['-tzf', packagePath], { cwd: functionsRoot })
  return output.trim().split('\n').filter(Boolean)
}

function run(command, args, { cwd, env = process.env } = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${command} ${args.join(' ')} terminated by ${signal}`))
        return
      }
      if (code) {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
        return
      }
      resolveRun()
    })
  })
}

function collect(command, args, { cwd } = {}) {
  return new Promise((resolveCollect, reject) => {
    let stdout = ''
    let stderr = ''
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${command} ${args.join(' ')} terminated by ${signal}`))
        return
      }
      if (code) {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}: ${stderr}`))
        return
      }
      resolveCollect(stdout)
    })
  })
}

async function walk(root, { includeDirectories = false } = {}) {
  const results = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name)
    if (entry.isDirectory()) {
      if (includeDirectories) results.push(fullPath)
      results.push(...await walk(fullPath, { includeDirectories }))
    } else {
      results.push(fullPath)
    }
  }
  return results
}

async function realpath(pathText) {
  return (await import('node:fs/promises')).realpath(pathText)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
