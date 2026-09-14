import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LoadingScreen from '../components/common/LoadingScreen.jsx'
import useAuthentication from '../hooks/useAuthentication.js'

function AdminOnlyRoute() {
  const { t } = useTranslation()
  const { authSession, user } = useAuthentication()
  const [claimState, setClaimState] = useState(null)
  // Never reuse another session's decision, even before effects have run.
  const status = authSession?.active && claimState?.session === authSession
    && claimState.user === user ? claimState.status : 'loading'

  useEffect(() => {
    let active = true
    if (!user || !authSession?.active) return () => { active = false }
    user.getIdTokenResult().then((token) => {
      if (active && authSession.active) setClaimState({ session: authSession, user, status: token.claims?.admin === true ? 'authorised' : 'denied' })
    }).catch(() => {
      if (active && authSession.active) setClaimState({ session: authSession, user, status: 'denied' })
    })
    return () => { active = false }
  }, [authSession, user])

  if (status === 'loading') return <LoadingScreen message={t('admin.access.checking')} />
  if (user && status === 'authorised') return <Outlet />
  return <main className="admin-access-state"><h1>{t('admin.access.deniedTitle')}</h1><p>{t('admin.access.denied')}</p></main>
}

export default AdminOnlyRoute
