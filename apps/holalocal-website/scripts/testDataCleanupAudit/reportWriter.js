import { lstat, mkdir, rename, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

export function humanSummary(report) {
  const lines = [
    'HolaLocal test-data cleanup read-only dry run',
    `Project: ${report.metadata.projectId}`,
    `Complete: ${report.metadata.complete ? 'yes' : 'no'}`,
    `Storage object checks: ${report.metadata.storageObjectChecks ? 'enabled' : 'disabled'}`,
    '',
    'Target account summaries:',
    ...report.targetSummaries.map((summary) => `- ${summary.label}: auth ${summary.authExists ? 'yes' : 'no'}, user ${summary.userDocumentExists ? 'yes' : 'no'}, businesses ${summary.businessCount}, private ${summary.privateDocumentCount}, conversations ${summary.conversationReferenceCount}, reports ${summary.reportReferenceCount}, media ${summary.mediaReferenceCount}`),
    '',
    'Classification counts:',
    ...Object.entries(report.classificationCounts).flatMap(([type, counts]) => [
      `- ${type}: safe ${counts['SAFE CLEANUP CANDIDATE'] ?? 0}, manual ${counts['MANUAL REVIEW'] ?? 0}, protected ${counts.PROTECTED ?? 0}, ambiguous ${counts.AMBIGUOUS ?? 0}`,
    ]),
    '',
    `Blocking findings: ${report.blockingFindings.length}`,
    'This is a read-only dry run. No production data was changed.',
  ]
  return `${lines.join('\n')}\n`
}

async function assertOutputDirectory(outputDir) {
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

export async function writeCleanupAuditReports(report, outputDir) {
  const resolved = await assertOutputDirectory(outputDir)
  const jsonPath = join(resolved, 'test-cleanup-dry-run-report.json')
  const summaryPath = join(resolved, 'test-cleanup-dry-run-summary.txt')
  const jsonTemp = `${jsonPath}.tmp`
  const summaryTemp = `${summaryPath}.tmp`
  await assertDoesNotExist(jsonPath)
  await assertDoesNotExist(summaryPath)
  await writeFile(jsonTemp, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
  await writeFile(summaryTemp, humanSummary(report), { mode: 0o600, flag: 'wx' })
  await rename(jsonTemp, jsonPath)
  await rename(summaryTemp, summaryPath)
  return { jsonPath, summaryPath }
}
