#!/usr/bin/env node
import { createContactPrivacyExecutionSource } from './adminSource.js'
import {
  CONFIRMATION_PHRASE,
  parseContactPrivacyExecutionArguments,
  validateExecutionEnvironment,
} from './config.js'
import {
  loadApprovedContactPrivacyDryRun,
  runContactPrivacyRepairExecution,
} from './core.js'
import {
  humanSummary,
  writeContactPrivacyExecutionReports,
} from './reportWriter.js'

function usage() {
  return `Usage: npm run repair:contact-privacy-controlled -- \\
  --project-id <firebase-project> \\
  --confirm-project <same-project> \\
  --approved-dry-run-report <contact-privacy-repair-dry-run-report.json> \\
  --business-path <businesses/document-id> \\
  --output-dir <private-output-dir>

Dry-run is the default. Production repair additionally requires:
  --apply --confirm-repair "${CONFIRMATION_PHRASE}"`
}

async function main(argv = process.argv.slice(2)) {
  const options = parseContactPrivacyExecutionArguments(argv)
  if (options.help) {
    console.log(usage())
    return 0
  }
  await validateExecutionEnvironment(options)
  console.log(`Selected Firebase project: ${options.projectId}`)
  console.log(`Mode: ${options.apply ? 'controlled repair apply' : 'controlled repair dry run'}`)
  const approvedReport = await loadApprovedContactPrivacyDryRun(options.dryRunReport)
  const source = createContactPrivacyExecutionSource(options)
  const report = await runContactPrivacyRepairExecution({ approvedReport, options, source })
  await writeContactPrivacyExecutionReports(options.outputDir, report)
  console.log(humanSummary(report))
  if (report.metadata.status === 'blocked-drift') return 2
  if (report.metadata.status === 'failed') return 1
  return 0
}

main().then((code) => {
  process.exitCode = code
}).catch((error) => {
  console.error(`Contact privacy repair execution failed: ${error?.message ?? 'Unknown error'}`)
  process.exitCode = 1
})
