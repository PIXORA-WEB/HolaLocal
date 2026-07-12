import { Navigate, Outlet, useLocation } from 'react-router-dom'
import LoadingScreen from '../components/LoadingScreen.jsx'
import useAuthentication from '../hooks/useAuthentication.js'
import { publicAccountDestination } from './accountRoutePolicy.js'

function PublicRoute() {
  const { emailVerified, loading, profileLoading, user, userProfile } = useAuthentication()
  const location = useLocation()

  if (loading || profileLoading) return <LoadingScreen />

  if (user) {
    const destination = publicAccountDestination({
      emailVerified, from: location.state?.from?.pathname ?? '/', userProfile,
    })

    return <Navigate replace to={destination} />
  }

  return <Outlet />
}

export default PublicRoute
