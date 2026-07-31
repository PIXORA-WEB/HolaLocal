import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import BrandLockup from '../common/BrandLockup.jsx'
import useAuthentication from '../../hooks/useAuthentication.js'

function AdminLayout() {
  const { t } = useTranslation()
  const { signOutUser } = useAuthentication()
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <BrandLockup />
        <nav aria-label={t('admin.navigation.label')}>
          <NavLink end to="/admin">{t('admin.navigation.overview')}</NavLink>
          <NavLink to="/admin/businesses">{t('admin.navigation.businesses')}</NavLink>
        </nav>
        <button className="button button--secondary" onClick={() => void signOutUser()} type="button">
          {t('nav.signOut')}
        </button>
      </header>
      <main className="admin-main" id="main-content">
        <Outlet />
      </main>
    </div>
  )
}

export default AdminLayout
