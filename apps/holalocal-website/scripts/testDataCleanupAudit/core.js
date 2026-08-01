import { createHash } from 'node:crypto'

export const CLASSIFICATIONS = Object.freeze({
  AMBIGUOUS: 'AMBIGUOUS',
  MANUAL: 'MANUAL REVIEW',
  PROTECTED: 'PROTECTED',
  SAFE: 'SAFE CLEANUP CANDIDATE',
})

const COLLECTIONS = ['users', 'businesses', 'businessPrivate', 'conversations', 'reports', 'businessOwners']

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function array(value) {
  return Array.isArray(value) ? value : []
}

function hashReference(value) {
  if (!text(value)) return null
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

function hasAnyReference(value, ids) {
  if (!value) return false
  if (typeof value === 'string') return ids.has(value)
  if (Array.isArray(value)) return value.some((item) => hasAnyReference(item, ids))
  if (typeof value === 'object') return Object.values(value).some((item) => hasAnyReference(item, ids))
  return false
}

function collectMediaReferences(business) {
  const refs = []
  const addPath = (field, value, type) => {
    const path = text(value?.path)
    if (path) refs.push({ field, type, kind: 'storage-path', fingerprint: hashReference(path), path })
    const urlHash = hashReference(value?.downloadUrl)
    if (urlHash) refs.push({ field, type, kind: 'legacy-url', fingerprint: urlHash })
  }
  const addUrl = (field, value, type) => {
    const fingerprint = hashReference(value)
    if (fingerprint) refs.push({ field, type, kind: 'legacy-url', fingerprint })
  }

  addPath('profilePhoto', business.data.profilePhoto, 'logo')
  addPath('coverPhoto', business.data.coverPhoto, 'cover')
  addUrl('logoURL', business.data.logoURL, 'logo')
  addUrl('coverImageURL', business.data.coverImageURL, 'cover')
  for (const [index, item] of array(business.data.galleryImages).entries()) addPath(`galleryImages.${index}`, item, 'gallery')
  for (const [index, item] of array(business.data.galleryImageURLs).entries()) addUrl(`galleryImageURLs.${index}`, item, 'gallery')
  return refs
}

function hasPrivateForBusiness(privateDocs, businessId) {
  return privateDocs.some((document) => document.id === businessId || text(document.data.businessId) === businessId)
}

function classifyBusiness({ business, targetSet, protectedSet, allUsers, conversations, reports, privateDocs }) {
  const ownerId = text(business.data.ownerId)
  const managerIds = array(business.data.managerIds).filter((item) => typeof item === 'string')
  const managerReferences = new Set(managerIds)
  const protectedReference = protectedSet.has(ownerId) || managerIds.some((uid) => protectedSet.has(uid))
  const externalManagers = managerIds.filter((uid) => !targetSet.has(uid) && !protectedSet.has(uid))
  const ownedByTarget = targetSet.has(ownerId)
  const ownedByProtected = protectedSet.has(ownerId)
  const businessId = business.id
  const referencedByProtectedUser = allUsers.some((user) => protectedSet.has(user.id) && text(user.data.businessId) === businessId)
  const referencedByExternalUser = allUsers.some((user) => !targetSet.has(user.id) && !protectedSet.has(user.id) && text(user.data.businessId) === businessId)
  const conversationRefs = conversations.filter((conversation) => text(conversation.data.businessId) === businessId)
  const reportRefs = reports.filter((report) => text(report.data.targetId) === businessId || text(report.data.parentId) === businessId)
  const targetBusinessIds = new Set([businessId])
  const mixedConversation = conversationRefs.some((conversation) => relationHasExternalOrProtected(conversation.data, targetSet, protectedSet, targetBusinessIds))
  const mixedReport = reportRefs.some((report) => relationHasExternalOrProtected(report.data, targetSet, protectedSet, targetBusinessIds))
  const privateExists = hasPrivateForBusiness(privateDocs, businessId)

  let classification
  const reasons = []
  if (ownedByProtected || protectedReference || referencedByProtectedUser) {
    classification = CLASSIFICATIONS.PROTECTED
    reasons.push('protected-account-reference')
  } else if (!ownedByTarget) {
    classification = CLASSIFICATIONS.PROTECTED
    reasons.push('external-or-unknown-owner')
  } else if (externalManagers.length || referencedByExternalUser || mixedConversation || mixedReport) {
    classification = CLASSIFICATIONS.MANUAL
    reasons.push('external-reference-or-mixed-relationship')
  } else {
    classification = CLASSIFICATIONS.SAFE
    reasons.push('target-owned-without-protected-or-external-reference')
  }

  return {
    classification,
    conversationRefCount: conversationRefs.length,
    hasPrivateDocument: privateExists,
    managerReferences: [...managerReferences].sort(),
    manualReviewRequired: classification !== CLASSIFICATIONS.SAFE,
    ownerId,
    path: business.path,
    privateDocumentCount: privateExists ? 1 : 0,
    reasons,
    reportRefCount: reportRefs.length,
  }
}

function relationHasExternalOrProtected(data, targetSet, protectedSet, targetBusinessIds = new Set()) {
  const ids = [
    text(data.businessId),
    text(data.customerId),
    text(data.reporterId),
    text(data.targetId),
    ...array(data.participantIds).filter((item) => typeof item === 'string'),
    ...Object.keys(data.participantState ?? {}),
  ].filter(Boolean)
  return ids.some((id) => protectedSet.has(id) || (!targetSet.has(id) && !targetBusinessIds.has(id) && !id.startsWith('businesses/')))
}

function classifyRelationship(document, targetSet, protectedSet, targetBusinessIds) {
  const ids = [
    text(document.data.businessId),
    text(document.data.customerId),
    text(document.data.reporterId),
    text(document.data.targetId),
    text(document.data.parentId),
    ...array(document.data.participantIds).filter((item) => typeof item === 'string'),
    ...Object.keys(document.data.participantState ?? {}),
  ].filter(Boolean)
  const hasTargetUser = ids.some((id) => targetSet.has(id))
  const hasProtectedUser = ids.some((id) => protectedSet.has(id))
  const hasTargetBusiness = ids.some((id) => targetBusinessIds.has(id))
  const hasExternal = ids.some((id) => !targetSet.has(id) && !protectedSet.has(id) && !targetBusinessIds.has(id))

  if (!hasTargetUser && !hasTargetBusiness && !hasProtectedUser) return { classification: CLASSIFICATIONS.PROTECTED, related: false, reason: 'not-related-to-target' }
  if (hasProtectedUser) return { classification: CLASSIFICATIONS.PROTECTED, related: true, reason: 'protected-participant-or-reference' }
  if (hasExternal) return { classification: CLASSIFICATIONS.MANUAL, related: true, reason: 'mixed-or-ambiguous-reference' }
  return { classification: CLASSIFICATIONS.SAFE, related: true, reason: 'target-only-reference' }
}

function classifyPrivateDoc(document, targetSet, protectedSet, targetBusinessIds, protectedBusinessIds) {
  const ownerId = text(document.data.ownerId)
  const managerIds = array(document.data.managerIds).filter((item) => typeof item === 'string')
  const businessId = document.id
  if (protectedBusinessIds.has(businessId) || protectedSet.has(ownerId) || managerIds.some((uid) => protectedSet.has(uid))) {
    return { classification: CLASSIFICATIONS.PROTECTED, reason: 'protected-private-reference' }
  }
  if (!targetBusinessIds.has(businessId) && !targetSet.has(ownerId)) {
    return { classification: CLASSIFICATIONS.PROTECTED, reason: 'not-target-associated' }
  }
  if (!targetSet.has(ownerId) || managerIds.some((uid) => !targetSet.has(uid))) {
    return { classification: CLASSIFICATIONS.MANUAL, reason: 'ownership-or-manager-ambiguity' }
  }
  return { classification: CLASSIFICATIONS.SAFE, reason: 'target-private-record' }
}

async function listAll(source, collection, pageSize) {
  const docs = []
  let cursor = null
  for (;;) {
    const page = await source.listCollection(collection, { pageSize, cursor })
    docs.push(...page.docs)
    cursor = page.cursor
    if (page.done) break
  }
  return docs
}

export async function runTestCleanupAudit(source, options, now = () => new Date().toISOString()) {
  const targetSet = new Set(options.targetUids)
  const protectedSet = new Set(options.protectedUids)
  const startedAt = now()
  const authTargets = []
  const authProtected = []
  for (const uid of options.targetUids) authTargets.push(await source.getAuthAccount(uid))
  for (const uid of options.protectedUids) authProtected.push(await source.getAuthAccount(uid))

  const docs = {}
  for (const collection of COLLECTIONS) docs[collection] = await listAll(source, collection, options.pageSize)
  const usersById = new Map(docs.users.map((document) => [document.id, document]))
  const targetUserDocs = options.targetUids.map((uid) => usersById.get(uid) ?? { id: uid, path: `users/${uid}`, data: null, exists: false })
  const protectedUserDocs = options.protectedUids.map((uid) => usersById.get(uid)).filter(Boolean)

  const targetBusinessIds = new Set()
  for (const business of docs.businesses) {
    if (targetSet.has(text(business.data.ownerId))) targetBusinessIds.add(business.id)
  }
  for (const user of targetUserDocs) {
    const pointer = text(user.data?.businessId)
    if (pointer) targetBusinessIds.add(pointer)
  }
  const protectedBusinessIds = new Set(docs.businesses.filter((business) => protectedSet.has(text(business.data.ownerId))).map((business) => business.id))

  const mediaByFingerprint = new Map()
  const businessAnalyses = docs.businesses.map((business) => {
    const analysis = classifyBusiness({
      allUsers: docs.users,
      business,
      conversations: docs.conversations,
      privateDocs: docs.businessPrivate,
      protectedSet,
      reports: docs.reports,
      targetSet,
    })
    const media = collectMediaReferences(business)
    for (const reference of media) {
      if (!mediaByFingerprint.has(reference.fingerprint)) mediaByFingerprint.set(reference.fingerprint, [])
      mediaByFingerprint.get(reference.fingerprint).push({ businessId: business.id, ownerId: analysis.ownerId })
    }
    return { ...analysis, id: business.id, media }
  })

  const businessItems = businessAnalyses
    .filter((business) => targetBusinessIds.has(business.id) || protectedBusinessIds.has(business.id))
    .map((business) => ({
      classification: business.classification,
      conversationRefCount: business.conversationRefCount,
      documentId: business.id,
      hasPrivateDocument: business.hasPrivateDocument,
      managerReferenceCount: business.managerReferences.length,
      manualReviewRequired: business.manualReviewRequired,
      mediaReferenceCount: business.media.length,
      ownerId: business.ownerId,
      path: business.path,
      reasons: business.reasons,
      reportRefCount: business.reportRefCount,
    }))

  const mediaItems = []
  for (const business of businessAnalyses.filter((item) => targetBusinessIds.has(item.id) || protectedBusinessIds.has(item.id))) {
    for (const reference of business.media) {
      const usages = mediaByFingerprint.get(reference.fingerprint) ?? []
      const sharedWithExternal = usages.some((usage) => usage.businessId !== business.id && !targetSet.has(usage.ownerId))
      const sharedWithProtected = usages.some((usage) => protectedSet.has(usage.ownerId))
      let classification = business.classification
      const reasons = []
      if (sharedWithProtected) {
        classification = CLASSIFICATIONS.PROTECTED
        reasons.push('shared-with-protected-business')
      } else if (sharedWithExternal) {
        classification = CLASSIFICATIONS.MANUAL
        reasons.push('shared-with-external-business')
      } else if (business.classification === CLASSIFICATIONS.SAFE) {
        reasons.push('target-owned-media-reference')
      } else reasons.push('inherits-business-classification')
      mediaItems.push({
        businessPath: business.path,
        classification,
        field: reference.field,
        fingerprint: reference.kind === 'legacy-url' ? reference.fingerprint : undefined,
        kind: reference.kind,
        path: reference.kind === 'storage-path' ? reference.path : undefined,
        reasons,
        storageExistence: 'not-checked',
        type: reference.type,
      })
    }
  }

  const privateItems = docs.businessPrivate
    .filter((document) => targetBusinessIds.has(document.id) || protectedBusinessIds.has(document.id) || targetSet.has(text(document.data.ownerId)) || protectedSet.has(text(document.data.ownerId)))
    .map((document) => {
      const result = classifyPrivateDoc(document, targetSet, protectedSet, targetBusinessIds, protectedBusinessIds)
      return {
        classification: result.classification,
        ownerId: text(document.data.ownerId),
        path: document.path,
        reason: result.reason,
      }
    })

  const conversationItems = docs.conversations.map((document) => ({ document, result: classifyRelationship(document, targetSet, protectedSet, targetBusinessIds) }))
    .filter(({ result }) => result.related)
    .map(({ document, result }) => ({
      classification: result.classification,
      path: document.path,
      reason: result.reason,
    }))
  const reportItems = docs.reports.map((document) => ({ document, result: classifyRelationship(document, targetSet, protectedSet, targetBusinessIds) }))
    .filter(({ result }) => result.related)
    .map(({ document, result }) => ({
      classification: result.classification,
      path: document.path,
      reason: result.reason,
    }))

  const userItems = [
    ...targetUserDocs.map((document) => ({
      accountStatus: text(document.data?.accountStatus),
      businessId: text(document.data?.businessId),
      classification: document.data ? CLASSIFICATIONS.SAFE : CLASSIFICATIONS.AMBIGUOUS,
      exists: Boolean(document.data),
      path: document.path,
      roles: array(document.data?.roles).filter((item) => typeof item === 'string').sort(),
      uid: document.id,
    })),
    ...protectedUserDocs.map((document) => ({
      accountStatus: text(document.data.accountStatus),
      businessId: text(document.data.businessId),
      classification: CLASSIFICATIONS.PROTECTED,
      exists: true,
      path: document.path,
      roles: array(document.data.roles).filter((item) => typeof item === 'string').sort(),
      uid: document.id,
    })),
  ]

  const authItems = [
    ...authTargets.map((account) => ({ ...account, classification: account.exists ? CLASSIFICATIONS.SAFE : CLASSIFICATIONS.AMBIGUOUS })),
    ...authProtected.map((account) => ({ ...account, classification: CLASSIFICATIONS.PROTECTED })),
  ]

  const ownerMappings = docs.businessOwners
    .filter((document) => targetSet.has(document.id) || protectedSet.has(document.id) || targetSet.has(text(document.data.ownerId)) || protectedSet.has(text(document.data.ownerId)))
    .map((document) => ({
      businessId: text(document.data.businessId),
      classification: protectedSet.has(document.id) || protectedSet.has(text(document.data.ownerId)) ? CLASSIFICATIONS.PROTECTED : CLASSIFICATIONS.SAFE,
      ownerId: text(document.data.ownerId) || document.id,
      path: document.path,
    }))

  const targetSummaries = options.targetUids.map((uid, index) => {
    const ownedBusinessIds = businessAnalyses.filter((business) => business.ownerId === uid).map((business) => business.id)
    const ownedBusinessIdSet = new Set(ownedBusinessIds)
    return {
      label: `Test Account ${index + 1}`,
      authExists: authTargets.find((account) => account.uid === uid)?.exists ?? false,
      businessCount: ownedBusinessIds.length,
      conversationReferenceCount: conversationItems.filter((item) => hasAnyReference(docs.conversations.find((document) => document.path === item.path)?.data, new Set([uid, ...ownedBusinessIds]))).length,
      mediaReferenceCount: mediaItems.filter((item) => ownedBusinessIdSet.has(item.businessPath.split('/')[1])).length,
      privateDocumentCount: privateItems.filter((item) => ownedBusinessIdSet.has(item.path.split('/')[1]) || item.ownerId === uid).length,
      reportReferenceCount: reportItems.filter((item) => hasAnyReference(docs.reports.find((document) => document.path === item.path)?.data, new Set([uid, ...ownedBusinessIds]))).length,
      userDocumentExists: Boolean(usersById.get(uid)),
    }
  })

  const items = {
    authAccounts: authItems,
    userDocuments: userItems,
    businesses: businessItems,
    businessPrivate: privateItems,
    conversations: conversationItems,
    reports: reportItems,
    mediaReferences: mediaItems,
    businessOwners: ownerMappings,
  }

  return {
    metadata: {
      complete: true,
      finishedAt: now(),
      projectId: options.projectId,
      readOnly: true,
      reportSchemaVersion: 'phase-1b-test-cleanup-dry-run-v1',
      startedAt,
      storageObjectChecks: false,
      tool: 'test-data-cleanup-readonly',
    },
    counts: {
      collections: Object.fromEntries(COLLECTIONS.map((collection) => [collection, docs[collection].length])),
      protectedAccounts: options.protectedUids.length,
      targetAccounts: options.targetUids.length,
    },
    targetSummaries,
    protectedSummary: {
      authAccounts: authProtected.filter((account) => account.exists).length,
      businesses: businessItems.filter((item) => item.classification === CLASSIFICATIONS.PROTECTED).length,
      businessPrivate: privateItems.filter((item) => item.classification === CLASSIFICATIONS.PROTECTED).length,
      userDocuments: protectedUserDocs.length,
    },
    classificationCounts: summarizeClassifications(items),
    items,
    blockingFindings: collectBlockingFindings(items),
  }
}

function summarizeClassifications(items) {
  const result = {}
  for (const [type, values] of Object.entries(items)) {
    result[type] = {}
    for (const classification of Object.values(CLASSIFICATIONS)) result[type][classification] = 0
    for (const item of values) result[type][item.classification] = (result[type][item.classification] ?? 0) + 1
  }
  return result
}

function collectBlockingFindings(items) {
  const findings = []
  for (const [type, values] of Object.entries(items)) {
    for (const item of values) {
      if (item.classification === CLASSIFICATIONS.MANUAL || item.classification === CLASSIFICATIONS.AMBIGUOUS) {
        findings.push({ classification: item.classification, path: item.path ?? item.businessPath ?? item.uid, reason: item.reason ?? item.reasons?.join(',') ?? 'manual-review-required', type })
      }
    }
  }
  return findings.sort((a, b) => `${a.type}:${a.path}`.localeCompare(`${b.type}:${b.path}`))
}
