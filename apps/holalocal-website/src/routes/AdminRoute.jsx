import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LoadingScreen from '../components/common/LoadingScreen.jsx'
import useAuthentication from '../hooks/useAuthentication.js'

function AdminRoute() {
  const { t } = useTranslation()
  const { loading, user } = useAuthentication()
  const location = useLocation()
  const [claimState, setClaimState] = useState({ status: 'loading', attempt: 0 })

  useEffect(() => {
    let active = true
    if (!user) return () => { active = false }
    user.getIdTokenResult(claimState.attempt > 0).then((token) => {
      if (!active) return
      const authorised = token.claims.admin === true || token.claims.moderator === true
      setClaimState((state) => ({ ...state, status: authorised ? 'authorised' : 'unauthorised' }))
    }).catch((error) => {
      if (!active) return
      const expired = ['auth/id-token-expired', 'auth/user-token-expired'].includes(error?.code)
      setClaimState((state) => ({ ...state, status: expired ? 'expired' : 'failed' }))
    })
    return () => { active = false }
  }, [claimState.attempt, user])

  if (loading || (user && claimState.status === 'loading')) {
    return <LoadingScreen message={t('admin.access.checking')} />
  }
  if (!user) return <Navigate replace state={{ from: location }} to="/login" />
  if (claimState.status === 'authorised') return <Outlet />

  const expired = claimState.status === 'expired'
  return (
    <main className="admin-access-state" id="main-content">
      <h1>{t(expired ? 'admin.access.expiredTitle' : claimState.status === 'failed' ? 'admin.access.failedTitle' : 'admin.access.deniedTitle')}</h1>
      <p>{t(expired ? 'admin.access.expired' : claimState.status === 'failed' ? 'admin.access.failed' : 'admin.access.denied')}</p>
      {claimState.status !== 'unauthorised' && (
        <button
          className="button button--primary"
          onClick={() => setClaimState((state) => ({ status: 'loading', attempt: state.attempt + 1 }))}
          type="button"
        >
          {t('common.retry')}
        </button>
      )}
    </main>
  )
}

export default AdminRoute
