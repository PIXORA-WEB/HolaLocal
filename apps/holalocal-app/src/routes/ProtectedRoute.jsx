import { Navigate, Outlet, useLocation } from 'react-router-dom'
import LoadingScreen from '../components/LoadingScreen.jsx'
import useAuthentication from '../hooks/useAuthentication.js'

function ProtectedRoute({ allowIncompleteOnboarding = false, allowIncompleteProfile = false }) {
  const { loading, profileLoading, user, userProfile } = useAuthentication()
  const location = useLocation()

  if (loading || profileLoading) return <LoadingScreen />

  if (!user) {
    return <Navigate replace state={{ from: location }} to="/login" />
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
