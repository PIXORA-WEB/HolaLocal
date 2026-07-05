import { useEffect, useRef } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthentication from '../../hooks/useAuthentication.js'
import BrandLockup from '../common/BrandLockup.jsx'
import LanguageSwitcher from '../common/LanguageSwitcher.jsx'
import SiteFooter from './SiteFooter.jsx'

function SiteLayout() {
  const { t } = useTranslation()
  const { signOutUser, user, userProfile } = useAuthentication()
  const accountMenuRef = useRef(null)
  const mobileMenuRef = useRef(null)
  const displayName =
    userProfile?.displayName?.trim() ||
    user?.displayName?.trim() ||
    user?.email?.split('@')[0] ||
    t('account.fallback')
  const firstName = userProfile?.firstName?.trim() || displayName.split(/\s+/)[0]
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
  const hasBusinessAccess = userProfile?.roles?.includes('business') === true

  useEffect(() => {
    function handlePointerDown(event) {
      const menu = accountMenuRef.current
      if (menu?.open && !menu.contains(event.target)) menu.removeAttribute('open')
    }

    function handleKeyDown(event) {
      const menu = accountMenuRef.current
      if (event.key !== 'Escape' || !menu?.open) return

      menu.removeAttribute('open')
      menu.querySelector('summary')?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  function closeMobileMenu() {
    mobileMenuRef.current?.removeAttribute('open')
  }

  function handleMobileSignOut() {
    closeMobileMenu()
    void signOutUser()
  }

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">{t('common.skipToContent')}</a>
      <header className="site-header">
        <div className="site-header__inner">
          <BrandLockup />
          <nav className="site-navigation" aria-label={t('nav.primary')}>
            <Link to="/#early-access">{t('earlyAccess.navigation')}</Link>
          </nav>
          <div className="site-header__actions">
            {!user && (
              <div className="signed-out-actions">
                <NavLink className="site-navigation__signin" to="/login">{t('account.signIn')}</NavLink>
                <NavLink className="site-navigation__cta" to="/register">{t('account.getStarted')}</NavLink>
              </div>
            )}
            <LanguageSwitcher />
            {user && (
              <details className="account-menu" ref={accountMenuRef}>
                <summary>
                  <span className="account-menu__avatar" aria-hidden="true">{initials}</span>
                  <span>{t('account.greeting', { name: firstName })}</span>
                </summary>
                <nav aria-label={t('account.navigationLabel')}>
                  <NavLink to="/profile">{t('account.profile')}</NavLink>
                  {hasBusinessAccess && (
                    <NavLink to="/business/dashboard">{t('account.business')}</NavLink>
                  )}
                  <NavLink to="/messages">{t('account.messages')}</NavLink>
                  <button onClick={() => void signOutUser()} type="button">
                    {t('auth.logout')}
                  </button>
                </nav>
              </details>
            )}
            <details className="mobile-navigation" ref={mobileMenuRef}>
              <summary aria-label={t('nav.primary')}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </summary>
              <nav aria-label={t('nav.primary')}>
                <Link onClick={closeMobileMenu} to="/#early-access">{t('earlyAccess.navigation')}</Link>
                {user && (
                  <>
                    <NavLink onClick={closeMobileMenu} to="/profile">{t('account.profile')}</NavLink>
                    {hasBusinessAccess && (
                      <>
                        <NavLink onClick={closeMobileMenu} to="/business/dashboard">{t('account.business')}</NavLink>
                        <NavLink onClick={closeMobileMenu} to="/business/subscription">{t('business.subscription')}</NavLink>
                      </>
                    )}
                    <NavLink onClick={closeMobileMenu} to="/messages">{t('account.messages')}</NavLink>
                    <button onClick={handleMobileSignOut} type="button">{t('auth.logout')}</button>
                  </>
                )}
              </nav>
            </details>
          </div>
        </div>
      </header>

      <main className="site-content" id="main-content">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}

export default SiteLayout
