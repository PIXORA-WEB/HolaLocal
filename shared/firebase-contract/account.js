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
