import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LoadingScreen from '../components/common/LoadingScreen.jsx'
import useAuthentication from '../hooks/useAuthentication.js'
import { hasAdminAccessClaim } from './adminAccessPolicy.js'

function AdminRoute() {
  const { t } = useTranslation()
  const { authSession, loading, user } = useAuthentication()
  const location = useLocation()
  const [attempt, setAttempt] = useState(0)
  const [claimState, setClaimState] = useState(null)
  // A result belongs to one session and attempt. Mismatch is pending during
  // render, before effect cleanup, so an old outlet cannot admit a new user.
  const status = authSession?.active && claimState?.session === authSession
    && claimState.user === user && claimState.attempt === attempt
    ? claimState.status : 'loading'

  useEffect(() => {
    let active = true
    if (!user || !authSession?.active) return () => { active = false }
    user.getIdTokenResult(attempt > 0).then((token) => {
      if (!active || !authSession.active) return
      const authorised = hasAdminAccessClaim(token.claims)
      setClaimState({ session: authSession, user, attempt, status: authorised ? 'authorised' : 'unauthorised' })
    }).catch((error) => {
      if (!active || !authSession.active) return
      const expired = ['auth/id-token-expired', 'auth/user-token-expired'].includes(error?.code)
      setClaimState({ session: authSession, user, attempt, status: expired ? 'expired' : 'failed' })
    })
    return () => { active = false }
  }, [attempt, authSession, user])

  if (loading || (user && status === 'loading')) {
    return <LoadingScreen message={t('admin.access.checking')} />
  }
  if (!user) return <Navigate replace state={{ from: location }} to="/login" />
  if (status === 'authorised') return <Outlet />

  const expired = status === 'expired'
  return (
    <main className="admin-access-state" id="main-content">
      <h1>{t(expired ? 'admin.access.expiredTitle' : status === 'failed' ? 'admin.access.failedTitle' : 'admin.access.deniedTitle')}</h1>
      <p>{t(expired ? 'admin.access.expired' : status === 'failed' ? 'admin.access.failed' : 'admin.access.denied')}</p>
      {status !== 'unauthorised' && (
        <button
          className="button button--primary"
          onClick={() => setAttempt((current) => current + 1)}
          type="button"
        >
          {t('common.retry')}
        </button>
      )}
    </main>
  )
}

export default AdminRoute
