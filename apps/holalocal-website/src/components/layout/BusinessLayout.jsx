import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

function BusinessLayout() {
  const { t } = useTranslation()

  return (
    <div className="business-area">
      <nav className="account-navigation" aria-label={t('nav.business')}>
        <NavLink to="/business/dashboard">{t('account.business')}</NavLink>
        <NavLink to="/business/edit">{t('business.edit')}</NavLink>
        <NavLink to="/business/subscription">{t('business.subscription')}</NavLink>
      </nav>
      <div className="business-area__content">
        <Outlet />
      </div>
    </div>
  )
}

export default BusinessLayout
