import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthentication from '../../hooks/useAuthentication.js'
import BrandLockup from '../common/BrandLockup.jsx'
import LanguageSwitcher from '../common/LanguageSwitcher.jsx'

function SiteHeader() {
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
    function closeMenu(menu, restoreFocus = false) {
      if (!menu?.open) return
      menu.removeAttribute('open')
      if (restoreFocus) menu.querySelector('summary')?.focus()
    }

    function handlePointerDown(event) {
      if (!accountMenuRef.current?.contains(event.target)) closeMenu(accountMenuRef.current)
      if (!mobileMenuRef.current?.contains(event.target)) closeMenu(mobileMenuRef.current)
    }

    function handleKeyDown(event) {
      if (event.key !== 'Escape') return
      closeMenu(accountMenuRef.current, true)
      closeMenu(mobileMenuRef.current, true)
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
    <header className="site-header">
      <div className="site-header__inner">
        <BrandLockup />
        <div className="site-header__actions">
          {!user && <NavLink className="site-header__signin" to="/login">{t('account.signIn')}</NavLink>}
          <LanguageSwitcher />
          {user && (
            <details className="account-menu" ref={accountMenuRef}>
              <summary>
                <span className="account-menu__avatar" aria-hidden="true">{initials}</span>
                <span>{t('account.greeting', { name: firstName })}</span>
              </summary>
              <nav aria-label={t('account.navigationLabel')}>
                <NavLink to="/profile">{t('account.profile')}</NavLink>
                {hasBusinessAccess && <NavLink to="/business/dashboard">{t('account.business')}</NavLink>}
                <NavLink to="/messages">{t('account.messages')}</NavLink>
                <button onClick={() => void signOutUser()} type="button">{t('auth.logout')}</button>
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
              {!user ? (
                <NavLink onClick={closeMobileMenu} to="/login">{t('account.signIn')}</NavLink>
              ) : (
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
  )
}

export default SiteHeader
