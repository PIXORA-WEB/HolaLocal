import { Navigate, Outlet } from 'react-router-dom'
import LoadingScreen from '../components/common/LoadingScreen.jsx'
import { ProfileUnavailableScreen } from '../components/common/BlockedAccountScreen.jsx'
import useAuthentication from '../hooks/useAuthentication.js'

function CustomerRoute() {
  const { loading, profileLoading, profileStatus, userProfile } = useAuthentication()

  if (profileStatus === 'unavailable') return <ProfileUnavailableScreen />
  if (loading || profileLoading || profileStatus === 'loading') return <LoadingScreen />
  if (!userProfile?.roles?.includes('customer')) return <Navigate replace to="/profile" />
  return <Outlet />
}

export default CustomerRoute
