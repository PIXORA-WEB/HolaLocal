import { ISSUE_CODES, SUPPORTED_LANGUAGE_CODES, normalizeLanguage, validateRoles } from '@holalocal/firebase-contract'

export const POLICY_VERSION = '1.0'

const profileFields = new Set([
  'displayName', 'firstName', 'lastName', 'photoURL', 'profilePhoto',
  'preferredLocale', 'city', 'country', 'profileCompleted',
  'businessProfileCompleted',
])

function normalizeName(value) {
  return String(value ?? '').trim().toLocaleLowerCase()
}

export function resolveRegistrationLocale(value) {
  if (value == null || String(value).trim() === '') return { locale: 'en', issue: null }
  const normalized = normalizeLanguage(value)
  if (normalized.value && !normalized.value.isCustom) {
    return { locale: normalized.value.id, issue: null }
  }
  return { locale: 'en', issue: ISSUE_CODES.LANGUAGE_UNKNOWN_CUSTOM }
}

export function buildRegistrationProfile(uid, profileData = {}, serverTimestamp) {
  if (typeof serverTimestamp !== 'function') throw new Error('A server timestamp factory is required.')
  if (!profileData.termsAccepted || !profileData.privacyAccepted) {
    throw new Error('Current Terms and Privacy consent is required.')
  }
  if (profileData.termsVersion !== POLICY_VERSION || profileData.privacyVersion !== POLICY_VERSION) {
    throw new Error('The current policy version is required.')
  }
  const displayName = String(profileData.displayName ?? '').trim()
  const preferredLocale = resolveRegistrationLocale(profileData.preferredLocale).locale
  return {
    uid, email: String(profileData.email ?? '').trim(), displayName,
    displayNameNormalized: normalizeName(displayName), firstName: '', lastName: '',
    photoURL: null, profilePhoto: null, preferredLocale, accountType: 'customer',
    roles: ['customer'], city: '', country: 'Spain', accountStatus: 'active',
    profileCompleted: false, onboardingCompleted: false, businessProfileRequired: false,
    businessProfileCompleted: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(), termsAccepted: true, termsAcceptedAt: serverTimestamp(),
    termsVersion: POLICY_VERSION, privacyAccepted: true, privacyAcceptedAt: serverTimestamp(),
    privacyVersion: POLICY_VERSION, deletionRequestedAt: null, deletionScheduledFor: null,
    anonymizedAt: null,
  }
}

export function buildProfileUpdates(updates = {}) {
  if (updates?.compatibility?.writeSafe === false) {
    throw new Error('Compatibility views cannot be used as Firestore payloads.')
  }
  const safe = Object.fromEntries(Object.entries(updates).filter(
    ([field, value]) => profileFields.has(field) && value !== undefined,
  ))
  if (safe.displayName !== undefined) safe.displayNameNormalized = normalizeName(safe.displayName)
  if (safe.preferredLocale !== undefined && !SUPPORTED_LANGUAGE_CODES.includes(safe.preferredLocale)) {
    throw new Error('Choose a supported language.')
  }
  return safe
}

export function buildRoleUpdates(accountType, currentBusinessComplete = false) {
  const mappings = { customer: ['customer'], business: ['business'], both: ['customer', 'business'] }
  const roles = mappings[accountType]
  if (!roles || !validateRoles(roles).valid) throw new Error('Choose a valid account type.')
  return {
    accountType, roles, onboardingCompleted: true,
    businessProfileRequired: roles.includes('business'),
    businessProfileCompleted: currentBusinessComplete === true,
  }
}
