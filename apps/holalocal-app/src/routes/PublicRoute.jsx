import { Navigate, Outlet, useLocation } from 'react-router-dom'
import LoadingScreen from '../components/LoadingScreen.jsx'
import useAuthentication from '../hooks/useAuthentication.js'

function PublicRoute() {
  const { loading, profileLoading, user, userProfile } = useAuthentication()
  const location = useLocation()

  if (loading || profileLoading) return <LoadingScreen />

  if (user) {
    let destination = location.state?.from?.pathname ?? '/'

    if (userProfile?.profileCompleted !== true) {
      destination = '/complete-profile'
    } else if (userProfile?.onboardingCompleted !== true) {
      destination = '/onboarding'
    }

    return <Navigate replace to={destination} />
  }

  return <Outlet />
}

export default PublicRoute
