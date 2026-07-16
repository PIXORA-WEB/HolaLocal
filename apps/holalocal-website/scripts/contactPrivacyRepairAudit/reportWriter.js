import { mkdir, open, writeFile } from 'node:fs/promises'
import path from 'node:path'

const SUMMARY_FILE = 'contact-privacy-repair-dry-run-summary.txt'
const JSON_FILE = 'contact-privacy-repair-dry-run-report.json'

export function humanSummary(report) {
  const findingsBySeverity = report.findings.reduce((counts, finding) => {
    counts[finding.severity] = (counts[finding.severity] ?? 0) + 1
    return counts
  }, {})
  return [
    'HolaLocal contact privacy repair dry run',
    'Confidential operational output: document paths may identify records.',
    `Project ID: ${report.metadata.projectId}`,
    `Complete: ${report.metadata.complete ? 'yes' : 'no'}`,
    `Mode: ${report.metadata.mode}`,
    `Storage checked: ${report.metadata.storageChecked ? 'yes' : 'no'}`,
    `Source audit finished at: ${report.sourceAudit?.finishedAt ?? 'n/a'}`,
    `Expected target count: ${report.guardrails.expectedTargetCount}`,
    `Actual target count: ${report.guardrails.actualTargetCount}`,
    `Proposed document mutations: ${report.guardrails.proposedDocumentMutationCount}`,
    `Mutation ceiling: ${report.guardrails.maxMutations}`,
    `Safe to submit for separate write approval: ${report.guardrails.safeToSubmitForWriteApproval ? 'yes' : 'no'}`,
    `Public business exists: ${report.target.publicBusinessExists ? 'yes' : 'no'}`,
    `Private document exists: ${report.target.privateBusinessExists ? 'yes' : 'no'}`,
    `Public website value present: ${report.target.publicWebsitePresent ? 'yes' : 'no'}`,
    `Website visibility hidden: ${report.target.websiteVisibilityHidden ? 'yes' : 'no'}`,
    `Private website value present: ${report.target.privateWebsitePresent ? 'yes' : 'no'}`,
    `Preserve public value privately before removal: ${report.target.preservationRequired ? 'yes' : 'no'}`,
    `Public field proposed for removal: ${report.target.publicFieldToRemoveLater ?? 'none'}`,
    `Drift findings: ${report.checks.drift.length}`,
    `Findings by severity: ${JSON.stringify(findingsBySeverity)}`,
    '',
  ].join('\n')
}

export async function writeContactPrivacyRepairReports(outputDir, report) {
  const resolved = path.resolve(outputDir)
  await mkdir(resolved, { recursive: true, mode: 0o700 })
  const summaryPath = path.join(resolved, SUMMARY_FILE)
  const jsonPath = path.join(resolved, JSON_FILE)
  await reserve(summaryPath)
  await reserve(jsonPath)
  await writeFile(summaryPath, humanSummary(report), { mode: 0o600 })
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 })
  return { summaryPath, jsonPath }
}

async function reserve(filePath) {
  const handle = await open(filePath, 'wx', 0o600)
  await handle.close()
}
