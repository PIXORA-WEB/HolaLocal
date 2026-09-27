export const CURRENT_TERMS_VERSION = '1.2'
export const CURRENT_PRIVACY_VERSION = '1.2'

export const CURRENT_TERMS_EFFECTIVE_DATE = '2026-09-27'
export const CURRENT_PRIVACY_EFFECTIVE_DATE = '2026-09-27'

// Recognized evidence is independent of whichever document is currently published.
// Keep published historical versions here; never derive this list from CURRENT_*.
// Firestore Rules mirror these bounded lists, checked by the legal foundation tests.
export const SUPPORTED_TERMS_VERSIONS = Object.freeze(['1.0', '1.1', '1.2'])
export const SUPPORTED_PRIVACY_VERSIONS = Object.freeze(['1.0', '1.1', '1.2'])

// Today's access policy, not a decision about any future publication/renewal.
// A future policy change must be reviewed separately from evidence recognition.
export const LEGAL_ACCESS_VERSION_REQUIREMENTS = Object.freeze({
  terms: Object.freeze(['1.0', '1.1', '1.2']),
  privacy: Object.freeze(['1.0', '1.1', '1.2']),
})

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
  return hasTermsEvidence(profile, SUPPORTED_TERMS_VERSIONS)
}
export function hasValidPrivacyAcknowledgment(profile) {
  return hasPrivacyEvidence(profile, SUPPORTED_PRIVACY_VERSIONS)
}

// Recovery fills missing evidence; it must not renew valid historical records.
export function hasHistoricalLegalEvidence(profile) {
  return hasValidTermsAcceptance(profile) && hasValidPrivacyAcknowledgment(profile)
}

// Access eligibility is distinct from evidence recognition and current agreement.
export function hasValidLegalConsent(profile) {
  return hasHistoricalLegalEvidence(profile)
    && hasTermsEvidence(profile, LEGAL_ACCESS_VERSION_REQUIREMENTS.terms)
    && hasPrivacyEvidence(profile, LEGAL_ACCESS_VERSION_REQUIREMENTS.privacy)
}

export function hasCurrentLegalConsent(profile) {
  return hasTermsEvidence(profile, [CURRENT_TERMS_VERSION]) && hasPrivacyEvidence(profile, [CURRENT_PRIVACY_VERSION])
}

export function isSupportedLegalVersionPair(termsVersion, privacyVersion) {
  return SUPPORTED_TERMS_VERSIONS.includes(termsVersion)
    && SUPPORTED_PRIVACY_VERSIONS.includes(privacyVersion)
}
