import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LoadingScreen from '../components/common/LoadingScreen.jsx'
import useAuthentication from '../hooks/useAuthentication.js'

function AdminOnlyRoute() {
  const { t } = useTranslation()
  const { user } = useAuthentication()
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let active = true
    user?.getIdTokenResult().then((token) => {
      if (active) setStatus(token.claims?.admin === true ? 'authorised' : 'denied')
    }).catch(() => active && setStatus('denied'))
    return () => { active = false }
  }, [user])

  if (status === 'loading') return <LoadingScreen message={t('admin.access.checking')} />
  if (status === 'authorised') return <Outlet />
  return <main className="admin-access-state"><h1>{t('admin.access.deniedTitle')}</h1><p>{t('admin.access.denied')}</p></main>
}

export default AdminOnlyRoute
