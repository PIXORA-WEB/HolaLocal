import { lstat, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

export function humanSummary(report) {
  const lines = [
    `HolaLocal Firebase read-only audit`,
    `Project: ${report.metadata.projectId}`,
    `Schema: ${report.metadata.auditSchemaVersion}`,
    `Started: ${report.metadata.startedAt}`,
    `Finished: ${report.metadata.finishedAt}`,
    `Complete: ${report.metadata.complete ? 'yes' : 'no'}`,
    `Emulator: ${report.metadata.emulator ? 'yes' : 'no'}`,
    `Storage checks: ${report.metadata.checkStorage ? 'enabled' : 'disabled'}`,
    `Collections: ${report.metadata.collections.join(', ')}`,
    '',
    'Document counts:',
    ...Object.entries(report.counts.collections).sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => `- ${name}: ${count}`),
    '',
    'Issue counts by severity:',
    ...Object.entries(report.summary.bySeverity).sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => `- ${name}: ${count}`),
    '',
    'Issue counts by category:',
    ...Object.entries(report.summary.byCategory).sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => `- ${name}: ${count}`),
    '',
    `Ownership summary: owners with zero businesses ${report.summary.ownership.ownersWithZeroBusinesses}; one ${report.summary.ownership.ownersWithOneBusiness}; multiple ${report.summary.ownership.ownersWithMultipleBusinesses}`,
    `Duplicate groups: ${report.duplicateBusinessGroups.length}`,
    `Contact privacy issues: ${report.summary.contactPrivacyIssues}`,
    `Language issues: ${report.summary.languageIssues}`,
    `Manual review count: ${report.summary.manualReviewCount}`,
    `Migration readiness: ${report.summary.migrationReadiness}`,
    '',
    report.metadata.complete ? 'Audit completed technically.' : 'Audit incomplete: do not use this run for migration readiness decisions.',
    'Confidential operational data: document paths may identify users or businesses. Store and share this report accordingly.',
    'This report is read-only and contains aggregate counts plus document references only.',
  ]
  return `${lines.join('\n')}\n`
}

async function assertWritableOutputDirectory(outputDir) {
  const resolved = resolve(outputDir)
  try {
    const stats = await lstat(resolved)
    if (stats.isSymbolicLink()) throw new Error('Output directory must not be a symlink.')
    if (!stats.isDirectory()) throw new Error('Output path must be a directory.')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    await mkdir(resolved, { recursive: true, mode: 0o700 })
  }
  return resolved
}

async function assertDoesNotExist(path) {
  try {
    await lstat(path)
    throw new Error(`Refusing to overwrite existing report file: ${path}`)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

export async function writeAuditReports(report, outputDir) {
  const resolvedOutputDir = await assertWritableOutputDirectory(outputDir)
  const jsonPath = join(resolvedOutputDir, 'firebase-audit-report.json')
  const summaryPath = join(resolvedOutputDir, 'firebase-audit-summary.txt')
  const jsonTemp = `${jsonPath}.tmp`
  const summaryTemp = `${summaryPath}.tmp`
  await assertDoesNotExist(jsonPath)
  await assertDoesNotExist(summaryPath)
  try {
    await writeFile(jsonTemp, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
    await writeFile(summaryTemp, humanSummary(report), { mode: 0o600, flag: 'wx' })
    await rename(jsonTemp, jsonPath)
    await rename(summaryTemp, summaryPath)
  } catch (error) {
    await Promise.all([rm(jsonTemp, { force: true }), rm(summaryTemp, { force: true })])
    throw error
  }
  return { jsonPath, summaryPath }
}
