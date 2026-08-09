import { Navigate, Outlet, useLocation } from 'react-router-dom'
import LoadingScreen from '../components/common/LoadingScreen.jsx'
import BlockedAccountScreen, {
  ProfileUnavailableScreen,
} from '../components/common/BlockedAccountScreen.jsx'
import useAuthentication from '../hooks/useAuthentication.js'
import { protectedAccountDecision } from './accountRoutePolicy.js'

function ProtectedRoute({
  allowIncompleteOnboarding = false,
  allowIncompleteProfile = false,
  allowMissingConsent = false,
  allowUnverified = false,
}) {
  const {
    emailVerified,
    loading,
    profileLoading,
    profileStatus,
    user,
    userProfile,
  } = useAuthentication()
  const location = useLocation()
  const decision = protectedAccountDecision({
    allowIncompleteOnboarding,
    allowIncompleteProfile,
    allowMissingConsent,
    allowUnverified,
    emailVerified,
    loading,
    profileLoading,
    profileStatus,
    user,
    userProfile,
  })

  if (decision === 'loading') return <LoadingScreen />

  if (decision === 'login') {
    return <Navigate replace state={{ from: location }} to="/login" />
  }

  if (decision === 'profile_unavailable') {
    return <ProfileUnavailableScreen />
  }

  if (decision === 'blocked') {
    return <BlockedAccountScreen accountStatus={userProfile.accountStatus} />
  }

  if (decision === 'verify_email') {
    return <Navigate replace state={{ from: location.state?.from ?? location }} to="/verify-email" />
  }

  if (decision === 'legal_consent') {
    return <Navigate replace state={{ from: location.state?.from ?? location }} to="/legal-consent" />
  }

  if (decision === 'complete_profile') {
    return <Navigate replace state={{ from: location.state?.from ?? location }} to="/complete-profile" />
  }

  if (decision === 'onboarding') {
    return <Navigate replace state={{ from: location.state?.from ?? location }} to="/onboarding" />
  }

  return <Outlet />
}

export default ProtectedRoute
