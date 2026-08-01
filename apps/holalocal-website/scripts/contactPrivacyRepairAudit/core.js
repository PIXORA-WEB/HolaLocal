import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const TARGET_CODES = new Set([
  'AUDIT_PUBLIC_CONTACT_VALUE_HIDDEN',
  'CONTACT_HIDDEN_VALUE_PRESENT',
])

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function contactWebsite(document) {
  return text(document?.contact?.website)
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
  }
  return value
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')
}

function snapshotFingerprint(snapshot) {
  return snapshot.exists ? fingerprint(snapshot.data) : null
}

function fieldFingerprint(document, path) {
  const value = path.split('.').reduce((current, key) => current?.[key], document)
  return value === undefined ? null : fingerprint(value)
}

function isHiddenWebsiteIssue(issue) {
  const code = issue?.code
  const field = String(issue?.field ?? issue?.fields?.[0] ?? issue?.details?.field ?? '')
  return TARGET_CODES.has(code) && field.includes('website')
}

function businessPathFromIssue(issue) {
  const path = issue?.documentPath ?? issue?.path ?? issue?.document ?? issue?.businessPath
  if (typeof path === 'string' && /^businesses\/[^/]+$/.test(path)) return path
  if (typeof issue?.businessId === 'string' && issue.businessId.trim()) {
    return `businesses/${issue.businessId.trim()}`
  }
  return ''
}

export async function targetPathsFromAuditReport(reportPath) {
  const raw = JSON.parse(await readFile(reportPath, 'utf8'))
  const issues = Array.isArray(raw.issues) ? raw.issues : []
  const matchingIssues = issues
    .filter(isHiddenWebsiteIssue)
    .map((issue) => businessPathFromIssue(issue))
    .filter(Boolean)
  const uniquePaths = [...new Set(matchingIssues)].sort()
  return {
    reportIdentity: {
      path: reportPath,
      schemaVersion: raw.metadata?.reportSchemaVersion ?? raw.metadata?.auditSchemaVersion ?? null,
      projectId: raw.metadata?.projectId ?? null,
      startedAt: raw.metadata?.startedAt ?? null,
      finishedAt: raw.metadata?.finishedAt ?? null,
      complete: raw.metadata?.complete === true,
      hiddenWebsiteIssueCount: matchingIssues.length,
    },
    targetPaths: uniquePaths,
  }
}

export async function businessPathFromAuditReport(reportPath) {
  const { targetPaths: uniquePaths } = await targetPathsFromAuditReport(reportPath)
  if (uniquePaths.length !== 1) {
    throw new Error(`Expected exactly one hidden website issue, found ${uniquePaths.length}.`)
  }
  return uniquePaths[0]
}

export async function runContactPrivacyRepairAudit({
  source,
  projectId,
  businessId = '',
  auditReport = '',
  expectedTargetCount,
  maxMutations,
}) {
  const targetSelection = businessId
    ? {
      reportIdentity: null,
      targetPaths: businessId.trim() ? [`businesses/${businessId.trim()}`] : [],
    }
    : await targetPathsFromAuditReport(auditReport)
  const actualTargetCount = targetSelection.targetPaths.length
  if (actualTargetCount !== expectedTargetCount) {
    throw new Error(`Expected ${expectedTargetCount} contact privacy target(s), found ${actualTargetCount}.`)
  }
  if (actualTargetCount > 1) throw new Error('Narrow contact privacy repair supports exactly one target at a time.')
  const businessPath = targetSelection.targetPaths[0] ?? ''
  if (!/^businesses\/[^/]+$/.test(businessPath)) throw new Error('Invalid business document path.')
  const businessDocumentId = businessPath.split('/')[1]
  const privatePath = `businessPrivate/${businessDocumentId}`

  const [publicSnapshot, privateSnapshot] = await Promise.all([
    source.getDocument(businessPath),
    source.getDocument(privatePath),
  ])
  const publicData = publicSnapshot.exists ? publicSnapshot.data : null
  const privateData = privateSnapshot.exists ? privateSnapshot.data : null
  const publicWebsite = contactWebsite(publicData)
  const privateWebsite = contactWebsite(privateData)
  const websiteVisible = publicData?.contact?.websiteVisible === true
    || privateData?.contact?.websiteVisible === true
  const privateOwnerMatches = Boolean(
    publicData?.ownerId
      && privateData?.ownerId
      && publicData.ownerId === privateData.ownerId,
  )
  const publicWebsitePresent = Boolean(publicWebsite)
  const privateWebsitePresent = Boolean(privateWebsite)
  const proposedDocumentMutationCount = publicWebsitePresent && !websiteVisible && privateWebsitePresent && publicWebsite === privateWebsite
    ? 1
    : 0
  if (proposedDocumentMutationCount > maxMutations) {
    throw new Error(`Proposed mutation count ${proposedDocumentMutationCount} exceeds maximum ${maxMutations}.`)
  }
  const drift = buildDrift({ publicSnapshot, privateSnapshot, publicWebsitePresent, websiteVisible, privateWebsitePresent, publicWebsite, privateWebsite, privateOwnerMatches })

  return {
    metadata: {
      schemaVersion: 'contact-privacy-repair-dry-run/v1',
      projectId,
      complete: publicSnapshot.exists,
      mode: 'read-only',
      storageChecked: false,
    },
    sourceAudit: targetSelection.reportIdentity,
    guardrails: {
      expectedTargetCount,
      actualTargetCount,
      maxMutations,
      proposedDocumentMutationCount,
      safeToSubmitForWriteApproval: proposedDocumentMutationCount === 1 && drift.length === 0 && Boolean(publicSnapshot.updateTimeString),
    },
    target: {
      businessPath,
      privatePath,
      publicBusinessExists: publicSnapshot.exists,
      privateBusinessExists: privateSnapshot.exists,
      publicWebsitePresent,
      websiteVisibilityHidden: !websiteVisible,
      privateWebsitePresent,
      privateWebsiteMatchesPublic: publicWebsitePresent && privateWebsitePresent
        ? publicWebsite === privateWebsite
        : false,
      preservationRequired: publicWebsitePresent && (!privateWebsitePresent || publicWebsite !== privateWebsite),
      publicFieldToRemoveLater: publicWebsitePresent && !websiteVisible
        ? `${businessPath}.contact.website`
        : null,
      privateOwnerMatches,
      publicUpdateTime: publicSnapshot.updateTimeString ?? null,
      privateUpdateTime: privateSnapshot.updateTimeString ?? null,
      documentFingerprints: {
        publicBusiness: snapshotFingerprint(publicSnapshot),
        privateBusiness: snapshotFingerprint(privateSnapshot),
      },
      preChangeFieldFingerprints: {
        'businesses.contact.website': fieldFingerprint(publicData, 'contact.website'),
        'businesses.contact.websiteVisible': fieldFingerprint(publicData, 'contact.websiteVisible'),
        'businessPrivate.contact.website': fieldFingerprint(privateData, 'contact.website'),
        'businesses.ownerId': fieldFingerprint(publicData, 'ownerId'),
        'businessPrivate.ownerId': fieldFingerprint(privateData, 'ownerId'),
      },
    },
    checks: {
      publicWebsiteValueExists: publicWebsitePresent,
      visibilitySettingIsHidden: !websiteVisible,
      matchingPrivateDocumentExists: privateSnapshot.exists,
      privateWebsiteAlreadyExists: privateWebsitePresent,
      preservePublicValuePrivatelyBeforeRemoval: publicWebsitePresent
        && (!privateWebsitePresent || publicWebsite !== privateWebsite),
      drift,
    },
    findings: buildFindings({
      publicSnapshot,
      privateSnapshot,
      publicWebsitePresent,
      websiteVisible,
      privateWebsitePresent,
      privateOwnerMatches,
    }),
  }
}

function buildDrift({
  publicSnapshot,
  privateSnapshot,
  publicWebsitePresent,
  websiteVisible,
  privateWebsitePresent,
  publicWebsite,
  privateWebsite,
  privateOwnerMatches,
}) {
  const drift = []
  if (!publicSnapshot.exists) drift.push('public-business-missing')
  if (!privateSnapshot.exists) drift.push('private-business-missing')
  if (!publicWebsitePresent) drift.push('public-website-already-absent')
  if (websiteVisible) drift.push('website-visible')
  if (!privateWebsitePresent) drift.push('private-website-missing')
  if (publicWebsitePresent && privateWebsitePresent && publicWebsite !== privateWebsite) {
    drift.push('private-website-fingerprint-mismatch')
  }
  if (!privateOwnerMatches) drift.push('private-owner-mismatch')
  return drift.sort()
}

function buildFindings({
  publicSnapshot,
  privateSnapshot,
  publicWebsitePresent,
  websiteVisible,
  privateWebsitePresent,
  privateOwnerMatches,
}) {
  const findings = []
  const add = (code, severity, category, field) => {
    findings.push({ code, severity, category, field })
  }
  if (!publicSnapshot.exists) add('CONTACT_PRIVACY_PUBLIC_BUSINESS_MISSING', 'error', 'privacy', 'businesses')
  if (!publicWebsitePresent) add('CONTACT_PRIVACY_PUBLIC_WEBSITE_ABSENT', 'warning', 'privacy', 'contact.website')
  if (websiteVisible) add('CONTACT_PRIVACY_WEBSITE_VISIBLE', 'error', 'privacy', 'contact.websiteVisible')
  if (!privateSnapshot.exists) add('CONTACT_PRIVACY_PRIVATE_BUSINESS_MISSING', 'error', 'privacy', 'businessPrivate')
  if (privateSnapshot.exists && !privateWebsitePresent) {
    add('CONTACT_PRIVACY_PRIVATE_WEBSITE_MISSING', 'warning', 'privacy', 'businessPrivate.contact.website')
  }
  if (privateSnapshot.exists && !privateOwnerMatches) {
    add('CONTACT_PRIVACY_PRIVATE_OWNER_MISMATCH', 'error', 'ownership', 'ownerId')
  }
  return findings.sort((a, b) => `${a.severity}:${a.code}:${a.field}`.localeCompare(`${b.severity}:${b.code}:${b.field}`))
}
