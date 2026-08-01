import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAuthenticationErrorMessage } from '../../firebase/auth.js'
import useAuthentication from '../../hooks/useAuthentication.js'
import BrandLockup from '../common/BrandLockup.jsx'
import LanguageSwitcher from '../common/LanguageSwitcher.jsx'
import useUnreadMessageCount from '../../hooks/useUnreadMessageCount.js'

const publicNavigationLinks = [
  { labelKey: 'nav.home', to: '/' },
  { labelKey: 'nav.findServices', to: '/services' },
  { labelKey: 'footer.contact', to: '/contact' },
]

function SiteHeader() {
  const { t } = useTranslation()
  const location = useLocation()
  const { signOutUser, user, userProfile } = useAuthentication()
  const accountMenuRef = useRef(null)
  const mobileMenuRef = useRef(null)
  const mountedRef = useRef(true)
  const signOutPendingRef = useRef(false)
  const [signOutError, setSignOutError] = useState('')
  const [signingOut, setSigningOut] = useState(false)
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
  const unreadMessageCount = useUnreadMessageCount(user?.uid)

  function renderUnreadBadge() {
    if (unreadMessageCount <= 0) return null
    return (
      <span className="message-unread-badge" aria-label={t('messages.unreadCount', { count: unreadMessageCount })}>
        {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
      </span>
    )
  }

  const closeMobileMenu = useCallback(function closeMobileMenu() {
    mobileMenuRef.current?.removeAttribute('open')
  }, [])

  useEffect(() => {
    mountedRef.current = true
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
      mountedRef.current = false
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    closeMobileMenu()
  }, [closeMobileMenu, location.pathname, location.search])

  async function handleSignOut() {
    if (signOutPendingRef.current) return

    signOutPendingRef.current = true
    setSignOutError('')
    setSigningOut(true)
    try {
      await signOutUser()
      accountMenuRef.current?.removeAttribute('open')
      closeMobileMenu()
    } catch (signOutFailure) {
      if (mountedRef.current) {
        setSignOutError(getAuthenticationErrorMessage(signOutFailure, t))
      }
    } finally {
      signOutPendingRef.current = false
      if (mountedRef.current) setSigningOut(false)
    }
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <BrandLockup />
        <nav className="site-header__nav" aria-label={t('nav.primary')}>
          {publicNavigationLinks.map((link) => (
            <NavLink end={link.to === '/'} key={link.to} to={link.to}>
              {t(link.labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className="site-header__actions">
          {!user && <NavLink className="site-header__signin" to="/login">{t('account.signIn')}</NavLink>}
          {!user && <NavLink className="site-header__join" to="/register">{t('nav.join')}</NavLink>}
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
                <NavLink to="/messages">
                  <span>{t('account.messages')}</span>
                  {renderUnreadBadge()}
                </NavLink>
                <button
                  aria-busy={signingOut || undefined}
                  disabled={signingOut}
                  onClick={() => void handleSignOut()}
                  type="button"
                >
                  {signingOut ? t('common.loading') : t('auth.logout')}
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
              {!user ? (
                <>
                  {publicNavigationLinks.map((link) => (
                    <NavLink end={link.to === '/'} key={link.to} onClick={closeMobileMenu} to={link.to}>
                      {t(link.labelKey)}
                    </NavLink>
                  ))}
                  <NavLink onClick={closeMobileMenu} to="/login">{t('account.signIn')}</NavLink>
                  <NavLink onClick={closeMobileMenu} to="/register">{t('nav.join')}</NavLink>
                </>
              ) : (
                <>
                  <div className="mobile-navigation__group">
                    {publicNavigationLinks.map((link) => (
                      <NavLink end={link.to === '/'} key={link.to} onClick={closeMobileMenu} to={link.to}>
                        {t(link.labelKey)}
                      </NavLink>
                    ))}
                  </div>
                  <div className="mobile-navigation__group mobile-navigation__group--account">
                    <NavLink onClick={closeMobileMenu} to="/profile">{t('account.profile')}</NavLink>
                    {hasBusinessAccess && (
                      <>
                        <NavLink onClick={closeMobileMenu} to="/business/dashboard">{t('account.business')}</NavLink>
                        <NavLink onClick={closeMobileMenu} to="/business/subscription">{t('business.subscription')}</NavLink>
                      </>
                    )}
                    <NavLink onClick={closeMobileMenu} to="/messages">
                      <span>{t('account.messages')}</span>
                      {renderUnreadBadge()}
                    </NavLink>
                    <button
                      aria-busy={signingOut || undefined}
                      disabled={signingOut}
                      onClick={() => void handleSignOut()}
                      type="button"
                    >
                      {signingOut ? t('common.loading') : t('auth.logout')}
                    </button>
                  </div>
                </>
              )}
            </nav>
          </details>
        </div>
      </div>
      {signOutError && (
        <p className="site-header__auth-error form-message form-message--error" role="alert">
          {signOutError}
        </p>
      )}
    </header>
  )
}

export default SiteHeader
