export const CURRENT_TERMS_VERSION = '1.1'
export const CURRENT_PRIVACY_VERSION = '1.1'

export const CURRENT_TERMS_EFFECTIVE_DATE = null
export const CURRENT_PRIVACY_EFFECTIVE_DATE = null

// Candidate 1.1 is not published; effective dates are assigned at approved release.
const historicalTermsVersions = Object.freeze(['1.0'])
const historicalPrivacyVersions = Object.freeze(['1.0'])

function isFirestoreTimestamp(value) {
  try {
    if (
      !value
      || typeof value !== 'object'
      || Array.isArray(value)
      || !Number.isSafeInteger(value.seconds)
      || !Number.isInteger(value.nanoseconds)
      || value.nanoseconds < 0
      || value.nanoseconds >= 1_000_000_000
      || typeof value.toMillis !== 'function'
    ) return false
    const millis = value.toMillis()
    return Number.isFinite(millis)
      && millis === (value.seconds * 1_000) + (value.nanoseconds / 1_000_000)
  } catch {
    return false
  }
}

function hasTermsEvidence(profile, versions) {
  return Boolean(profile?.termsAccepted === true && isFirestoreTimestamp(profile.termsAcceptedAt) && versions.includes(profile.termsVersion))
}
function hasPrivacyEvidence(profile, versions) {
  return Boolean(profile?.privacyAccepted === true && isFirestoreTimestamp(profile.privacyAcceptedAt) && versions.includes(profile.privacyVersion))
}
export function hasValidTermsAcceptance(profile) {
  return hasTermsEvidence(profile, [...historicalTermsVersions, CURRENT_TERMS_VERSION])
}
export function hasValidPrivacyAcknowledgment(profile) {
  return hasPrivacyEvidence(profile, [...historicalPrivacyVersions, CURRENT_PRIVACY_VERSION])
}

// Access eligibility is distinct from agreement to the current published text.
export function hasValidLegalConsent(profile) {
  return hasValidTermsAcceptance(profile) && hasValidPrivacyAcknowledgment(profile)
}

export function hasCurrentLegalConsent(profile) {
  return hasTermsEvidence(profile, [CURRENT_TERMS_VERSION]) && hasPrivacyEvidence(profile, [CURRENT_PRIVACY_VERSION])
}

export function isSupportedLegalVersionPair(termsVersion, privacyVersion) {
  return [...historicalTermsVersions, CURRENT_TERMS_VERSION].includes(termsVersion)
    && [...historicalPrivacyVersions, CURRENT_PRIVACY_VERSION].includes(privacyVersion)
}
