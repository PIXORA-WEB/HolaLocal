import { spawn } from 'node:child_process'
import { connect } from 'node:net'
import { join } from 'node:path'
import {
  adminBrowserEmulatorArguments,
  getAdminBrowserLifecycle,
  parseAdminBrowserSmokeArguments,
} from './adminBrowserSmokeSelection.mjs'
import { createProtectedBrowserTestEnvironment } from './browserTestEnvironment.mjs'
import { TEST_PROJECT_ID } from './fixtures.js'

const protectedPorts = Object.freeze([4175, 5001, 8080, 9099, 9199])
const selection = parseAdminBrowserSmokeArguments(process.argv.slice(2))
let activeChild = null

function portAcceptsConnections(port) {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port })
    const finish = (open) => {
      socket.destroy()
      resolve(open)
    }
    socket.setTimeout(250, () => finish(false))
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
  })
}

async function assertProtectedPortsClosed(boundary) {
  const states = await Promise.all(protectedPorts.map(async (port) => ({
    open: await portAcceptsConnections(port), port,
  })))
  const openPorts = states.filter(({ open }) => open).map(({ port }) => port)
  if (openPorts.length) throw new Error(`${boundary} requires closed protected ports: ${openPorts.join(', ')}.`)
}

function runProcess(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options)
    activeChild = child
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      activeChild = null
      resolve({ code: code ?? 1, signal })
    })
  })
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => activeChild?.kill(signal))
}

if (selection.mode === 'diagnostic') {
  console.log('Protected targeted diagnostic mode: route-claims only; Playwright retries disabled.')
} else {
  console.log('Protected admin-browser acceptance plan: three exclusive emulator lifecycles; Playwright retries disabled.')
}

for (const lifecycleId of selection.lifecycleIds) {
  const lifecycle = getAdminBrowserLifecycle(lifecycleId)
  await assertProtectedPortsClosed(`${lifecycle.label} startup`)
  const { environment } = await createProtectedBrowserTestEnvironment({
    prefix: `holalocal-admin-browser-${lifecycle.id}-`,
    playwrightBrowsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH
      ?? join(process.env.HOME, '.cache', 'ms-playwright'),
  })
  const env = {
    ...environment,
    HOLALOCAL_ADMIN_BROWSER_ARTIFACT_GROUP: lifecycle.artifactGroup,
    HOLALOCAL_ADMIN_BROWSER_LIFECYCLE_ID: lifecycle.id,
  }
  console.log(`${lifecycle.label} starting fresh: ${lifecycle.scenarioTitles.join(' → ')}; retries=${lifecycle.retries}.`)
  const result = await runProcess(
    'firebase', adminBrowserEmulatorArguments(TEST_PROJECT_ID), { env, stdio: 'inherit' },
  )
  if (result.signal || result.code !== 0) {
    throw new Error(`${lifecycle.label} failed${result.signal ? ` with signal ${result.signal}` : ` with exit code ${result.code}`}.`)
  }
  await assertProtectedPortsClosed(`${lifecycle.label} shutdown`)
  console.log(`${lifecycle.label} passed and shut down cleanly.`)
}

console.log(`Protected admin-browser ${selection.mode} plan passed.`)
