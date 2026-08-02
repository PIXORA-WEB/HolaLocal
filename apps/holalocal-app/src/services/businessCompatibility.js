import {
  ISSUE_CODES,
  adaptBusinessDocument,
  ambiguousBusinesses,
  businessNotFound,
  foundBusiness,
  invalidMapping,
  ownerMismatch,
  resolveBusinessEntitlements,
} from '@holalocal/firebase-contract'
import { CANONICAL_BUSINESS_CATEGORIES, computeBusinessProfileCompleted } from './businessPayloads.js'

const SOURCE_PRIORITY = ['user_business_id', 'owner_uid_document', 'owner_id_query']
const BUSINESS_STATUSES = new Set(['draft', 'pending_review', 'rejected', 'active', 'suspended', 'archived', 'deleted'])
const VERIFICATION_STATUSES = new Set(['unverified', 'pending', 'verified', 'rejected'])
const CONTACT_KEYS = new Set([
  'phone', 'phoneVisible', 'email', 'emailVisible', 'whatsappNumber',
  'whatsappVisible', 'website', 'websiteVisible', 'preferredContactMethod', 'allowCallbackRequests',
])

function isRuleSafeContact(contact) {
  if (!contact || typeof contact !== 'object' || Array.isArray(contact)) return false
  if (Object.keys(contact).some((field) => !CONTACT_KEYS.has(field))) return false
  if (!['phoneVisible', 'emailVisible', 'whatsappVisible', 'websiteVisible', 'allowCallbackRequests']
    .every((field) => typeof contact[field] === 'boolean')) return false
  if (!['phone', 'email', 'whatsappNumber', 'website']
    .every((field) => typeof contact[field] === 'string')) return false
  if (!['holalocal', 'phone', 'email', 'whatsapp'].includes(contact.preferredContactMethod)) return false
  return (contact.phoneVisible || contact.phone === '')
    && (contact.emailVisible || contact.email === '')
    && (contact.whatsappVisible || contact.whatsappNumber === '')
    && (contact.websiteVisible || contact.website === '')
}

function hasLegacyTopLevelContact(raw) {
  return ['phone', 'email', 'whatsapp', 'whatsappNumber', 'website']
    .some((field) => typeof raw?.[field] === 'string' && raw[field].trim())
}

function hasUnsupportedCustomValues(values) {
  return values.some(({ id, isCustom, source }) => isCustom && source !== id)
}

function hasSupportedEditableTaxonomy(business) {
  return CANONICAL_BUSINESS_CATEGORIES.includes(business.primaryCategoryId)
    && business.categoryIds.length > 0
    && business.categoryIds.every((category) => CANONICAL_BUSINESS_CATEGORIES.includes(category))
    && business.languages.length > 0
    && business.primaryLanguage
    && business.languages.includes(business.primaryLanguage)
    && !hasUnsupportedCustomValues(business.languageValues)
    && business.serviceAreas.length > 0
    && !hasUnsupportedCustomValues(business.serviceAreaValues)
}

function hasRuleSafeOwnerRelationship(business, raw) {
  return Boolean(
    business.ownerId
    && Array.isArray(raw.managerIds)
    && raw.managerIds.includes(business.ownerId),
  )
}

export function toMobileManagedBusiness(documentId, rawDocument, privateDocument = null) {
  const adapted = adaptBusinessDocument(documentId, rawDocument)
  const raw = rawDocument && typeof rawDocument === 'object' && !Array.isArray(rawDocument)
    ? rawDocument : {}
  const business = adapted.business
  const entitlements = resolveBusinessEntitlements(rawDocument?.subscription)
  const languageValues = business.languageValues.map((value) => ({
    ...value,
    label: value.isCustom && typeof raw.languageLabels?.[value.id] === 'string'
      ? raw.languageLabels[value.id] : value.label,
  }))
  const serviceAreaValues = business.serviceAreaValues.map((value) => ({
    ...value,
    label: value.isCustom && typeof raw.customServiceAreas?.[value.id] === 'string'
      ? raw.customServiceAreas[value.id] : value.label,
  }))
  const shapeSupported = Boolean(
    hasRuleSafeOwnerRelationship(business, raw)
    && BUSINESS_STATUSES.has(raw.status)
    && VERIFICATION_STATUSES.has(raw.verificationStatus)
    && isRuleSafeContact(raw.contact)
    && !hasLegacyTopLevelContact(raw)
    && hasSupportedEditableTaxonomy({ ...business, languageValues, serviceAreaValues })
  )

  return {
    ...business,
    entitlements,
    businessId: documentId,
    ownerId: business.ownerId,
    languageValues,
    serviceAreaValues,
    serviceRadiusKm: typeof raw.serviceRadiusKm === 'number' ? raw.serviceRadiusKm : 20,
    legacyMedia: Object.freeze({
      logoURL: adapted.legacy.logoURL,
      coverImageURL: adapted.legacy.coverImageURL,
      galleryImageURLs: Object.freeze([...(adapted.legacy.galleryImageURLs ?? [])]),
    }),
    logoUrl: business.profilePhoto?.downloadUrl ?? adapted.legacy.logoURL ?? null,
    coverImageUrl: business.coverPhoto?.downloadUrl ?? adapted.legacy.coverImageURL ?? null,
    legacyPrivateContact: adapted.legacy.contactCandidate,
    privateContact: privateDocument?.contact ?? null,
    profileCompleted: computeBusinessProfileCompleted({
      ...business,
      languages: [...business.languages],
      serviceAreas: [...business.serviceAreas],
      categoryIds: [...business.categoryIds],
    }),
    editSupport: Object.freeze({
      supported: shapeSupported,
      reason: shapeSupported ? null : 'unsupported_legacy_shape',
      contactEditable: false,
      mediaEditable: false,
    }),
    compatibility: Object.freeze({
      issues: Object.freeze(adapted.issues.map(({ code }) => code)),
      writeSafe: false,
    }),
  }
}

export function toMobilePublicBusiness(documentId, rawDocument) {
  const adapted = adaptBusinessDocument(documentId, rawDocument)
  const business = adapted.business
  if (business.status !== 'active') return null
  const entitlements = resolveBusinessEntitlements(rawDocument?.subscription)
  const contact = business.contact && typeof business.contact === 'object' ? business.contact : {}
  return {
    businessId: documentId,
    name: business.name,
    primaryCategoryId: business.primaryCategoryId,
    categoryIds: [...business.categoryIds],
    serviceAreas: [...business.serviceAreas],
    languages: [...business.languages],
    primaryLanguage: business.primaryLanguage,
    location: { ...business.location },
    contact: {
      phone: contact.phoneVisible === true ? contact.phone ?? '' : '',
      phoneVisible: contact.phoneVisible === true,
      email: contact.emailVisible === true ? contact.email ?? '' : '',
      emailVisible: contact.emailVisible === true,
      whatsappNumber: contact.whatsappVisible === true ? contact.whatsappNumber ?? '' : '',
      whatsappVisible: contact.whatsappVisible === true,
      website: contact.websiteVisible === true ? contact.website ?? '' : '',
      websiteVisible: contact.websiteVisible === true,
      preferredContactMethod: contact.preferredContactMethod ?? 'holalocal',
      allowCallbackRequests: contact.allowCallbackRequests === true,
    },
    status: business.status,
    verificationStatus: business.verificationStatus,
    subscriptionTier: entitlements.effectivePlanId ?? 'early_access',
    subscriptionStatus: entitlements.accessStatus ?? 'active',
    profilePhoto: business.profilePhoto,
  }
}

function observation(candidate, source) {
  if (!candidate || typeof candidate !== 'object') return null
  const businessId = typeof candidate.businessId === 'string' ? candidate.businessId.trim() : ''
  const ownerId = typeof candidate.ownerId === 'string' ? candidate.ownerId.trim() : ''
  return businessId && ownerId
    ? { businessId, ownerId, source, document: candidate.document }
    : null
}

export function resolveMobileBusinessLookup({
  ownerId, pointerCandidate = null, uidCandidate = null, ownerCandidates = [],
  pointerInvalid = false, uidInvalid = false,
} = {}) {
  if (typeof ownerId !== 'string' || !ownerId.trim()) return { lookup: invalidMapping(), document: null }
  const expectedOwnerId = ownerId.trim()
  const valid = new Map()
  const warnings = []
  let mismatch = null
  const observe = (candidate, source) => {
    const value = observation(candidate, source)
    if (!value) return
    if (value.ownerId !== expectedOwnerId) {
      mismatch ??= ownerMismatch({
        businessId: value.businessId, expectedOwnerId, actualOwnerId: value.ownerId,
      })
      warnings.push(ISSUE_CODES.LOOKUP_MAPPING_OWNER_MISMATCH)
      return
    }
    const existing = valid.get(value.businessId)
    if (!existing || SOURCE_PRIORITY.indexOf(source) < SOURCE_PRIORITY.indexOf(existing.source)) {
      valid.set(value.businessId, value)
    }
  }
  observe(pointerCandidate, 'user_business_id')
  observe(uidCandidate, 'owner_uid_document')
  for (const candidate of Array.isArray(ownerCandidates) ? ownerCandidates : []) {
    observe(candidate, 'owner_id_query')
  }
  if (pointerInvalid || uidInvalid) warnings.push(ISSUE_CODES.LOOKUP_INVALID_MAPPING)
  const candidates = [...valid.values()].sort((a, b) => a.businessId.localeCompare(b.businessId))
  if (candidates.length > 1) {
    return { lookup: ambiguousBusinesses(candidates.map(({ businessId }) => businessId), warnings), document: null }
  }
  if (candidates.length === 1) {
    const candidate = candidates[0]
    return {
      lookup: foundBusiness({
        businessId: candidate.businessId, ownerId: expectedOwnerId,
        source: candidate.source, warnings,
      }),
      document: candidate.document,
    }
  }
  if (mismatch) return { lookup: mismatch, document: null }
  if (pointerInvalid || uidInvalid) return { lookup: invalidMapping(warnings), document: null }
  return { lookup: businessNotFound(warnings), document: null }
}
