import {
  ACCOUNT_STATUSES,
  BUSINESS_STATUSES,
  ISSUE_CODES,
  SUBSCRIPTION_STATUSES,
  USER_ROLES,
  VERIFICATION_STATUSES,
  adaptBusinessDocument,
  adaptUserDocument,
  detectUnsafePublicContact,
  isCustomIdentifier,
  normalizeLanguage,
  normalizeLanguages,
  normalizeServiceAreas,
  projectPublicContact,
  validatePrimaryLanguage,
  validateRoles,
} from '@holalocal/firebase-contract'
import { safeErrorDetails } from './config.js'
import { AUDIT_ISSUE_CODES, AUDIT_ISSUE_METADATA, AUDIT_SCHEMA_VERSION, AUDIT_TOOL_VERSION, assertKnownAuditCode } from './issueCodes.js'

export const CANONICAL_BUSINESS_CATEGORIES = Object.freeze([
  'Cleaning', 'Plumbing', 'Electrical', 'Gardening', 'Painting & Decorating',
  'Building & Renovation', 'Handyman', 'Air Conditioning', 'Locksmith',
  'Pest Control', 'Pool Maintenance', 'Pet Services',
])

const COLLECTIONS = ['users', 'businesses', 'businessPrivate', 'conversations', 'reports']
const CONTACT_VALUE_FIELDS = ['phone', 'email', 'whatsapp', 'whatsappNumber', 'website']
const CONTACT_VISIBILITY_FIELDS = ['phoneVisible', 'emailVisible', 'whatsappVisible', 'websiteVisible']
const TRUST_USER_FIELDS = ['isVerified', 'isPremium', 'deletedAt']
const TRUST_BUSINESS_FIELDS = ['isActive', 'isVerified', 'isPremium', 'subscriptionTier']
const DERIVED_BUSINESS_FIELDS = ['profileCompleted', 'galleryCount', 'nameNormalized', 'slug', 'ratingAverage', 'ratingCount', 'publishedAt', 'verifiedAt']
const VALID_CONVERSATION_STATUSES = new Set(['active', 'archived', 'blocked'])
const VALID_REPORT_STATUSES = new Set(['open', 'reviewing', 'resolved', 'dismissed'])
const VALID_REPORT_PRIORITIES = new Set(['low', 'normal', 'high', 'urgent'])

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function redactStringPresence(value, marker = '__PRESENT__') {
  return typeof value === 'string' && value.trim() ? marker : value
}

function redactContactValues(contact) {
  if (!isRecord(contact)) return contact
  return Object.fromEntries(Object.entries(contact).map(([key, value]) => [
    key,
    CONTACT_VALUE_FIELDS.includes(key) ? redactStringPresence(value, '__CONTACT_VALUE_PRESENT__') : value,
  ]))
}

function redactMediaValue(value) {
  if (!isRecord(value)) return value
  return { ...value, downloadUrl: redactStringPresence(value.downloadUrl, '__URL_PRESENT__') }
}

function redactSensitiveDocumentData(collection, data) {
  if (!isRecord(data)) return {}
  const redacted = { ...data }
  if (collection === 'users') {
    redacted.email = redactStringPresence(redacted.email, 'present@example.invalid')
    redacted.displayName = redactStringPresence(redacted.displayName)
  }
  if (collection === 'businesses' || collection === 'businessPrivate') {
    redacted.contact = redactContactValues(redacted.contact)
    for (const field of CONTACT_VALUE_FIELDS) redacted[field] = redactStringPresence(redacted[field], '__CONTACT_VALUE_PRESENT__')
  }
  if (collection === 'businesses' || collection === 'users') {
    redacted.photoURL = redactStringPresence(redacted.photoURL, '__URL_PRESENT__')
    redacted.logoURL = redactStringPresence(redacted.logoURL, '__URL_PRESENT__')
    redacted.coverImageURL = redactStringPresence(redacted.coverImageURL, '__URL_PRESENT__')
    redacted.profilePhoto = redactMediaValue(redacted.profilePhoto)
    redacted.coverPhoto = redactMediaValue(redacted.coverPhoto)
    if (Array.isArray(redacted.galleryImages)) redacted.galleryImages = redacted.galleryImages.map(redactMediaValue)
    if (Array.isArray(redacted.galleryImageURLs)) redacted.galleryImageURLs = redacted.galleryImageURLs.map((value) => redactStringPresence(value, '__URL_PRESENT__'))
  }
  return redacted
}

function hasTimestampLike(value) {
  return Boolean(value && typeof value === 'object') || typeof value === 'string'
}

function sorted(values) {
  return [...values].sort((a, b) => String(a).localeCompare(String(b)))
}

function issueFingerprint(issue) {
  return [issue.code, issue.path, issue.field ?? '', issue.relatedPath ?? '', JSON.stringify(issue.relatedPaths ?? []), issue.detail ?? ''].join('|')
}

class AuditContext {
  constructor(options) {
    this.options = options
    this.docs = Object.fromEntries(COLLECTIONS.map((name) => [name, new Map()]))
    this.counts = { collections: Object.fromEntries(COLLECTIONS.map((name) => [name, 0])), reads: 0, storageReferenceChecks: 0 }
    this.issues = []
    this.errors = []
    this.relations = {
      userBusinessPointers: [],
      conversationBusinessRefs: [],
      reportTargetRefs: [],
      mediaRefs: [],
    }
    this.ownerBusinessIds = new Map()
    this.businessReferencedByUsers = new Map()
  }

  addIssue(code, path, extra = {}) {
    assertKnownAuditCode(code)
    const metadata = AUDIT_ISSUE_METADATA[code]
    this.issues.push({
      id: '',
      code,
      severity: metadata.severity,
      category: metadata.category,
      path,
      ...extra,
    })
  }
}

async function readCollections(source, context) {
  for (const collection of context.options.collectionScope) {
    let cursor = null
    try {
      for (;;) {
        const page = await source.listCollection(collection, {
          pageSize: context.options.pageSize,
          cursor,
        })
        context.counts.reads += page.docs.length
        for (const document of page.docs) {
          context.docs[collection].set(document.id, {
            id: document.id,
            path: document.path ?? `${collection}/${document.id}`,
            data: redactSensitiveDocumentData(collection, document.data ?? {}),
          })
        }
        cursor = page.cursor
        if (page.done) break
      }
    } catch (error) {
      context.errors.push(safeErrorDetails(error, { collection, check: 'listCollection', status: 'failed' }))
      context.addIssue(AUDIT_ISSUE_CODES.AUDIT_COLLECTION_READ_FAILED, collection, { detail: collection })
    } finally {
      context.counts.collections[collection] = context.docs[collection].size
    }
  }
}

function buildIndexes(context) {
  for (const user of context.docs.users.values()) {
    const businessId = text(user.data.businessId)
    if (!businessId) continue
    if (!context.businessReferencedByUsers.has(businessId)) context.businessReferencedByUsers.set(businessId, [])
    context.businessReferencedByUsers.get(businessId).push(user.id)
    context.relations.userBusinessPointers.push({ userPath: user.path, businessPath: `businesses/${businessId}` })
  }
  for (const business of context.docs.businesses.values()) {
    const ownerId = text(business.data.ownerId)
    if (!ownerId) continue
    if (!context.ownerBusinessIds.has(ownerId)) context.ownerBusinessIds.set(ownerId, [])
    context.ownerBusinessIds.get(ownerId).push(business.id)
  }
}

function auditUsers(context) {
  for (const user of context.docs.users.values()) {
    const data = isRecord(user.data) ? user.data : {}
    const adapted = adaptUserDocument(user.id, data)
    if (text(data.uid) && text(data.uid) !== user.id) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_USER_UID_MISMATCH, user.path, { field: 'uid' })
    for (const field of ['uid', 'email', 'roles', 'preferredLocale', 'accountStatus']) {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        context.addIssue(AUDIT_ISSUE_CODES.AUDIT_USER_REQUIRED_FIELD_MISSING, user.path, { field })
      }
    }
    const roles = Array.isArray(data.roles) ? data.roles : []
    const roleValidation = validateRoles(roles)
    if (!roleValidation.valid) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_USER_INVALID_ROLES, user.path, { field: 'roles' })
    if (new Set(roles).size !== roles.length) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_USER_DUPLICATE_ROLES, user.path, { field: 'roles' })
    if (roles.some((role) => !USER_ROLES.includes(role))) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_USER_PRIVILEGED_ROLE, user.path, { field: 'roles' })
    const expected = { customer: ['customer'], business: ['business'], both: ['customer', 'business'] }[data.accountType]
    if (expected && JSON.stringify(sorted(expected)) !== JSON.stringify(sorted(roles))) {
      context.addIssue(AUDIT_ISSUE_CODES.AUDIT_USER_ACCOUNT_TYPE_CONFLICT, user.path, { field: 'accountType' })
    }
    if (!ACCOUNT_STATUSES.includes(data.accountStatus)) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_USER_ACCOUNT_STATUS_INVALID, user.path, { field: 'accountStatus' })
    if (data.profileCompleted === true && (!text(data.displayName) || !text(data.preferredLocale))) {
      context.addIssue(AUDIT_ISSUE_CODES.AUDIT_USER_COMPLETION_CONFLICT, user.path, { field: 'profileCompleted' })
    }
    if (data.preferredLocale !== undefined && !normalizeLanguage(data.preferredLocale).value) {
      context.addIssue(AUDIT_ISSUE_CODES.AUDIT_USER_LOCALE_INVALID, user.path, { field: 'preferredLocale' })
    }
    if (data.preferredLanguage !== undefined) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_USER_LEGACY_LANGUAGE, user.path, { field: 'preferredLanguage' })
    if (adapted.issues.some(({ code }) => code === ISSUE_CODES.USER_CONFLICTING_LANGUAGE)) {
      context.addIssue(AUDIT_ISSUE_CODES.AUDIT_USER_LOCALE_INVALID, user.path, { field: 'preferredLocale' })
    }
    const hasBusinessRole = roles.includes('business')
    const businessId = text(data.businessId)
    if (hasBusinessRole && !businessId) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_USER_BUSINESS_POINTER_MISSING, user.path, { field: 'businessId' })
    if (!hasBusinessRole && businessId) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_USER_BUSINESS_POINTER_UNEXPECTED, user.path, { field: 'businessId', relatedPath: `businesses/${businessId}` })
    if (businessId) {
      const business = context.docs.businesses.get(businessId)
      if (!business) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_USER_BUSINESS_POINTER_INVALID, user.path, { field: 'businessId', relatedPath: `businesses/${businessId}` })
      else if (text(business.data.ownerId) !== user.id) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_USER_BUSINESS_POINTER_OWNER_MISMATCH, user.path, { field: 'businessId', relatedPath: business.path })
    }
    for (const field of TRUST_USER_FIELDS) {
      if (data[field] !== undefined) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_USER_LEGACY_TRUST_FIELD, user.path, { field })
    }
    if (data.termsAccepted !== true || data.privacyAccepted !== true || data.termsVersion !== '1.0' || data.privacyVersion !== '1.0') {
      context.addIssue(AUDIT_ISSUE_CODES.AUDIT_USER_CONSENT_INVALID, user.path, { field: 'consent' })
    }
    if (data.deletionRequestedAt && data.accountStatus === 'active') {
      context.addIssue(AUDIT_ISSUE_CODES.AUDIT_USER_DELETION_LIFECYCLE_INVALID, user.path, { field: 'deletionRequestedAt' })
    }
  }
}

function auditLanguageAndAreas(context, business) {
  const data = business.data
  const languages = normalizeLanguages(data.languages)
  if (languages.issues.some(({ code }) => code === ISSUE_CODES.LANGUAGE_UNKNOWN_CUSTOM)) {
    context.addIssue(AUDIT_ISSUE_CODES.AUDIT_LANGUAGE_UNKNOWN, business.path, { field: 'languages' })
  }
  for (const value of languages.values) {
    if (value.isCustom && isCustomIdentifier(value.id, 'language') && !text(data.languageLabels?.[value.id])) {
      context.addIssue(AUDIT_ISSUE_CODES.AUDIT_LANGUAGE_CUSTOM_LABEL_MISSING, business.path, { field: 'languageLabels' })
    }
  }
  if (!validatePrimaryLanguage(data.primaryLanguage, languages.identifiers).valid) {
    context.addIssue(AUDIT_ISSUE_CODES.AUDIT_PRIMARY_LANGUAGE_INVALID, business.path, { field: 'primaryLanguage' })
  }
  const areas = normalizeServiceAreas(data.serviceAreas)
  if (areas.issues.some(({ code }) => code === ISSUE_CODES.SERVICE_AREA_UNKNOWN_CUSTOM)) {
    context.addIssue(AUDIT_ISSUE_CODES.AUDIT_SERVICE_AREA_UNKNOWN, business.path, { field: 'serviceAreas' })
  }
  for (const value of areas.values) {
    if (value.isCustom && isCustomIdentifier(value.id, 'area') && !text(data.customServiceAreas?.[value.id])) {
      context.addIssue(AUDIT_ISSUE_CODES.AUDIT_SERVICE_AREA_CUSTOM_LABEL_MISSING, business.path, { field: 'customServiceAreas' })
    }
  }
  const categories = [data.primaryCategoryId, ...(Array.isArray(data.categoryIds) ? data.categoryIds : [])].filter(Boolean)
  for (const category of categories) {
    if (!CANONICAL_BUSINESS_CATEGORIES.includes(category)) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_CATEGORY_UNKNOWN, business.path, { field: 'categoryIds' })
  }
  if (data.mainCategory && data.primaryCategoryId && data.mainCategory !== data.primaryCategoryId) {
    context.addIssue(AUDIT_ISSUE_CODES.AUDIT_BUSINESS_CANONICAL_LEGACY_CONFLICT, business.path, { field: 'primaryCategoryId' })
  }
}

function auditContact(context, business) {
  const data = business.data
  const privateDocument = context.docs.businessPrivate.get(business.id)
  const contact = isRecord(data.contact) ? data.contact : null
  if (!privateDocument) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_BUSINESS_PRIVATE_MISSING, business.path, { relatedPath: `businessPrivate/${business.id}` })
  for (const field of CONTACT_VALUE_FIELDS) {
    if (text(data[field])) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_LEGACY_PUBLIC_CONTACT, business.path, { field })
  }
  if (!contact) {
    context.addIssue(AUDIT_ISSUE_CODES.AUDIT_CONTACT_UNKNOWN_STRUCTURE, business.path, { field: 'contact' })
    return
  }
  const unsafe = detectUnsafePublicContact(data)
  if (!unsafe.safe) {
    for (const issue of unsafe.issues) {
      context.addIssue(
        issue.code === ISSUE_CODES.CONTACT_HIDDEN_VALUE_PRESENT
          ? AUDIT_ISSUE_CODES.AUDIT_PUBLIC_CONTACT_VALUE_HIDDEN
          : AUDIT_ISSUE_CODES.AUDIT_CONTACT_UNKNOWN_STRUCTURE,
        business.path,
        { field: issue.field ?? 'contact' },
      )
    }
  }
  for (const field of CONTACT_VISIBILITY_FIELDS) {
    if (contact[field] !== undefined && typeof contact[field] !== 'boolean') {
      context.addIssue(AUDIT_ISSUE_CODES.AUDIT_PUBLIC_CONTACT_VISIBILITY_MISSING, business.path, { field })
    }
  }
  if (contact.websiteVisible !== undefined) {
    context.addIssue(AUDIT_ISSUE_CODES.AUDIT_CONTACT_WEBSITE_VISIBILITY_UNSUPPORTED_BY_RULES, business.path, { field: 'contact.websiteVisible' })
  }
  const projected = projectPublicContact(contact)
  if (projected.issues.some(({ code }) => code === ISSUE_CODES.CONTACT_PREFERRED_METHOD_NOT_PUBLIC || code === ISSUE_CODES.CONTACT_INVALID_PREFERRED_METHOD)) {
    context.addIssue(AUDIT_ISSUE_CODES.AUDIT_CONTACT_PREFERRED_METHOD_INVALID, business.path, { field: 'contact.preferredContactMethod' })
  }
  if (privateDocument) {
    const privateData = privateDocument.data
    if (text(privateData.ownerId) !== text(data.ownerId)) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_BUSINESS_PRIVATE_OWNER_MISMATCH, privateDocument.path, { relatedPath: business.path })
    if (JSON.stringify(sorted(privateData.managerIds ?? [])) !== JSON.stringify(sorted(data.managerIds ?? []))) {
      context.addIssue(AUDIT_ISSUE_CODES.AUDIT_BUSINESS_PRIVATE_MANAGERS_MISMATCH, privateDocument.path, { relatedPath: business.path })
    }
    if (!isRecord(privateData.contact)) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_BUSINESS_PRIVATE_CONTACT_INVALID, privateDocument.path, { field: 'contact' })
    for (const [valueField, visibleField] of [['phone', 'phoneVisible'], ['email', 'emailVisible'], ['whatsappNumber', 'whatsappVisible'], ['website', 'websiteVisible']]) {
      if (contact[visibleField] === true && text(contact[valueField]) && !text(privateData.contact?.[valueField])) {
        context.addIssue(AUDIT_ISSUE_CODES.AUDIT_PUBLIC_CONTACT_VALUE_WITHOUT_PRIVATE, business.path, { field: valueField, relatedPath: privateDocument.path })
      }
    }
  }
}

function mediaReferences(data, ownerPathPrefix) {
  const refs = []
  for (const [field, value] of [['profilePhoto', data.profilePhoto], ['coverPhoto', data.coverPhoto]]) {
    if (isRecord(value)) refs.push({ field, path: text(value.path), valid: Boolean(text(value.path) && text(value.downloadUrl)) })
  }
  if (Array.isArray(data.galleryImages)) {
    data.galleryImages.forEach((item, index) => {
      if (isRecord(item)) refs.push({ field: `galleryImages.${index}`, path: text(item.path), valid: Boolean(text(item.path) && text(item.downloadUrl)) })
    })
  }
  return refs.map((ref) => ({ ...ref, ownerPathPrefix }))
}

function auditMedia(context, doc) {
  const data = doc.data
  for (const field of ['photoURL', 'logoURL', 'coverImageURL', 'galleryImageURLs']) {
    if (data[field] !== undefined) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_MEDIA_LEGACY_URL_PRESENT, doc.path, { field })
  }
  const prefix = doc.path.startsWith('users/') ? `users/${doc.id}/` : `businesses/${doc.id}/`
  const refs = mediaReferences(data, prefix)
  const seen = new Set()
  for (const ref of refs) {
    if (!ref.valid) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_MEDIA_METADATA_INVALID, doc.path, { field: ref.field })
    if (ref.path && !ref.path.startsWith(prefix)) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_MEDIA_OWNER_PATH_MISMATCH, doc.path, { field: ref.field })
    if (ref.path && seen.has(ref.path)) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_MEDIA_DUPLICATE_REFERENCE, doc.path, { field: ref.field })
    if (ref.path) {
      seen.add(ref.path)
      context.relations.mediaRefs.push({ documentPath: doc.path, field: ref.field, storagePath: ref.path })
    }
  }
  if (typeof data.galleryCount === 'number' && Array.isArray(data.galleryImages) && data.galleryCount !== data.galleryImages.length) {
    context.addIssue(AUDIT_ISSUE_CODES.AUDIT_GALLERY_COUNT_INCONSISTENT, doc.path, { field: 'galleryCount' })
  }
}

function auditBusinesses(context) {
  for (const business of context.docs.businesses.values()) {
    const data = isRecord(business.data) ? business.data : {}
    const adapted = adaptBusinessDocument(business.id, data)
    const ownerId = text(data.ownerId)
    if (ownerId && business.id === ownerId) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_BUSINESS_LEGACY_UID_ID, business.path)
    if (!ownerId) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_BUSINESS_OWNER_MISSING, business.path, { field: 'ownerId' })
    else if (!context.docs.users.has(ownerId)) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_BUSINESS_OWNER_USER_MISSING, business.path, { field: 'ownerId', relatedPath: `users/${ownerId}` })
    if (!Array.isArray(data.managerIds)) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_BUSINESS_MANAGER_IDS_INVALID, business.path, { field: 'managerIds' })
    else {
      if (new Set(data.managerIds).size !== data.managerIds.length) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_BUSINESS_MANAGER_IDS_DUPLICATE, business.path, { field: 'managerIds' })
      if (ownerId && !data.managerIds.includes(ownerId)) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_BUSINESS_OWNER_NOT_MANAGER, business.path, { field: 'managerIds' })
    }
    const users = context.businessReferencedByUsers.get(business.id) ?? []
    if (users.length > 1) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_BUSINESS_REFERENCED_BY_MULTIPLE_USERS, business.path)
    if (adapted.issues.some(({ code }) => code.startsWith('BUSINESS_CONFLICTING_'))) {
      context.addIssue(AUDIT_ISSUE_CODES.AUDIT_BUSINESS_CANONICAL_LEGACY_CONFLICT, business.path)
    }
    for (const field of TRUST_BUSINESS_FIELDS) {
      if (data[field] !== undefined) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_BUSINESS_LEGACY_TRUST_FIELD, business.path, { field })
    }
    if (!BUSINESS_STATUSES.includes(data.status)) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_BUSINESS_STATUS_INVALID, business.path, { field: 'status' })
    if (!VERIFICATION_STATUSES.includes(data.verificationStatus)) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_BUSINESS_VERIFICATION_STATUS_INVALID, business.path, { field: 'verificationStatus' })
    if (data.subscription && !SUBSCRIPTION_STATUSES.includes(data.subscription.status)) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_BUSINESS_SUBSCRIPTION_STATUS_INVALID, business.path, { field: 'subscription.status' })
    if (data.status === 'active' && !hasTimestampLike(data.publishedAt)) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_BUSINESS_PUBLICATION_TIMESTAMP_MISSING, business.path, { field: 'publishedAt' })
    if (data.verificationStatus === 'verified' && !hasTimestampLike(data.verifiedAt)) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_BUSINESS_VERIFICATION_TIMESTAMP_MISSING, business.path, { field: 'verifiedAt' })
    for (const field of ['createdAt', 'updatedAt']) {
      if (!hasTimestampLike(data[field])) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_BUSINESS_TIMESTAMP_MISSING, business.path, { field })
    }
    for (const field of DERIVED_BUSINESS_FIELDS) {
      if (data[field] !== undefined) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_BUSINESS_DERIVED_FIELD_PRESENT, business.path, { field, detail: 'owner-writable-under-current-rules-target-derived' })
    }
    auditLanguageAndAreas(context, business)
    auditContact(context, business)
    auditMedia(context, business)
  }
  for (const privateDocument of context.docs.businessPrivate.values()) {
    if (!context.docs.businesses.has(privateDocument.id)) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_BUSINESS_PRIVATE_ORPHAN, privateDocument.path, { relatedPath: `businesses/${privateDocument.id}` })
  }
}

function auditOwnershipGroups(context) {
  for (const user of context.docs.users.values()) {
    const roles = Array.isArray(user.data.roles) ? user.data.roles : []
    if (roles.includes('business') && !(context.ownerBusinessIds.get(user.id)?.length)) {
      context.addIssue(AUDIT_ISSUE_CODES.AUDIT_OWNER_BUSINESS_MISSING, user.path)
    }
  }
  for (const [ownerId, businessIds] of context.ownerBusinessIds.entries()) {
    const paths = sorted(businessIds).map((id) => `businesses/${id}`)
    if (businessIds.length === 1) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_OWNER_SINGLE_BUSINESS, `users/${ownerId}`, { relatedPath: paths[0] })
    if (businessIds.length > 1) {
      context.addIssue(AUDIT_ISSUE_CODES.AUDIT_OWNER_MULTIPLE_BUSINESSES, `users/${ownerId}`, { relatedPaths: paths })
      context.addIssue(AUDIT_ISSUE_CODES.AUDIT_DUPLICATE_MANUAL_REVIEW_REQUIRED, `users/${ownerId}`, { relatedPaths: paths })
    }
  }
}

function auditReferences(context) {
  for (const conversation of context.docs.conversations.values()) {
    const data = conversation.data
    const businessId = text(data.businessId)
    const participantIds = Array.isArray(data.participantIds) ? data.participantIds : []
    if (!businessId || !context.docs.businesses.has(businessId)) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_CONVERSATION_BUSINESS_MISSING, conversation.path, { field: 'businessId', relatedPath: businessId ? `businesses/${businessId}` : undefined })
    else if ((context.ownerBusinessIds.get(text(context.docs.businesses.get(businessId).data.ownerId)) ?? []).length > 1) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_CONVERSATION_DUPLICATE_BUSINESS_REFERENCE, conversation.path, { relatedPath: `businesses/${businessId}` })
    if (text(data.customerId) && !context.docs.users.has(text(data.customerId))) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_CONVERSATION_CUSTOMER_MISSING, conversation.path, { field: 'customerId' })
    if (!Array.isArray(data.participantIds) || participantIds.length < 2) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_CONVERSATION_PARTICIPANTS_INVALID, conversation.path, { field: 'participantIds' })
    for (const participant of participantIds) if (!context.docs.users.has(participant)) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_CONVERSATION_PARTICIPANT_MISSING, conversation.path, { field: 'participantIds', relatedPath: `users/${participant}` })
    const business = context.docs.businesses.get(businessId)
    if (business && !participantIds.includes(text(business.data.ownerId)) && !(business.data.managerIds ?? []).some((id) => participantIds.includes(id))) {
      context.addIssue(AUDIT_ISSUE_CODES.AUDIT_CONVERSATION_BUSINESS_PARTICIPANT_INVALID, conversation.path, { field: 'participantIds' })
    }
    if (!VALID_CONVERSATION_STATUSES.has(data.status)) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_CONVERSATION_STATUS_INVALID, conversation.path, { field: 'status' })
    if (businessId) context.relations.conversationBusinessRefs.push({ conversationPath: conversation.path, businessPath: `businesses/${businessId}` })
  }
  for (const report of context.docs.reports.values()) {
    const data = report.data
    if (data.targetType !== 'business') context.addIssue(AUDIT_ISSUE_CODES.AUDIT_REPORT_TARGET_TYPE_INVALID, report.path, { field: 'targetType' })
    const targetId = text(data.targetId)
    if (data.targetType === 'business' && (!targetId || !context.docs.businesses.has(targetId))) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_REPORT_TARGET_MISSING, report.path, { field: 'targetId', relatedPath: targetId ? `businesses/${targetId}` : undefined })
    if (text(data.reporterId) && !context.docs.users.has(text(data.reporterId))) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_REPORT_REPORTER_MISSING, report.path, { field: 'reporterId' })
    if (!VALID_REPORT_STATUSES.has(data.status)) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_REPORT_STATUS_INVALID, report.path, { field: 'status' })
    if (!VALID_REPORT_PRIORITIES.has(data.priority)) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_REPORT_PRIORITY_INVALID, report.path, { field: 'priority' })
    if (targetId) context.relations.reportTargetRefs.push({ reportPath: report.path, targetPath: `businesses/${targetId}` })
  }
}

async function auditStorage(context, source) {
  if (!context.options.checkStorage) return
  for (const ref of context.relations.mediaRefs) {
    context.counts.storageReferenceChecks += 1
    try {
      const exists = await source.storageObjectExists(ref.storagePath)
      if (!exists) context.addIssue(AUDIT_ISSUE_CODES.AUDIT_STORAGE_REFERENCE_MISSING, ref.documentPath, { field: ref.field })
    } catch {
      context.addIssue(AUDIT_ISSUE_CODES.AUDIT_STORAGE_REFERENCE_UNREADABLE, ref.documentPath, { field: ref.field })
    }
  }
}

function duplicateGroups(context) {
  return [...context.ownerBusinessIds.entries()]
    .filter(([, businessIds]) => businessIds.length > 1)
    .map(([ownerId, businessIds]) => {
      const candidates = sorted(businessIds).map((businessId) => {
        const business = context.docs.businesses.get(businessId)
        const rankingReasons = [
          BUSINESS_STATUSES.includes(business.data.status) && 'canonical-status-present',
          context.businessReferencedByUsers.has(businessId) && 'referenced-by-user-pointer',
          context.relations.conversationBusinessRefs.some((ref) => ref.businessPath === business.path) && 'referenced-by-conversation',
          context.relations.mediaRefs.some((ref) => ref.documentPath === business.path) && 'referenced-by-media-metadata',
        ].filter(Boolean)
        return {
          businessPath: business.path,
          idEqualsOwnerId: businessId === ownerId,
          referencedByUserPointers: sorted(context.businessReferencedByUsers.get(businessId) ?? []).map((id) => `users/${id}`),
          referencedByConversations: context.relations.conversationBusinessRefs.filter((ref) => ref.businessPath === business.path).map((ref) => ref.conversationPath).sort(),
          candidateRankingReasons: rankingReasons,
          nonBindingRankScore: rankingReasons.length,
        }
      })
      return {
        ownerPath: `users/${ownerId}`,
        candidateBusinessPaths: candidates.map(({ businessPath }) => businessPath),
        candidates: candidates.sort((a, b) => b.nonBindingRankScore - a.nonBindingRankScore || a.businessPath.localeCompare(b.businessPath)),
        recommendationStatus: 'manual-review-required',
      }
    }).sort((a, b) => a.ownerPath.localeCompare(b.ownerPath))
}

function finishReport(context, startedAt, finishedAt) {
  const issues = context.issues
    .map((issue) => ({ ...issue, id: issueFingerprint(issue) }))
    .sort((a, b) => a.id.localeCompare(b.id))
  const bySeverity = {}
  const byCategory = {}
  for (const issue of issues) {
    bySeverity[issue.severity] = (bySeverity[issue.severity] ?? 0) + 1
    byCategory[issue.category] = (byCategory[issue.category] ?? 0) + 1
  }
  const groups = duplicateGroups(context)
  const complete = context.errors.length === 0
  const ownerCounts = [...context.ownerBusinessIds.values()].map((businessIds) => businessIds.length)
  const businessUsers = [...context.docs.users.values()].filter((user) => Array.isArray(user.data.roles) && user.data.roles.includes('business'))
  const ownersWithZeroBusinesses = businessUsers.filter((user) => !(context.ownerBusinessIds.get(user.id)?.length)).length
  return {
    metadata: {
      auditSchemaVersion: AUDIT_SCHEMA_VERSION,
      reportSchemaVersion: AUDIT_SCHEMA_VERSION,
      toolVersion: AUDIT_TOOL_VERSION,
      sharedContractImport: '@holalocal/firebase-contract',
      projectId: context.options.projectId,
      readOnly: true,
      emulator: context.options.emulator,
      checkStorage: context.options.checkStorage,
      collections: context.options.collectionScope,
      pageSize: context.options.pageSize,
      startedAt,
      finishedAt,
      complete,
    },
    counts: context.counts,
    summary: {
      bySeverity,
      byCategory,
      ownership: {
        ownersWithZeroBusinesses,
        ownersWithOneBusiness: ownerCounts.filter((count) => count === 1).length,
        ownersWithMultipleBusinesses: ownerCounts.filter((count) => count > 1).length,
      },
      contactPrivacyIssues: issues.filter((issue) => issue.category === 'privacy').length,
      languageIssues: issues.filter((issue) => issue.category === 'language').length,
      manualReviewCount: issues.filter((issue) => issue.code.includes('MANUAL_REVIEW') || issue.code.includes('MULTIPLE')).length,
      migrationReadiness: !complete ? 'incomplete-audit-no-readiness-conclusion' : issues.some((issue) => issue.severity === 'error') ? 'blocked-by-errors' : issues.length ? 'manual-review-required' : 'ready-for-planning-review',
    },
    issues,
    duplicateBusinessGroups: groups,
    relationships: {
      userBusinessPointers: context.relations.userBusinessPointers.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      conversationBusinessRefs: context.relations.conversationBusinessRefs.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      reportTargetRefs: context.relations.reportTargetRefs.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      mediaRefs: context.relations.mediaRefs.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    },
    execution: {
      errors: context.errors,
      skippedChecks: context.options.checkStorage ? [] : ['storage-object-existence'],
      firestoreReadCostNote: 'The audit performs one document read per listed document plus optional reads for referenced Storage object metadata checks. Production cost depends on collection sizes.',
    },
  }
}

export async function runFirebaseAudit(source, options, clock = () => new Date().toISOString()) {
  const startedAt = clock()
  const context = new AuditContext(options)
  await readCollections(source, context)
  buildIndexes(context)
  auditUsers(context)
  auditBusinesses(context)
  auditOwnershipGroups(context)
  auditReferences(context)
  await auditStorage(context, source)
  return finishReport(context, startedAt, clock())
}

export function createFixtureSource(fixtures, storage = {}) {
  return {
    async listCollection(collectionName, { pageSize, cursor } = {}) {
      const docs = Object.entries(fixtures[collectionName] ?? {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, data]) => ({ id, path: `${collectionName}/${id}`, data }))
      const start = cursor ? docs.findIndex((doc) => doc.id === cursor) + 1 : 0
      if (storage.failCollection === collectionName && start >= (storage.failAfter ?? 0)) {
        throw new Error(storage.failMessage ?? 'fixture page failure')
      }
      const page = docs.slice(start, start + pageSize)
      return { docs: page, cursor: page.at(-1)?.id ?? null, done: start + pageSize >= docs.length }
    },
    async storageObjectExists(path) {
      if (storage.throwFor?.includes(path)) throw new Error('storage unavailable')
      return storage.existing?.includes(path) === true
    },
  }
}
