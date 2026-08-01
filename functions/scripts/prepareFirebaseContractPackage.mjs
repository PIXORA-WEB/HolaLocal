import { mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

export const CONTRACT_PACKAGE_NAME = 'holalocal-firebase-contract-1.0.0.tgz'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const functionsRoot = resolve(scriptDir, '..')
const repoRoot = resolve(functionsRoot, '..')
const contractRoot = resolve(repoRoot, 'shared/firebase-contract')
const vendorDir = resolve(functionsRoot, 'vendor')
const packagePath = resolve(vendorDir, CONTRACT_PACKAGE_NAME)

export async function prepareFirebaseContractPackage({
  npm = 'npm',
  stdout = 'inherit',
  stderr = 'inherit',
} = {}) {
  await mkdir(vendorDir, { recursive: true })
  await rm(packagePath, { force: true })
  await run(npm, ['pack', contractRoot, '--pack-destination', vendorDir], {
    cwd: functionsRoot,
    stdout,
    stderr,
  })
  return { packagePath, vendorDir, contractRoot }
}

function run(command, args, { cwd, stdout, stderr }) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', stdout, stderr] })
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

if (import.meta.url === `file://${process.argv[1]}`) {
  prepareFirebaseContractPackage().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
