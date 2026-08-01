import { lstat, mkdir, rename, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

export function humanExecutionSummary(report) {
  const lines = [
    'HolaLocal test-data cleanup execution report',
    `Project: ${report.metadata.projectId}`,
    `Status: ${report.metadata.status}`,
    `Apply: ${report.metadata.apply ? 'yes' : 'no'}`,
    `Storage deletion: ${report.metadata.storageDeletion ? 'yes' : 'no'}`,
    '',
    'Planned counts:',
    ...Object.entries(report.plannedCounts).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `- ${key}: ${value}`),
    '',
    `Drift findings: ${report.drift.length}`,
    `Executed operations: ${report.executedOperations.length}`,
    report.failedStep ? `Failed step: ${report.failedStep.group}` : 'Failed step: none',
  ]
  return `${lines.join('\n')}\n`
}

async function ensureOutputDir(outputDir) {
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

async function assertMissing(path) {
  try {
    await lstat(path)
    throw new Error(`Refusing to overwrite existing report file: ${path}`)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

export async function writeExecutionReports(report, outputDir) {
  const resolved = await ensureOutputDir(outputDir)
  const jsonPath = join(resolved, 'test-cleanup-execution-report.json')
  const summaryPath = join(resolved, 'test-cleanup-execution-summary.txt')
  const jsonTemp = `${jsonPath}.tmp`
  const summaryTemp = `${summaryPath}.tmp`
  await assertMissing(jsonPath)
  await assertMissing(summaryPath)
  await writeFile(jsonTemp, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
  await writeFile(summaryTemp, humanExecutionSummary(report), { mode: 0o600, flag: 'wx' })
  await rename(jsonTemp, jsonPath)
  await rename(summaryTemp, summaryPath)
  return { jsonPath, summaryPath }
}
