import { Navigate, Outlet, useLocation } from 'react-router-dom'
import LoadingScreen from '../components/common/LoadingScreen.jsx'
import BlockedAccountScreen, {
  ProfileUnavailableScreen,
} from '../components/common/BlockedAccountScreen.jsx'
import useAuthentication from '../hooks/useAuthentication.js'
import { internalPathFromLocation } from '../utils/internalNavigation.js'
import { authenticatedPublicDecision } from './accountRoutePolicy.js'

function PublicRoute() {
  const {
    registrationAttempt,
    emailVerified,
    loading,
    profileLoading,
    profileStatus,
    user,
    userProfile,
  } = useAuthentication()
  const location = useLocation()
  const decision = authenticatedPublicDecision({
    emailVerified,
    loading,
    profileLoading,
    profileStatus,
    user,
    userProfile,
  })

  // Preserve only this registration owner's form, including observer loading.
  if (location.pathname === '/register' && registrationAttempt?.uiOwner
    && registrationAttempt.status !== 'superseded'
    && !['blocked', 'account_deletion'].includes(decision)) return <Outlet />

  if (decision === 'loading') return <LoadingScreen />

  if (user) {
    if (decision === 'profile_unavailable') {
      return <ProfileUnavailableScreen />
    }
    if (decision === 'blocked') {
      return <BlockedAccountScreen accountStatus={userProfile.accountStatus} />
    }
    if (decision === 'account_deletion') {
      return <Navigate replace to="/account-deletion" />
    }
    if (decision === 'verify_email') {
      return <Navigate replace state={{ from: location.state?.from }} to="/verify-email" />
    }
    if (decision === 'legal_consent') {
      return <Navigate replace state={{ from: location.state?.from }} to="/legal-consent" />
    }
    let destination = internalPathFromLocation(location.state?.from)

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
