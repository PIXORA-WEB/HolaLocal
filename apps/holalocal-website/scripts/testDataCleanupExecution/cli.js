#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createAdminCleanupExecutionSource } from './adminSource.js'
import { executionHelp, parseExecutionArguments } from './config.js'
import { loadApprovedDryRunReport, runCleanupExecution } from './core.js'
import { humanExecutionSummary, writeExecutionReports } from './reportWriter.js'
import { safeErrorDetails, validateExecutionEnvironment } from '../testDataCleanupAudit/config.js'

async function main() {
  const options = parseExecutionArguments(process.argv.slice(2))
  if (options.help) {
    console.log(executionHelp())
    return
  }
  const identity = await validateExecutionEnvironment(options, { readTextFile: readFile })
  console.log(`[test-cleanup-execution] Project: ${options.projectId}`)
  console.log(`[test-cleanup-execution] Mode: ${options.apply ? 'apply requested' : 'dry-run only'}`)
  console.log(`[test-cleanup-execution] Credential project: ${identity.credentialProjectStatus}`)
  console.log(`[test-cleanup-execution] Output directory: ${resolve(options.outputDir)}`)
  const approvedReport = await loadApprovedDryRunReport(options.approvedReportPath)
  const source = createAdminCleanupExecutionSource(options)
  const report = await runCleanupExecution(source, options, approvedReport)
  const paths = await writeExecutionReports(report, options.outputDir)
  console.log(humanExecutionSummary(report))
  console.log(`[test-cleanup-execution] JSON report: ${paths.jsonPath}`)
  console.log(`[test-cleanup-execution] Summary report: ${paths.summaryPath}`)
  if (report.metadata.status !== 'dry-run' && report.metadata.status !== 'complete') process.exitCode = 2
}

main().catch((error) => {
  console.error(`[test-cleanup-execution] ${safeErrorDetails(error)}`)
  process.exitCode = 1
})
