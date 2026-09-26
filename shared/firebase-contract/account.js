function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function hasCompleteUserProfile(profile = {}) {
  return Boolean(
    text(profile.firstName)
    && text(profile.lastName)
    && text(profile.displayName)
    && text(profile.preferredLocale)
    && text(profile.city)
    && text(profile.country)
  )
}

// Preference normalization is not account authorization. Callers must explicitly
// establish document existence; a failed/missing read is never default ON.
export function normalizeMessageTranslationPreference(profile, { exists = false } = {}) {
  const profileExists = exists === true && profile !== null
    && typeof profile === 'object' && !Array.isArray(profile)
  if (!profileExists) return { exists: false, valid: false, enabled: false, enabledSince: undefined }
  const hasEnabled = Object.hasOwn(profile, 'messageTranslationEnabled')
  const hasSince = Object.hasOwn(profile, 'messageTranslationEnabledSince')
  const enabled = profile.messageTranslationEnabled
  const since = profile.messageTranslationEnabledSince
  const validEnabled = !hasEnabled || typeof enabled === 'boolean'
  const validSince = !hasSince || isPreferenceTimestamp(since)
  return {
    exists: true,
    valid: validEnabled && validSince,
    enabled: validEnabled && validSince && (!hasEnabled || enabled === true),
    enabledSince: hasSince && validSince ? since : undefined,
  }
}

// SDK-independent Timestamp boundary, compatible with Web and Admin SDK values.
// Preserve the original object/nanoseconds; Dates, numbers and JSON maps are not cutoffs.
function isPreferenceTimestamp(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const { seconds, nanoseconds } = value
  if (!Number.isInteger(seconds) || seconds < -62135596800 || seconds > 253402300799
    || !Number.isInteger(nanoseconds) || nanoseconds < 0 || nanoseconds > 999999999
    || typeof value.toMillis !== 'function' || typeof value.toDate !== 'function') return false
  try {
    const milliseconds = value.toMillis()
    // Web SDK retains fractional milliseconds; Admin SDK truncates them.
    return Number.isFinite(milliseconds)
      && (milliseconds === seconds * 1000 + nanoseconds / 1e6
        || milliseconds === seconds * 1000 + Math.floor(nanoseconds / 1e6))
  } catch {
    return false
  }
}
