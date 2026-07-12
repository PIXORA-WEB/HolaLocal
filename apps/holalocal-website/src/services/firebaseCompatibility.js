import {
  ISSUE_CODES,
  adaptBusinessDocument,
  adaptUserDocument,
  ambiguousBusinesses,
  businessNotFound,
  foundBusiness,
  invalidMapping,
  isCustomIdentifier,
  ownerMismatch,
  projectPublicContact,
} from '@holalocal/firebase-contract'

const ACCOUNT_TYPES = new Set(['customer', 'business', 'both'])
const SOURCE_PRIORITY = [
  'user_business_id',
  'owner_uid_document',
  'owner_id_query',
]

function accountTypeForRoles(roles) {
  if (roles.includes('customer') && roles.includes('business')) return 'both'
  return roles.includes('business') ? 'business' : 'customer'
}

function displayCompatibilityValues(values, namespace) {
  return values.map((value) => isCustomIdentifier(value.id, namespace) ? value.label : value.id)
}

function compatibilityMetadata(adapted) {
  return Object.freeze({
    issues: Object.freeze(adapted.issues.map(({ code, ...details }) => Object.freeze({ code, ...details }))),
    writeSafe: false,
  })
}

export function toWebsiteUserProfile(documentId, rawDocument) {
  const adapted = adaptUserDocument(documentId, rawDocument)
  const { profile } = adapted
  const raw = rawDocument && typeof rawDocument === 'object' && !Array.isArray(rawDocument)
    ? rawDocument : {}

  return {
    uid: profile.uid,
    documentId,
    email: profile.email,
    emailVerified: profile.emailVerified,
    displayName: profile.displayName,
    displayNameNormalized: typeof raw.displayNameNormalized === 'string' ? raw.displayNameNormalized : '',
    firstName: profile.firstName,
    lastName: profile.lastName,
    photoURL: profile.photoURL,
    profilePhoto: profile.profilePhoto,
    preferredLocale: profile.preferredLocale,
    accountType: ACCOUNT_TYPES.has(raw.accountType) ? raw.accountType : accountTypeForRoles(profile.roles),
    roles: [...profile.roles],
    city: typeof raw.city === 'string' ? raw.city : '',
    country: typeof raw.country === 'string' ? raw.country : '',
    accountStatus: profile.accountStatus,
    profileCompleted: profile.completion.profileCompleted,
    onboardingCompleted: profile.completion.onboardingCompleted,
    businessProfileRequired: profile.completion.businessProfileRequired,
    businessProfileCompleted: profile.completion.businessProfileCompleted,
    businessId: profile.businessId,
    termsAccepted: profile.consent.termsAccepted,
    termsAcceptedAt: profile.consent.termsAcceptedAt,
    termsVersion: profile.consent.termsVersion,
    privacyAccepted: profile.consent.privacyAccepted,
    privacyAcceptedAt: profile.consent.privacyAcceptedAt,
    privacyVersion: profile.consent.privacyVersion,
    deletionRequestedAt: raw.deletionRequestedAt ?? null,
    deletionScheduledFor: raw.deletionScheduledFor ?? null,
    anonymizedAt: raw.anonymizedAt ?? null,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    lastActiveAt: raw.lastActiveAt ?? null,
    compatibility: compatibilityMetadata(adapted),
  }
}

function privateContactForManagedView(adapted, privateDocument) {
  if (privateDocument?.contact && typeof privateDocument.contact === 'object') {
    return privateDocument.contact
  }
  if (adapted.business.contact) return adapted.business.contact
  return adapted.legacy.contactCandidate
    ? {
        ...adapted.legacy.contactCandidate,
        // Existing website writes expose website without a visibility toggle.
        // Do not feed an unaudited legacy website value into that form path.
        website: '',
        phoneVisible: false,
        emailVisible: false,
        whatsappVisible: false,
        websiteVisible: false,
        preferredContactMethod: 'holalocal',
        allowCallbackRequests: false,
      }
    : null
}

export function toManagedBusinessView(documentId, rawDocument, privateDocument = null) {
  const adapted = adaptBusinessDocument(documentId, rawDocument)
  const { business, legacy } = adapted

  return {
    ...business,
    businessId: documentId,
    ownerId: business.ownerId,
    serviceAreas: displayCompatibilityValues(business.serviceAreaValues, 'area'),
    languages: displayCompatibilityValues(business.languageValues, 'language'),
    primaryLanguage: business.languageValues.find(({ id }) => id === business.primaryLanguage)?.isCustom
      ? business.languageValues.find(({ id }) => id === business.primaryLanguage)?.label
      : business.primaryLanguage,
    contact: privateContactForManagedView(adapted, privateDocument),
    legacyPrivateContact: adapted.legacy.contactCandidate,
    logoUrl: business.profilePhoto?.downloadUrl ?? legacy.logoURL ?? null,
    coverImageUrl: business.coverPhoto?.downloadUrl ?? legacy.coverImageURL ?? null,
    legacyMedia: Object.freeze({
      logoURL: legacy.logoURL,
      coverImageURL: legacy.coverImageURL,
      galleryImageURLs: Object.freeze([...(legacy.galleryImageURLs ?? [])]),
    }),
    compatibility: compatibilityMetadata(adapted),
  }
}

function publicContact(contact = {}) {
  return projectPublicContact(contact).contact
}

export function toPublicBusinessView(documentId, rawDocument) {
  const adapted = adaptBusinessDocument(documentId, rawDocument)
  const business = adapted.business
  if (business.status !== 'active') return null

  const languages = displayCompatibilityValues(business.languageValues, 'language')
  const serviceAreas = displayCompatibilityValues(business.serviceAreaValues, 'area')
  return {
    businessId: documentId,
    ownerId: business.ownerId,
    name: business.name,
    category: business.primaryCategoryId,
    serviceArea: business.location?.locality || serviceAreas[0] || '',
    serviceAreas,
    languages,
    primaryLanguage: business.languageValues.find(({ id }) => id === business.primaryLanguage)?.isCustom
      ? business.languageValues.find(({ id }) => id === business.primaryLanguage)?.label
      : business.primaryLanguage ?? languages[0] ?? '',
    description: business.description,
    tagline: business.tagline,
    services: [...business.categoryIds],
    galleryUrls: [...business.galleryImageURLs],
    contact: publicContact(business.contact),
    status: business.status,
    verificationStatus: business.verificationStatus ?? 'unverified',
    subscriptionTier: business.subscription?.tier ?? 'free',
    subscriptionStatus: business.subscription?.status ?? 'none',
    ratingAverage: typeof rawDocument?.ratingAverage === 'number' ? rawDocument.ratingAverage : null,
    ratingCount: typeof rawDocument?.ratingCount === 'number' ? rawDocument.ratingCount : 0,
    logoUrl: business.profilePhoto?.downloadUrl ?? null,
    profileComplete: business.profileCompleted === true,
    compatibility: compatibilityMetadata(adapted),
  }
}

function normalizeObservation(candidate, fallbackSource) {
  if (!candidate || typeof candidate !== 'object') return null
  const businessId = typeof candidate.businessId === 'string' ? candidate.businessId.trim() : ''
  const ownerId = typeof candidate.ownerId === 'string' ? candidate.ownerId.trim() : ''
  const source = fallbackSource
  return businessId && ownerId ? { businessId, ownerId, source, document: candidate.document } : null
}

export function resolveWebsiteBusinessLookup({
  ownerId,
  pointerCandidate = null,
  uidCandidate = null,
  ownerCandidates = [],
  pointerInvalid = false,
  uidInvalid = false,
} = {}) {
  if (typeof ownerId !== 'string' || !ownerId.trim()) return { lookup: invalidMapping(), document: null }
  const expectedOwnerId = ownerId.trim()
  const warnings = []
  const validCandidates = new Map()
  let mismatch = null

  const observe = (candidate, source) => {
    const normalized = normalizeObservation(candidate, source)
    if (!normalized) return
    if (normalized.ownerId !== expectedOwnerId) {
      mismatch ??= ownerMismatch({
        businessId: normalized.businessId,
        expectedOwnerId,
        actualOwnerId: normalized.ownerId,
      })
      warnings.push(ISSUE_CODES.LOOKUP_MAPPING_OWNER_MISMATCH)
      return
    }
    const existing = validCandidates.get(normalized.businessId)
    if (!existing || SOURCE_PRIORITY.indexOf(normalized.source) < SOURCE_PRIORITY.indexOf(existing.source)) {
      validCandidates.set(normalized.businessId, normalized)
    }
  }

  observe(pointerCandidate, 'user_business_id')
  observe(uidCandidate, 'owner_uid_document')
  for (const candidate of Array.isArray(ownerCandidates) ? ownerCandidates : []) {
    observe(candidate, 'owner_id_query')
  }
  if (pointerInvalid || uidInvalid) warnings.push(ISSUE_CODES.LOOKUP_INVALID_MAPPING)

  const candidates = [...validCandidates.values()].sort((first, second) =>
    first.businessId.localeCompare(second.businessId))
  if (candidates.length > 1) {
    return { lookup: ambiguousBusinesses(candidates.map(({ businessId }) => businessId), warnings), document: null }
  }
  if (candidates.length === 1) {
    const candidate = candidates[0]
    return {
      lookup: foundBusiness({
        businessId: candidate.businessId,
        ownerId: expectedOwnerId,
        source: candidate.source,
        warnings,
      }),
      document: candidate.document,
    }
  }
  if (mismatch) return { lookup: mismatch, document: null }
  if (pointerInvalid || uidInvalid) return { lookup: invalidMapping(warnings), document: null }
  return { lookup: businessNotFound(warnings), document: null }
}
