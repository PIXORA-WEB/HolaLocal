export function shouldMaintainProfileAfterLogin(profile) {
  return profile?.accountStatus === 'active' && profile.deletionRequestedAt == null
}
