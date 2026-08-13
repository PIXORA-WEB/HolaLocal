import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AccessibleDialog from '../common/AccessibleDialog.jsx'
import BrandLockup from '../common/BrandLockup.jsx'
import useAuthentication from '../../hooks/useAuthentication.js'

const navigationItems = [
  { key: 'overview', to: '/admin', end: true, icon: 'grid' },
  { key: 'businesses', to: '/admin/businesses', end: false, icon: 'briefcase' },
  { key: 'deletions', to: '/admin/account-deletions', end: false, icon: 'trash' },
]

function AdminNavigationIcon({ name }) {
  const paths = {
    grid: <><rect height="7" rx="1" width="7" x="3" y="3" /><rect height="7" rx="1" width="7" x="14" y="3" /><rect height="7" rx="1" width="7" x="3" y="14" /><rect height="7" rx="1" width="7" x="14" y="14" /></>,
    briefcase: <><rect height="13" rx="2" width="18" x="3" y="7" /><path d="M9 7V5h6v2M3 12h18" /></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" /></>,
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[name]}</svg>
}

function AdminNavigation({ adminOnly, onNavigate }) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('admin.navigation.label')} className="admin-navigation">
      <p className="admin-navigation__label">{t('admin.navigation.workspace')}</p>
      {navigationItems.filter((item) => item.key !== 'deletions' || adminOnly).map((item) => (
        <NavLink end={item.end} key={item.key} onClick={onNavigate} to={item.to}>
          <AdminNavigationIcon name={item.icon} />
          <span>{t(`admin.navigation.${item.key}`)}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function AdminAccount({ onSignOut }) {
  const { t } = useTranslation()
  const { user, userProfile } = useAuthentication()
  const displayName = userProfile?.displayName || user?.displayName || user?.email

  return (
    <div className="admin-account">
      <span aria-hidden="true" className="admin-account__avatar">
        {(displayName || 'A').trim().charAt(0).toLocaleUpperCase()}
      </span>
      <div className="admin-account__identity">
        <strong>{displayName}</strong>
        <span>{t('admin.navigation.signedIn')}</span>
      </div>
      <button className="admin-account__sign-out" onClick={onSignOut} type="button">
        {t('auth.logout')}
      </button>
    </div>
  )
}

function AdminBrand() {
  const { t } = useTranslation()
  return (
    <div className="admin-brand">
      <BrandLockup to="/admin" />
      <span>{t('admin.navigation.administration')}</span>
    </div>
  )
}

function AdminLayout() {
  const { t } = useTranslation()
  const { signOutUser, user } = useAuthentication()
  const [menuOpen, setMenuOpen] = useState(false)
  const [adminOnly, setAdminOnly] = useState(false)

  useEffect(() => {
    let active = true
    user?.getIdTokenResult().then((token) => active && setAdminOnly(token.claims?.admin === true)).catch(() => {})
    return () => { active = false }
  }, [user])

  async function handleSignOut() {
    setMenuOpen(false)
    await signOutUser()
  }

  return (
    <div className="admin-shell">
      <a className="skip-link" href="#admin-main-content">{t('common.skipToContent')}</a>

      <aside className="admin-sidebar">
        <AdminBrand />
        <AdminNavigation adminOnly={adminOnly} />
        <div className="admin-sidebar__footer">
          <Link className="admin-return-link" to="/">← {t('admin.navigation.returnWebsite')}</Link>
          <AdminAccount onSignOut={() => void handleSignOut()} />
        </div>
      </aside>

      <header className="admin-mobile-header">
        <AdminBrand />
        <button
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          aria-label={t('admin.navigation.openMenu')}
          className="admin-menu-button"
          onClick={() => setMenuOpen(true)}
          type="button"
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </header>

      <AccessibleDialog
        ariaLabelledBy="admin-mobile-menu-title"
        className="admin-mobile-drawer"
        onClose={() => setMenuOpen(false)}
        open={menuOpen}
      >
        <div className="admin-mobile-drawer__panel">
          <div className="admin-mobile-drawer__heading">
            <h2 id="admin-mobile-menu-title">{t('admin.navigation.menu')}</h2>
            <button autoFocus aria-label={t('admin.navigation.closeMenu')} onClick={() => setMenuOpen(false)} type="button">×</button>
          </div>
          <AdminNavigation adminOnly={adminOnly} onNavigate={() => setMenuOpen(false)} />
          <div className="admin-mobile-drawer__footer">
            <Link className="admin-return-link" onClick={() => setMenuOpen(false)} to="/">← {t('admin.navigation.returnWebsite')}</Link>
            <AdminAccount onSignOut={() => void handleSignOut()} />
          </div>
        </div>
      </AccessibleDialog>

      <main className="admin-main" id="admin-main-content">
        <Outlet />
      </main>
    </div>
  )
}

export default AdminLayout
