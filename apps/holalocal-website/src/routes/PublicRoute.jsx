import { Navigate, Outlet, useLocation } from 'react-router-dom'
import LoadingScreen from '../components/common/LoadingScreen.jsx'
import BlockedAccountScreen from '../components/common/BlockedAccountScreen.jsx'
import useAuthentication from '../hooks/useAuthentication.js'
import { hasBlockedAccountStatus } from '../utils/accountStatus.js'

function PublicRoute() {
  const { emailVerified, loading, profileLoading, user, userProfile } = useAuthentication()
  const location = useLocation()

  if (loading || profileLoading) return <LoadingScreen />

  if (user) {
    if (hasBlockedAccountStatus(userProfile)) {
      return <BlockedAccountScreen accountStatus={userProfile.accountStatus} />
    }
    let destination = location.state?.from?.pathname ?? '/'

    if (!emailVerified) {
      destination = '/verify-email'
    } else if (userProfile?.profileCompleted !== true) {
      destination = '/complete-profile'
    } else if (userProfile?.onboardingCompleted !== true) {
      destination = '/onboarding'
    }

    return <Navigate replace state={{ from: location.state?.from }} to={destination} />
  }

  return <Outlet />
}

export default PublicRoute
