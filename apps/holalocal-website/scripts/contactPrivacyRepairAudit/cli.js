#!/usr/bin/env node
import { createContactPrivacyRepairSource } from './adminSource.js'
import {
  parseContactPrivacyRepairArguments,
  validateExecutionEnvironment,
} from './config.js'
import { runContactPrivacyRepairAudit } from './core.js'
import { humanSummary, writeContactPrivacyRepairReports } from './reportWriter.js'

function usage() {
  return `Usage: npm run audit:contact-privacy-repair-readonly -- \\
  --project-id <firebase-project> \\
  --confirm-project <same-project> \\
  --audit-report <firebase-audit-report.json> \\
  --output-dir <private-output-dir>

This is a read-only dry run. It has no apply, write, repair or migration mode.`
}

async function main(argv = process.argv.slice(2)) {
  const options = parseContactPrivacyRepairArguments(argv)
  if (options.help) {
    console.log(usage())
    return 0
  }
  await validateExecutionEnvironment(options)
  console.log(`Selected Firebase project: ${options.projectId}`)
  console.log('Mode: read-only contact privacy repair dry run')
  const source = createContactPrivacyRepairSource(options)
  const report = await runContactPrivacyRepairAudit({
    source,
    projectId: options.projectId,
    auditReport: options.auditReport,
    businessId: options.businessId,
  })
  await writeContactPrivacyRepairReports(options.outputDir, report)
  console.log(humanSummary(report))
  return report.metadata.complete && report.findings.every((finding) => finding.severity !== 'error')
    ? 0
    : 2
}

main().then((code) => {
  process.exitCode = code
}).catch((error) => {
  console.error(`Contact privacy repair dry run failed: ${error?.message ?? 'Unknown error'}`)
  process.exitCode = 1
})
