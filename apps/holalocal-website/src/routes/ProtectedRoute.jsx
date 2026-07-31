import { Navigate, Outlet, useLocation } from 'react-router-dom'
import LoadingScreen from '../components/common/LoadingScreen.jsx'
import BlockedAccountScreen, {
  ProfileUnavailableScreen,
} from '../components/common/BlockedAccountScreen.jsx'
import useAuthentication from '../hooks/useAuthentication.js'
import { hasBlockedAccountStatus } from '../utils/accountStatus.js'

function ProtectedRoute({
  allowIncompleteOnboarding = false,
  allowIncompleteProfile = false,
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

  if (loading) return <LoadingScreen />

  if (!user) {
    return <Navigate replace state={{ from: location }} to="/login" />
  }

  if (!allowUnverified && !emailVerified) {
    return <Navigate replace state={{ from: location }} to="/verify-email" />
  }

  if (profileStatus === 'unavailable') {
    return <ProfileUnavailableScreen />
  }

  if (profileLoading || profileStatus === 'loading') return <LoadingScreen />

  if (hasBlockedAccountStatus(userProfile)) {
    return <BlockedAccountScreen accountStatus={userProfile.accountStatus} />
  }

  if (!allowIncompleteProfile && userProfile?.profileCompleted !== true) {
    return <Navigate replace to="/complete-profile" />
  }

  if (
    userProfile?.profileCompleted === true &&
    !allowIncompleteOnboarding &&
    userProfile?.onboardingCompleted !== true
  ) {
    return <Navigate replace to="/onboarding" />
  }

  return <Outlet />
}

export default ProtectedRoute
