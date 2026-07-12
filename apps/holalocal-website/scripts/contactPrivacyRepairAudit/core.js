import { readFile } from 'node:fs/promises'

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

export async function businessPathFromAuditReport(reportPath) {
  const raw = JSON.parse(await readFile(reportPath, 'utf8'))
  const issues = Array.isArray(raw.issues) ? raw.issues : []
  const matchingIssues = issues
    .filter(isHiddenWebsiteIssue)
    .map((issue) => businessPathFromIssue(issue))
    .filter(Boolean)
  const uniquePaths = [...new Set(matchingIssues)].sort()
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
}) {
  const businessPath = businessId
    ? `businesses/${businessId.trim()}`
    : await businessPathFromAuditReport(auditReport)
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

  return {
    metadata: {
      schemaVersion: 'contact-privacy-repair-dry-run/v1',
      projectId,
      complete: publicSnapshot.exists,
      mode: 'read-only',
      storageChecked: false,
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
    },
    checks: {
      publicWebsiteValueExists: publicWebsitePresent,
      visibilitySettingIsHidden: !websiteVisible,
      matchingPrivateDocumentExists: privateSnapshot.exists,
      privateWebsiteAlreadyExists: privateWebsitePresent,
      preservePublicValuePrivatelyBeforeRemoval: publicWebsitePresent
        && (!privateWebsitePresent || publicWebsite !== privateWebsite),
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
