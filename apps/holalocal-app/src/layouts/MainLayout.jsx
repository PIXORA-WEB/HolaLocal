import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import BrandLockup from '../components/common/BrandLockup.jsx'
import LanguageSwitcher from '../components/common/LanguageSwitcher.jsx'
import useAuthentication from '../hooks/useAuthentication.js'
import { getAccountDisplayName, getUserInitials } from '../utils/profile.js'

const navigationItems = [
  { icon: 'home', labelKey: 'nav.home', to: '/' },
  { icon: 'search', labelKey: 'nav.search', to: '/search' },
  { icon: 'messages', labelKey: 'nav.messages', to: '/messages' },
  { icon: 'profile', labelKey: 'nav.profile', to: '/profile' },
]

function NavigationIcon({ name }) {
  const paths = {
    home: <><path d="m3 11 9-7 9 7" /><path d="M5.5 10v10h13V10M9.5 20v-6h5v6" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></>,
    messages: <><path d="M4 5.5h16v11H9l-5 3v-14Z" /><path d="M8 10h8M8 13h5" /></>,
    profile: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6" /></>,
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  )
}

function MainLayout() {
  const { t } = useTranslation()
  const { user, userProfile } = useAuthentication()
  const initials = user
    ? getUserInitials(getAccountDisplayName(userProfile, user, t('profile.accountFallback')))
    : ''

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <BrandLockup />
          <div className="layout-actions">
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="app-content">
        <Outlet />
      </main>

      <nav className="bottom-navigation" aria-label={t('nav.primary')}>
        {navigationItems.map(({ icon, labelKey, to }) => (
          <NavLink
            className={({ isActive }) =>
              `bottom-navigation__link${isActive ? ' is-active' : ''}`
            }
            end={to === '/'}
            key={to}
            to={to}
          >
            {icon === 'profile' && user ? (
              <span className="bottom-navigation__avatar" aria-hidden="true">{initials}</span>
            ) : (
              <NavigationIcon name={icon} />
            )}
            <span>{t(labelKey)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export default MainLayout
