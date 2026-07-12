import { readFile } from 'node:fs/promises'

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function contactWebsite(document) {
  return text(document?.contact?.website)
}

function websiteVisible(document) {
  return document?.contact?.websiteVisible === true
}

export async function loadApprovedContactPrivacyDryRun(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

export function verifyApprovedContactPrivacyDryRun(report, options) {
  const failures = []
  if (report.metadata?.projectId !== options.projectId) failures.push('project-mismatch')
  if (report.metadata?.complete !== true) failures.push('dry-run-incomplete')
  if (report.metadata?.mode !== 'read-only') failures.push('dry-run-not-read-only')
  if (report.target?.businessPath !== options.businessPath) failures.push('business-path-mismatch')
  if (report.target?.publicBusinessExists !== true) failures.push('public-business-missing')
  if (report.target?.privateBusinessExists !== true) failures.push('private-business-missing')
  if (report.target?.publicWebsitePresent !== true) failures.push('public-website-missing')
  if (report.target?.websiteVisibilityHidden !== true) failures.push('website-not-hidden')
  if (report.target?.privateWebsitePresent !== true) failures.push('private-website-missing')
  if (report.target?.preservationRequired !== false) failures.push('private-preservation-required')
  if ((report.findings?.length ?? 0) !== 0) failures.push('dry-run-has-findings')
  if (report.target?.publicFieldToRemoveLater !== `${options.businessPath}.contact.website`) {
    failures.push('unexpected-public-field')
  }
  if (failures.length) throw new Error(`Approved dry-run report failed verification: ${failures.join(', ')}`)
  return true
}

export async function inspectCurrentRepairState(source, businessPath) {
  if (!/^businesses\/[^/]+$/.test(businessPath)) throw new Error('Invalid business path.')
  const businessId = businessPath.split('/')[1]
  const privatePath = `businessPrivate/${businessId}`
  const [publicSnapshot, privateSnapshot] = await Promise.all([
    source.getDocument(businessPath),
    source.getDocument(privatePath),
  ])
  const publicData = publicSnapshot.exists ? publicSnapshot.data : null
  const privateData = privateSnapshot.exists ? privateSnapshot.data : null
  const publicWebsite = contactWebsite(publicData)
  const privateWebsite = contactWebsite(privateData)
  return {
    businessPath,
    privatePath,
    publicBusinessExists: publicSnapshot.exists,
    privateBusinessExists: privateSnapshot.exists,
    publicWebsitePresent: Boolean(publicWebsite),
    privateWebsitePresent: Boolean(privateWebsite),
    websiteVisibilityHidden: !websiteVisible(publicData) && !websiteVisible(privateData),
    publicPrivateOwnerMatch: Boolean(
      publicData?.ownerId
        && privateData?.ownerId
        && publicData.ownerId === privateData.ownerId,
    ),
    publicPrivateWebsiteMatch: Boolean(publicWebsite && privateWebsite && publicWebsite === privateWebsite),
  }
}

export function currentStateDrift(approvedReport, currentState) {
  const drift = []
  const target = approvedReport.target ?? {}
  for (const [field, expected] of [
    ['businessPath', target.businessPath],
    ['privatePath', target.privatePath],
    ['publicBusinessExists', true],
    ['privateBusinessExists', true],
    ['publicWebsitePresent', true],
    ['privateWebsitePresent', true],
    ['websiteVisibilityHidden', true],
    ['publicPrivateOwnerMatch', true],
  ]) {
    if (currentState[field] !== expected) drift.push(`${field}-drift`)
  }
  if (target.privateWebsiteMatchesPublic === true && currentState.publicPrivateWebsiteMatch !== true) {
    drift.push('private-website-match-drift')
  }
  return drift.sort()
}

export async function runContactPrivacyRepairExecution({
  approvedReport,
  now = () => new Date().toISOString(),
  options,
  source,
}) {
  verifyApprovedContactPrivacyDryRun(approvedReport, options)
  const currentState = await inspectCurrentRepairState(source, options.businessPath)
  const drift = currentStateDrift(approvedReport, currentState)
  const plannedOperation = {
    path: options.businessPath,
    fields: ['contact.website', 'contact.websiteVisible'],
    values: { 'contact.website': '', 'contact.websiteVisible': false },
  }
  const executedOperations = []
  let status = options.apply ? 'complete' : 'dry-run'
  let failedStep = null

  if (drift.length) {
    status = 'blocked-drift'
  } else if (options.apply) {
    try {
      executedOperations.push(await source.clearHiddenPublicWebsite(options.businessPath))
    } catch (error) {
      status = 'failed'
      failedStep = { category: 'public-contact-update', message: safeFailure(error) }
    }
  }

  return {
    metadata: {
      apply: options.apply,
      complete: status === 'complete' || status === 'dry-run',
      finishedAt: now(),
      mode: options.apply ? 'apply' : 'dry-run',
      projectId: options.projectId,
      reportSchemaVersion: 'contact-privacy-repair-execution-v1',
      status,
      storageChanged: false,
      tool: 'contact-privacy-repair-execution',
    },
    approvedSummary: {
      privatePreservationRequired: approvedReport.target?.preservationRequired === true,
      publicFieldToRemoveLater: approvedReport.target?.publicFieldToRemoveLater,
    },
    currentState,
    drift,
    failedStep,
    plannedOperation,
    executedOperations,
  }
}

function safeFailure(error) {
  return String(error?.message ?? error ?? '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/https?:\/\/[^\s)]+/gi, '[REDACTED_URL]')
    .replace(/([?&](?:token|access_token|auth|key|signature)=)[^&\s]+/gi, '$1[REDACTED]')
    .slice(0, 200)
}
