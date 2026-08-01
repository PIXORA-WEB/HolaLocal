import { Navigate, Outlet, useLocation } from 'react-router-dom'
import LoadingScreen from '../components/common/LoadingScreen.jsx'
import BlockedAccountScreen, {
  ProfileUnavailableScreen,
} from '../components/common/BlockedAccountScreen.jsx'
import useAuthentication from '../hooks/useAuthentication.js'
import { hasBlockedAccountStatus } from '../utils/accountStatus.js'

function PublicRoute() {
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

  if (user) {
    if (!emailVerified) {
      return <Navigate replace state={{ from: location.state?.from }} to="/verify-email" />
    }
    if (profileStatus === 'unavailable') {
      return <ProfileUnavailableScreen />
    }
    if (profileLoading || profileStatus === 'loading') return <LoadingScreen />

    if (hasBlockedAccountStatus(userProfile)) {
      return <BlockedAccountScreen accountStatus={userProfile.accountStatus} />
    }
    let destination = location.state?.from?.pathname ?? '/'

    if (userProfile?.profileCompleted !== true) {
      destination = '/complete-profile'
    } else if (userProfile?.onboardingCompleted !== true) {
      destination = '/onboarding'
    }

    return <Navigate replace state={{ from: location.state?.from }} to={destination} />
  }

  return <Outlet />
}

export default PublicRoute
