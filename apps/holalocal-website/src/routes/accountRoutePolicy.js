import { hasBlockedAccountStatus, hasPendingAccountDeletion } from '../utils/accountStatus.js'
import { hasCurrentLegalConsent } from '../utils/policies.js'

export function protectedAccountDecision({
  allowIncompleteOnboarding = false,
  allowIncompleteProfile = false,
  allowDeletionPending = false,
  allowMissingConsent = false,
  allowUnverified = false,
  emailVerified = false,
  loading = false,
  profileLoading = false,
  profileStatus = 'loading',
  user = null,
  userProfile = null,
} = {}) {
  if (loading) return 'loading'
  if (!user) return 'login'
  if (profileStatus === 'unavailable') return 'profile_unavailable'
  if (profileLoading || profileStatus === 'loading') return 'loading'
  if (hasBlockedAccountStatus(userProfile)) return 'blocked'
  if (!allowDeletionPending && hasPendingAccountDeletion(userProfile)) return 'account_deletion'
  if (!allowUnverified && !emailVerified) return 'verify_email'
  if (!allowMissingConsent && !hasCurrentLegalConsent(userProfile)) return 'legal_consent'
  if (!allowIncompleteProfile && userProfile?.profileCompleted !== true) return 'complete_profile'
  if (userProfile?.profileCompleted === true && !allowIncompleteOnboarding
    && userProfile?.onboardingCompleted !== true) return 'onboarding'
  return 'allow'
}

export function authenticatedPublicDecision(options = {}) {
  return protectedAccountDecision({
    ...options,
    allowIncompleteOnboarding: true,
    allowIncompleteProfile: true,
  })
}
