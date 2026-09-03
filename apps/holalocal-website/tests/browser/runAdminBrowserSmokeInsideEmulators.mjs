import { spawn } from 'node:child_process'
import {
  adminBrowserPlaywrightArguments,
  getAdminBrowserLifecycle,
} from './adminBrowserSmokeSelection.mjs'

const lifecycle = getAdminBrowserLifecycle(process.env.HOLALOCAL_ADMIN_BROWSER_LIFECYCLE_ID)
if (process.env.HOLALOCAL_ADMIN_BROWSER_ARTIFACT_GROUP !== lifecycle.artifactGroup) {
  throw new Error('Protected browser lifecycle artifact configuration is missing or invalid.')
}

await import('./seedAdminBrowser.mjs')
await import('./warmAdminBrowser.mjs')
console.log(`${lifecycle.label} seed and warm-up complete; starting ${lifecycle.scenarioTitles.length} fixed scenario(s).`)

const result = await new Promise((resolve, reject) => {
  const child = spawn('playwright', adminBrowserPlaywrightArguments(lifecycle.id), {
    env: process.env,
    stdio: 'inherit',
  })
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal))
  child.once('error', reject)
  child.once('exit', (code, signal) => resolve({ code: code ?? 1, signal }))
})

if (result.signal || result.code !== 0) {
  throw new Error(`${lifecycle.label} Playwright execution failed${result.signal ? ` with signal ${result.signal}` : ` with exit code ${result.code}`}.`)
}
