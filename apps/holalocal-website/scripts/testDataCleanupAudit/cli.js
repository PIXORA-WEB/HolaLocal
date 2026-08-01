#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createAdminCleanupAuditSource } from './adminSource.js'
import { cleanupAuditHelp, parseCleanupAuditArguments, safeErrorDetails, validateExecutionEnvironment } from './config.js'
import { runTestCleanupAudit } from './core.js'
import { humanSummary, writeCleanupAuditReports } from './reportWriter.js'

async function main() {
  const options = parseCleanupAuditArguments(process.argv.slice(2))
  if (options.help) {
    console.log(cleanupAuditHelp())
    return
  }
  const identity = await validateExecutionEnvironment(options, { readTextFile: readFile })
  console.log(`[test-cleanup-audit] Project: ${options.projectId}`)
  console.log(`[test-cleanup-audit] Mode: ${options.emulator ? 'emulator' : 'confirmed non-emulator read-only'}`)
  console.log(`[test-cleanup-audit] Credential project: ${identity.credentialProjectStatus}`)
  console.log(`[test-cleanup-audit] Target accounts: ${options.targetUids.length}`)
  console.log(`[test-cleanup-audit] Protected accounts: ${options.protectedUids.length}`)
  console.log(`[test-cleanup-audit] Output directory: ${resolve(options.outputDir)}`)
  const source = createAdminCleanupAuditSource(options)
  const report = await runTestCleanupAudit(source, options)
  const paths = await writeCleanupAuditReports(report, options.outputDir)
  console.log(humanSummary(report))
  console.log(`[test-cleanup-audit] JSON report: ${paths.jsonPath}`)
  console.log(`[test-cleanup-audit] Summary report: ${paths.summaryPath}`)
}

main().catch((error) => {
  console.error(`[test-cleanup-audit] ${safeErrorDetails(error)}`)
  process.exitCode = 1
})
