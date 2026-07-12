import { LOOKUP_SOURCES } from './constants.js'
import { ISSUE_CODES, issue } from './issues.js'

function warnings(value) {
  const knownCodes = new Set(Object.values(ISSUE_CODES))
  const normalized = (Array.isArray(value) ? value : []).flatMap((warning) => {
    if (typeof warning === 'string' && knownCodes.has(warning)) return [issue(warning)]
    if (warning && typeof warning === 'object' && knownCodes.has(warning.code)) return [{ ...warning }]
    return []
  })
  return Object.freeze(normalized.map(Object.freeze))
}

function lookupResult(value) {
  if (value.issues) value.issues = Object.freeze(value.issues.map(Object.freeze))
  if (value.candidateDocumentIds) value.candidateDocumentIds = Object.freeze(value.candidateDocumentIds)
  return Object.freeze(value)
}

export function foundBusiness(options = {}) {
  const { businessId, ownerId, source, warnings: sourceWarnings = [] } = options
  if (typeof businessId !== 'string' || !businessId.trim() || typeof ownerId !== 'string' ||
      !ownerId.trim() || !LOOKUP_SOURCES.includes(source)) return invalidMapping(sourceWarnings)
  const normalizedBusinessId = businessId.trim()
  const normalizedOwnerId = ownerId.trim()
  return lookupResult({
    status: 'found', businessId: normalizedBusinessId, source,
    idEqualsOwnerUid: normalizedBusinessId === normalizedOwnerId,
    usedLegacyCompatibility: source === 'owner_uid_document' || source === 'owner_id_query',
    warnings: warnings(sourceWarnings),
  })
}

export function businessNotFound(sourceWarnings = []) {
  return lookupResult({ status: 'not_found', warnings: warnings(sourceWarnings) })
}

export function ambiguousBusinesses(candidateDocumentIds, sourceWarnings = []) {
  if (!Array.isArray(candidateDocumentIds)) return invalidMapping(sourceWarnings)
  const candidates = [...new Set(candidateDocumentIds
    .filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))].sort()
  if (candidates.length < 2) return invalidMapping(sourceWarnings)
  return lookupResult({
    status: 'ambiguous', candidateDocumentIds: candidates,
    issues: [issue(ISSUE_CODES.LOOKUP_MULTIPLE_CANDIDATES, { candidateCount: candidates.length })],
    warnings: warnings(sourceWarnings),
  })
}

export function invalidMapping(sourceWarnings = []) {
  return lookupResult({
    status: 'invalid_mapping', issues: [issue(ISSUE_CODES.LOOKUP_INVALID_MAPPING)],
    warnings: warnings(sourceWarnings),
  })
}

export function ownerMismatch(options = {}) {
  const { businessId, expectedOwnerId, actualOwnerId, warnings: sourceWarnings = [] } = options
  if (![businessId, expectedOwnerId, actualOwnerId]
    .every((value) => typeof value === 'string' && value.trim())) return invalidMapping(sourceWarnings)
  return lookupResult({
    status: 'owner_mismatch', businessId, expectedOwnerId, actualOwnerId,
    issues: [issue(ISSUE_CODES.LOOKUP_MAPPING_OWNER_MISMATCH)], warnings: warnings(sourceWarnings),
  })
}
