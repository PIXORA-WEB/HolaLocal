import { Outlet } from 'react-router-dom'
import BrandLockup from '../common/BrandLockup.jsx'
import LanguageSwitcher from '../common/LanguageSwitcher.jsx'
import { useTranslation } from 'react-i18next'

function AuthLayout() {
  const { t } = useTranslation()
  return (
    <div className="account-shell">
      <a className="skip-link" href="#main-content">{t('common.skipToContent')}</a>
      <header className="account-header">
        <BrandLockup />
        <LanguageSwitcher />
      </header>
      <main className="account-content" id="main-content">
        <Outlet />
      </main>
    </div>
  )
}

export default AuthLayout
