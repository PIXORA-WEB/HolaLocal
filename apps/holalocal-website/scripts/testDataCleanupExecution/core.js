import { readFile } from 'node:fs/promises'
import { CLASSIFICATIONS, runTestCleanupAudit } from '../testDataCleanupAudit/core.js'

const EXPECTED_COUNTS = Object.freeze({
  authAmbiguous: 2,
  authSafe: 2,
  businessPrivateSafe: 3,
  businessesSafe: 4,
  conversationsSafe: 1,
  reportsSafe: 0,
  usersSafe: 4,
})

const DELETE_ORDER = ['conversations', 'businessOwners', 'businessPrivate', 'businesses', 'userDocuments', 'authAccounts']

export async function loadApprovedDryRunReport(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

export function verifyApprovedDryRunReport(report, options) {
  const failures = []
  const counts = report.classificationCounts ?? {}
  const blocking = report.blockingFindings ?? []
  if (report.metadata?.complete !== true) failures.push('approved-report-incomplete')
  if (report.metadata?.projectId !== options.projectId) failures.push('approved-report-project-mismatch')
  if ((counts.userDocuments?.[CLASSIFICATIONS.SAFE] ?? 0) !== EXPECTED_COUNTS.usersSafe) failures.push('unexpected-safe-user-count')
  if ((counts.businesses?.[CLASSIFICATIONS.SAFE] ?? 0) !== EXPECTED_COUNTS.businessesSafe) failures.push('unexpected-safe-business-count')
  if ((counts.businessPrivate?.[CLASSIFICATIONS.SAFE] ?? 0) !== EXPECTED_COUNTS.businessPrivateSafe) failures.push('unexpected-safe-private-count')
  if ((counts.conversations?.[CLASSIFICATIONS.SAFE] ?? 0) !== EXPECTED_COUNTS.conversationsSafe) failures.push('unexpected-safe-conversation-count')
  if ((counts.reports?.[CLASSIFICATIONS.SAFE] ?? 0) !== EXPECTED_COUNTS.reportsSafe) failures.push('unexpected-safe-report-count')
  if ((counts.authAccounts?.[CLASSIFICATIONS.SAFE] ?? 0) !== EXPECTED_COUNTS.authSafe) failures.push('unexpected-safe-auth-count')
  if ((counts.authAccounts?.[CLASSIFICATIONS.AMBIGUOUS] ?? 0) !== EXPECTED_COUNTS.authAmbiguous) failures.push('unexpected-ambiguous-auth-count')
  if (blocking.length !== 2 || blocking.some((item) => item.type !== 'authAccounts' || item.classification !== CLASSIFICATIONS.AMBIGUOUS)) {
    failures.push('unexpected-blocking-findings')
  }
  const protectedCounts = report.protectedSummary ?? {}
  if (protectedCounts.authAccounts !== 2 || protectedCounts.userDocuments !== 2) failures.push('protected-account-summary-mismatch')
  if (failures.length) throw new Error(`Approved dry-run report failed verification: ${failures.join(', ')}`)
  return true
}

export function buildAllowlist(report) {
  const safe = (type) => (report.items?.[type] ?? []).filter((item) => item.classification === CLASSIFICATIONS.SAFE)
  return {
    authAccounts: safe('authAccounts').filter((item) => item.exists !== false).map((item) => item.uid).sort(),
    businessOwners: safe('businessOwners').map((item) => item.path).sort(),
    businessPrivate: safe('businessPrivate').map((item) => item.path).sort(),
    businesses: safe('businesses').map((item) => item.path).sort(),
    conversations: safe('conversations').map((item) => item.path).sort(),
    reports: safe('reports').map((item) => item.path).sort(),
    userDocuments: safe('userDocuments').map((item) => item.path).sort(),
  }
}

export function compareCurrentStateToApproved(approved, current) {
  const differences = []
  const approvedAllowlist = buildAllowlist(approved)
  const currentAllowlist = buildAllowlist(current)
  for (const key of Object.keys(approvedAllowlist)) {
    if (approvedAllowlist[key].join('\n') !== currentAllowlist[key].join('\n')) differences.push(`${key}-allowlist-drift`)
  }
  for (const [type, counts] of Object.entries(approved.classificationCounts ?? {})) {
    for (const [classification, count] of Object.entries(counts)) {
      if ((current.classificationCounts?.[type]?.[classification] ?? 0) !== count) differences.push(`${type}-${classification}-count-drift`)
    }
  }
  const currentBlocking = current.blockingFindings ?? []
  if (currentBlocking.length !== 2 || currentBlocking.some((item) => item.type !== 'authAccounts' || item.classification !== CLASSIFICATIONS.AMBIGUOUS)) {
    differences.push('current-blocking-findings-drift')
  }
  return differences
}

export async function runCleanupExecution(source, options, approvedReport, now = () => new Date().toISOString()) {
  verifyApprovedDryRunReport(approvedReport, options)
  const currentReport = await runTestCleanupAudit(source, options, now)
  const drift = compareCurrentStateToApproved(approvedReport, currentReport)
  if (drift.length) {
    return executionReport({ approvedReport, currentReport, drift, now, options, status: 'blocked-drift' })
  }
  const allowlist = buildAllowlist(approvedReport)
  const plannedOperations = buildOperations(allowlist)
  const operations = []
  let status = options.apply ? 'complete' : 'dry-run'
  let failedStep = null

  if (options.apply) {
    for (const group of DELETE_ORDER) {
      for (const operation of plannedOperations.filter((item) => item.group === group)) {
        try {
          if (operation.kind === 'auth') {
            operations.push({ ...operation, result: await source.deleteAuthAccount(operation.uid) })
          } else {
            operations.push({ ...operation, result: await source.deleteDocument(operation.path) })
          }
        } catch (error) {
          status = 'failed'
          failedStep = { group, kind: operation.kind, path: operation.path, uid: operation.uid, message: safeFailure(error) }
          operations.push({ ...operation, result: { status: 'failed', message: safeFailure(error) } })
          return executionReport({ approvedReport, currentReport, drift, failedStep, now, operations, options, status })
        }
      }
    }
  }

  return executionReport({ approvedReport, currentReport, drift, failedStep, now, operations, options, plannedOperations, status })
}

function buildOperations(allowlist) {
  return [
    ...allowlist.conversations.map((path) => ({ group: 'conversations', kind: 'firestore-document', path })),
    ...allowlist.businessOwners.map((path) => ({ group: 'businessOwners', kind: 'firestore-document', path })),
    ...allowlist.businessPrivate.map((path) => ({ group: 'businessPrivate', kind: 'firestore-document', path })),
    ...allowlist.businesses.map((path) => ({ group: 'businesses', kind: 'firestore-document', path })),
    ...allowlist.userDocuments.map((path) => ({ group: 'userDocuments', kind: 'firestore-document', path })),
    ...allowlist.authAccounts.map((uid) => ({ group: 'authAccounts', kind: 'auth', uid })),
  ]
}

function executionReport({ approvedReport, currentReport, drift, failedStep = null, now, operations = [], options, plannedOperations = [], status }) {
  const plans = plannedOperations.length ? plannedOperations : buildOperations(buildAllowlist(approvedReport))
  return {
    metadata: {
      apply: options.apply,
      complete: status === 'complete' || status === 'dry-run',
      finishedAt: now(),
      projectId: options.projectId,
      reportSchemaVersion: 'phase-1c-test-cleanup-execution-v1',
      status,
      storageDeletion: false,
      tool: 'test-data-cleanup-execution',
    },
    approvedSummary: {
      blockingFindings: approvedReport.blockingFindings?.length ?? 0,
      classificationCounts: approvedReport.classificationCounts,
    },
    currentSummary: {
      blockingFindings: currentReport.blockingFindings?.length ?? 0,
      classificationCounts: currentReport.classificationCounts,
    },
    drift,
    failedStep,
    plannedCounts: countOperations(plans),
    plannedOperations: plans,
    executedOperations: operations,
  }
}

function countOperations(operations) {
  return operations.reduce((counts, operation) => {
    counts[operation.group] = (counts[operation.group] ?? 0) + 1
    return counts
  }, {})
}

function safeFailure(error) {
  return String(error?.message ?? error ?? '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/https?:\/\/[^\s)]+/gi, '[REDACTED_URL]')
    .replace(/([?&](?:token|access_token|auth|key|signature)=)[^&\s]+/gi, '$1[REDACTED]')
    .slice(0, 200)
}
