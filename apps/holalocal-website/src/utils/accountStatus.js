export function hasBlockedAccountStatus(userProfile) {
  if (!userProfile) return false
  return userProfile.accountStatus !== 'active'
}

export function hasPendingAccountDeletion(userProfile) {
  return userProfile?.deletionRequestedAt != null
}
