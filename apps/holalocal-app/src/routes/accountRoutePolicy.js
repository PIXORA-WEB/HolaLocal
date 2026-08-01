export function protectedAccountDecision({
  allowIncompleteOnboarding = false,
  allowIncompleteProfile = false,
  allowUnverified = false,
  emailVerified = false,
  loading = false,
  profileLoading = false,
  user = null,
  userProfile = null,
} = {}) {
  if (loading || profileLoading) return 'loading'
  if (!user) return 'login'
  if (userProfile?.accountStatus !== 'active') return 'blocked'
  if (!allowUnverified && !emailVerified) return 'verify_email'
  if (!allowIncompleteProfile && userProfile?.profileCompleted !== true) return 'complete_profile'
  if (userProfile?.profileCompleted === true && !allowIncompleteOnboarding
    && userProfile?.onboardingCompleted !== true) return 'onboarding'
  return 'allow'
}

export function publicAccountDestination({ emailVerified, from = '/', userProfile } = {}) {
  if (!emailVerified) return '/verify-email'
  if (userProfile?.profileCompleted !== true) return '/complete-profile'
  if (userProfile?.onboardingCompleted !== true) return '/onboarding'
  return from
}
