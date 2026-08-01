import { ACCOUNT_STATUSES, BUSINESS_STATUSES, SUBSCRIPTION_STATUSES, USER_ROLES, VERIFICATION_STATUSES } from './constants.js'
import { detectUnsafePublicContact } from './contact.js'
import { ISSUE_CODES, issue } from './issues.js'
import { normalizePrimaryLanguage, normalizeServiceAreas } from './normalization.js'
import { hasCompleteUserProfile } from './account.js'

function clone(value) {
  if (Array.isArray(value)) return value.map(clone)
  if (!value || typeof value !== 'object') return value
  const prototype = Object.getPrototypeOf(value)
  // Firestore Timestamp, GeoPoint and DocumentReference instances are immutable
  // compatibility values. Preserve them rather than erasing their prototypes.
  if (prototype !== Object.prototype && prototype !== null) return value
  return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [key, clone(nestedValue)]))
}

function string(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function sameValue(first, second) {
  return JSON.stringify(first) === JSON.stringify(second)
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const ACCOUNT_TYPE_ROLES = Object.freeze({ customer: ['customer'], business: ['business'], both: ['customer', 'business'] })

export function adaptUserDocument(documentId, rawDocument = {}) {
  const raw = isRecord(rawDocument) ? rawDocument : {}
  const issues = []
  if (!isRecord(rawDocument)) issues.push(issue(ISSUE_CODES.VALIDATION_INVALID_TYPE, { field: 'userDocument' }))
  const declaredRoles = Array.isArray(raw.roles) ? raw.roles.filter((role) => USER_ROLES.includes(role)) : []
  const accountTypeRoles = ACCOUNT_TYPE_ROLES[raw.accountType] ?? []
  const roles = declaredRoles.length ? [...new Set(declaredRoles)] : accountTypeRoles
  if (declaredRoles.length && accountTypeRoles.length && !sameValue([...declaredRoles].sort(), [...accountTypeRoles].sort())) {
    issues.push(issue(ISSUE_CODES.USER_CONFLICTING_ROLES))
  }
  if (Array.isArray(raw.roles) && declaredRoles.length !== raw.roles.length) {
    issues.push(issue(ISSUE_CODES.VALIDATION_INVALID_VALUE, { field: 'roles' }))
  }
  if (raw.accountType !== undefined && !accountTypeRoles.length) {
    issues.push(issue(ISSUE_CODES.VALIDATION_INVALID_VALUE, { field: 'accountType' }))
  }
  const languageSource = raw.preferredLocale ?? raw.preferredLanguage
  const language = normalizePrimaryLanguage(languageSource, languageSource === undefined ? [] : [languageSource])
  if (raw.preferredLocale === undefined && raw.preferredLanguage !== undefined) {
    issues.push(issue(ISSUE_CODES.USER_LEGACY_LANGUAGE))
  }
  if (raw.preferredLocale !== undefined && raw.preferredLanguage !== undefined) {
    const canonicalLanguage = normalizePrimaryLanguage(raw.preferredLocale, [raw.preferredLocale]).value
    const legacyLanguage = normalizePrimaryLanguage(raw.preferredLanguage, [raw.preferredLanguage]).value
    if (canonicalLanguage !== legacyLanguage) issues.push(issue(ISSUE_CODES.USER_CONFLICTING_LANGUAGE))
  }
  issues.push(...language.issues.filter(({ code }) => code !== ISSUE_CODES.LANGUAGE_PRIMARY_REPAIRED))
  if (raw.isVerified !== undefined) issues.push(issue(ISSUE_CODES.USER_AMBIGUOUS_VERIFICATION))
  if (raw.isPremium !== undefined) issues.push(issue(ISSUE_CODES.USER_LEGACY_PREMIUM_NOT_PROMOTED))
  if (raw.deletedAt !== undefined && raw.deletedAt !== null) issues.push(issue(ISSUE_CODES.USER_AMBIGUOUS_DELETION))
  for (const [field, missing] of [
    ['documentId', !string(documentId)],
    ['roles', roles.length === 0], ['preferredLocale', language.value === null],
    ['email', !string(raw.email)], ['accountStatus', !ACCOUNT_STATUSES.includes(raw.accountStatus)],
  ]) {
    if (missing) issues.push(issue(ISSUE_CODES.COMPATIBILITY_MISSING_REQUIRED_FIELD, { entity: 'user', field }))
  }

  return {
    kind: 'user_compatibility_view',
    writeSafe: false,
    documentId,
    profile: {
      uid: string(raw.uid) || documentId,
      displayName: string(raw.displayName),
      firstName: string(raw.firstName),
      lastName: string(raw.lastName),
      email: string(raw.email),
      emailVerified: typeof raw.emailVerified === 'boolean' ? raw.emailVerified : null,
      roles,
      preferredLocale: language.value,
      profilePhoto: clone(raw.profilePhoto ?? null),
      photoURL: raw.photoURL ?? raw.profilePhoto?.downloadUrl ?? null,
      businessId: typeof raw.businessId === 'string' && raw.businessId.trim() ? raw.businessId.trim() : null,
      accountStatus: ACCOUNT_STATUSES.includes(raw.accountStatus) ? raw.accountStatus : null,
      completion: {
        profileCompleted: hasCompleteUserProfile(raw),
        onboardingCompleted: raw.onboardingCompleted === true,
        businessProfileRequired: raw.businessProfileRequired === true,
        businessProfileCompleted: raw.businessProfileCompleted === true,
      },
      consent: {
        termsAccepted: typeof raw.termsAccepted === 'boolean' ? raw.termsAccepted : null,
        termsAcceptedAt: clone(raw.termsAcceptedAt ?? null),
        termsVersion: raw.termsVersion ?? null,
        privacyAccepted: typeof raw.privacyAccepted === 'boolean' ? raw.privacyAccepted : null,
        privacyAcceptedAt: clone(raw.privacyAcceptedAt ?? raw.privacyPolicyAcceptedAt ?? null),
        privacyVersion: raw.privacyVersion ?? null,
      },
      consentSources: {
        termsAcceptedAt: clone(raw.termsAcceptedAt),
        privacyAcceptedAt: clone(raw.privacyAcceptedAt),
        privacyPolicyAcceptedAt: clone(raw.privacyPolicyAcceptedAt),
      },
      createdAt: clone(raw.createdAt ?? null),
      updatedAt: clone(raw.updatedAt ?? null),
    },
    legacy: {
      accountType: raw.accountType ?? null,
      preferredLanguage: raw.preferredLanguage ?? null,
      isVerified: raw.isVerified,
      isPremium: raw.isPremium,
      deletedAt: clone(raw.deletedAt),
    },
    issues,
  }
}

function compatibilityLocation(raw, issues) {
  const canonical = raw.location && typeof raw.location === 'object' ? clone(raw.location) : {}
  const legacy = { locality: string(raw.city), region: string(raw.province), countryCode: string(raw.country) }
  const conflicts = (
    (canonical.locality && legacy.locality && canonical.locality !== legacy.locality) ||
    (canonical.region && legacy.region && canonical.region !== legacy.region) ||
    (canonical.countryCode && legacy.countryCode && canonical.countryCode !== legacy.countryCode)
  )
  if (conflicts) issues.push(issue(ISSUE_CODES.BUSINESS_CONFLICTING_LOCATION))
  const value = {
    ...legacy,
    ...canonical,
    locality: canonical.locality ?? legacy.locality,
    region: canonical.region ?? legacy.region,
    countryCode: canonical.countryCode ?? legacy.countryCode,
  }
  return { value, canonical, legacy }
}

function compatibilityContact(raw, issues) {
  const nested = raw.contact && typeof raw.contact === 'object' && !Array.isArray(raw.contact)
    ? clone(raw.contact) : null
  const legacyContact = {
    phone: string(raw.phone), email: string(raw.email),
    whatsappNumber: string(raw.whatsappNumber ?? raw.whatsapp), website: string(raw.website),
  }
  const hasLegacy = Object.values(legacyContact).some(Boolean)
  if (nested && hasLegacy) {
    const conflicts = [
      ['phone', 'phone'], ['email', 'email'], ['whatsappNumber', 'whatsappNumber'], ['website', 'website'],
    ].some(([canonicalField, legacyField]) => (
      string(nested[canonicalField]) && legacyContact[legacyField] &&
      string(nested[canonicalField]) !== legacyContact[legacyField]
    ))
    if (conflicts) issues.push(issue(ISSUE_CODES.BUSINESS_CONFLICTING_CONTACT))
  }
  const hasLegacyField = ['phone', 'email', 'whatsapp', 'whatsappNumber', 'website'].some(
    (field) => typeof raw[field] === 'string' && raw[field].trim(),
  )
  if (hasLegacyField) issues.push(issue(ISSUE_CODES.BUSINESS_CONTACT_REQUIRES_PRIVATE_MIGRATION))
  const safety = detectUnsafePublicContact(raw)
  if (!safety.safe) issues.push(issue(ISSUE_CODES.BUSINESS_PUBLIC_CONTACT_UNSAFE))
  return { publicContact: nested, legacyPrivateContactCandidate: hasLegacy ? legacyContact : null, safetyIssues: safety.issues }
}

export function adaptBusinessDocument(documentId, rawDocument = {}) {
  const raw = isRecord(rawDocument) ? rawDocument : {}
  const issues = []
  if (!isRecord(rawDocument)) issues.push(issue(ISSUE_CODES.VALIDATION_INVALID_TYPE, { field: 'businessDocument' }))
  const canonicalName = string(raw.name)
  const legacyName = string(raw.businessName)
  if (!canonicalName && legacyName) issues.push(issue(ISSUE_CODES.BUSINESS_LEGACY_NAME))
  if (canonicalName && legacyName && canonicalName !== legacyName) issues.push(issue(ISSUE_CODES.BUSINESS_CONFLICTING_NAME))
  if (raw.primaryCategoryId && raw.mainCategory && raw.primaryCategoryId !== raw.mainCategory) {
    issues.push(issue(ISSUE_CODES.BUSINESS_CONFLICTING_CATEGORY))
  }
  if ((!raw.primaryCategoryId && raw.mainCategory) || (!Array.isArray(raw.categoryIds) && Array.isArray(raw.subcategories))) {
    issues.push(issue(ISSUE_CODES.BUSINESS_LEGACY_CATEGORY))
  }
  if (documentId && documentId === raw.ownerId) issues.push(issue(ISSUE_CODES.BUSINESS_LEGACY_ID_STRATEGY))
  if (raw.isActive !== undefined || raw.isVerified !== undefined || raw.isPremium !== undefined || raw.subscriptionTier !== undefined) {
    issues.push(issue(ISSUE_CODES.BUSINESS_TRUST_STATUS_NOT_PROMOTED))
  }
  const languages = normalizePrimaryLanguage(raw.primaryLanguage, raw.languages ?? [])
  const serviceAreas = normalizeServiceAreas(raw.serviceAreas ?? [])
  issues.push(...languages.issues, ...serviceAreas.issues)
  const contactResult = compatibilityContact(raw, issues)
  const profilePhoto = clone(raw.profilePhoto ?? null)
  const coverPhoto = clone(raw.coverPhoto ?? null)
  if ((!raw.profilePhoto && raw.logoURL) || (!raw.coverPhoto && raw.coverImageURL)) {
    issues.push(issue(ISSUE_CODES.BUSINESS_LEGACY_MEDIA))
  }
  const galleryImages = clone(Array.isArray(raw.galleryImages) ? raw.galleryImages : [])
  const location = compatibilityLocation(raw, issues)
  for (const [field, missing] of [
    ['documentId', !string(documentId)],
    ['ownerId', !string(raw.ownerId)], ['name', !(canonicalName || legacyName)],
    ['languages', languages.languages.length === 0], ['primaryLanguage', languages.value === null],
    ['status', !BUSINESS_STATUSES.includes(raw.status)],
    ['verificationStatus', !VERIFICATION_STATUSES.includes(raw.verificationStatus)],
  ]) {
    if (missing) issues.push(issue(ISSUE_CODES.COMPATIBILITY_MISSING_REQUIRED_FIELD, { entity: 'business', field }))
  }

  return {
    kind: 'business_compatibility_view',
    writeSafe: false,
    documentId,
    business: {
      businessId: documentId,
      ownerId: string(raw.ownerId),
      managerIds: clone(Array.isArray(raw.managerIds) ? raw.managerIds : []),
      name: canonicalName || legacyName,
      tagline: string(raw.tagline),
      description: string(raw.description),
      primaryCategoryId: string(raw.primaryCategoryId) || string(raw.mainCategory),
      categoryIds: clone(Array.isArray(raw.categoryIds) ? raw.categoryIds : (raw.subcategories ?? [])),
      serviceAreas: serviceAreas.identifiers,
      serviceAreaValues: serviceAreas.values,
      languages: languages.languages.map(({ id }) => id),
      languageValues: languages.languages,
      primaryLanguage: languages.value,
      location: location.value,
      locationSources: { canonical: location.canonical, legacy: location.legacy },
      contact: contactResult.publicContact,
      profilePhoto,
      coverPhoto,
      galleryImages,
      galleryImageURLs: clone(Array.isArray(raw.galleryImageURLs) ? raw.galleryImageURLs : []),
      status: BUSINESS_STATUSES.includes(raw.status) ? raw.status : null,
      verificationStatus: VERIFICATION_STATUSES.includes(raw.verificationStatus) ? raw.verificationStatus : null,
      subscription: raw.subscription && SUBSCRIPTION_STATUSES.includes(raw.subscription.status)
        ? clone(raw.subscription) : null,
      profileCompleted: raw.profileCompleted === true,
      createdAt: clone(raw.createdAt ?? null),
      updatedAt: clone(raw.updatedAt ?? null),
      publishedAt: clone(raw.publishedAt ?? null),
    },
    legacy: {
      businessName: raw.businessName ?? null,
      mainCategory: raw.mainCategory ?? null,
      subcategories: clone(raw.subcategories),
      isActive: raw.isActive,
      isVerified: raw.isVerified,
      isPremium: raw.isPremium,
      subscriptionTier: raw.subscriptionTier,
      logoURL: raw.logoURL ?? null,
      coverImageURL: raw.coverImageURL ?? null,
      galleryImageURLs: clone(raw.galleryImageURLs),
      contactCandidate: contactResult.legacyPrivateContactCandidate,
    },
    contactSafetyIssues: contactResult.safetyIssues,
    issues,
  }
}
