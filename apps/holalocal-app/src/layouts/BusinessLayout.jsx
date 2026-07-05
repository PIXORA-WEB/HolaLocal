import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import BrandLockup from '../components/common/BrandLockup.jsx'
import LanguageSwitcher from '../components/common/LanguageSwitcher.jsx'

function BusinessLayout() {
  const { t } = useTranslation()

  return (
    <div className="business-layout">
      <header className="business-layout__header">
        <div className="app-header__inner">
          <BrandLockup />
          <div className="layout-actions">
            <span className="workspace-badge">{t('nav.business')}</span>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <nav className="section-navigation" aria-label={t('nav.business')}>
        <NavLink to="/business/dashboard">
          {t('business.dashboard')}
        </NavLink>
        <NavLink to="/business/edit">{t('business.edit')}</NavLink>
        <NavLink to="/business/subscription">{t('business.subscription')}</NavLink>
      </nav>

      <main className="business-layout__content">
        <Outlet />
      </main>
    </div>
  )
}

export default BusinessLayout
