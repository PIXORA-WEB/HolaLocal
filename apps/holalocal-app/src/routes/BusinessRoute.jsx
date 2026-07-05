import { Navigate, Outlet } from 'react-router-dom'
import LoadingScreen from '../components/LoadingScreen.jsx'
import useAuthentication from '../hooks/useAuthentication.js'

function BusinessRoute() {
  const { loading, profileLoading, userProfile } = useAuthentication()

  if (loading || profileLoading) return <LoadingScreen />

  if (!userProfile?.roles?.includes('business')) {
    return <Navigate replace to="/profile" />
  }

  return <Outlet />
}

export default BusinessRoute
