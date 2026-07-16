import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SiteFooter from './SiteFooter.jsx'
import SiteHeader from './SiteHeader.jsx'

function AuthLayout() {
  const { t } = useTranslation()
  return (
    <div className="account-shell">
      <a className="skip-link" href="#main-content">{t('common.skipToContent')}</a>
      <SiteHeader />
      <main className="account-content" id="main-content">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}

export default AuthLayout
