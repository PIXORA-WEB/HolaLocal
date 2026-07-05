export function hasBlockedAccountStatus(userProfile) {
  if (!userProfile) return false
  return userProfile.accountStatus !== 'active' || userProfile.deletionRequestedAt != null
}
