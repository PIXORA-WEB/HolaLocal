export const CURRENT_TERMS_VERSION = '1.0'
export const CURRENT_PRIVACY_VERSION = '1.0'

export const CURRENT_TERMS_EFFECTIVE_DATE = '2026-07-04'
export const CURRENT_PRIVACY_EFFECTIVE_DATE = '2026-07-04'

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

export function hasCurrentLegalConsent(profile) {
  return Boolean(
    profile
    && profile.termsAccepted === true
    && isFirestoreTimestamp(profile.termsAcceptedAt)
    && profile.termsVersion === CURRENT_TERMS_VERSION
    && profile.privacyAccepted === true
    && isFirestoreTimestamp(profile.privacyAcceptedAt)
    && profile.privacyVersion === CURRENT_PRIVACY_VERSION
  )
}
