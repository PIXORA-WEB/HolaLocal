import { mkdir, open, writeFile } from 'node:fs/promises'
import path from 'node:path'

const SUMMARY_FILE = 'contact-privacy-repair-execution-summary.txt'
const JSON_FILE = 'contact-privacy-repair-execution-report.json'

export function humanSummary(report) {
  return [
    'HolaLocal contact privacy repair execution report',
    'Confidential operational output: document paths may identify records.',
    `Project ID: ${report.metadata.projectId}`,
    `Mode: ${report.metadata.mode}`,
    `Status: ${report.metadata.status}`,
    `Complete: ${report.metadata.complete ? 'yes' : 'no'}`,
    `Storage changed: ${report.metadata.storageChanged ? 'yes' : 'no'}`,
    `Drift findings: ${report.drift.length}`,
    `Public business exists: ${report.currentState.publicBusinessExists ? 'yes' : 'no'}`,
    `Private document exists: ${report.currentState.privateBusinessExists ? 'yes' : 'no'}`,
    `Public website present before repair: ${report.currentState.publicWebsitePresent ? 'yes' : 'no'}`,
    `Private website present before repair: ${report.currentState.privateWebsitePresent ? 'yes' : 'no'}`,
    `Planned fields: ${report.plannedOperation.fields.join(', ')}`,
    `Executed operations: ${report.executedOperations.length}`,
    '',
  ].join('\n')
}

export async function writeContactPrivacyExecutionReports(outputDir, report) {
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
