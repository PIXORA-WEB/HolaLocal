import { Navigate, Outlet, useLocation } from 'react-router-dom'
import LoadingScreen from '../components/LoadingScreen.jsx'
import useAuthentication from '../hooks/useAuthentication.js'
import { protectedAccountDecision } from './accountRoutePolicy.js'

function ProtectedRoute({ allowIncompleteOnboarding = false, allowIncompleteProfile = false, allowUnverified = false }) {
  const { emailVerified, loading, profileLoading, user, userProfile } = useAuthentication()
  const location = useLocation()
  const decision = protectedAccountDecision({
    allowIncompleteOnboarding, allowIncompleteProfile, allowUnverified,
    emailVerified, loading, profileLoading, user, userProfile,
  })

  if (decision === 'loading') return <LoadingScreen />

  if (decision === 'login') {
    return <Navigate replace state={{ from: location }} to="/login" />
  }

  if (decision === 'blocked') return <Navigate replace to="/" />

  if (decision === 'verify_email') {
    return <Navigate replace state={{ from: location }} to="/verify-email" />
  }

  if (decision === 'complete_profile') {
    return <Navigate replace to="/complete-profile" />
  }

  if (decision === 'onboarding') {
    return <Navigate replace to="/onboarding" />
  }

  return <Outlet />
}

export default ProtectedRoute
