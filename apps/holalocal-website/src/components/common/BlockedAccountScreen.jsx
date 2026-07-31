import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import useAuthentication from '../../hooks/useAuthentication.js'
import { getAuthenticationErrorMessage } from '../../firebase/auth.js'

export function ProfileUnavailableScreen() {
  const { t } = useTranslation()
  const { profileLoading, retryUserProfile, signOutUser } = useAuthentication()
  const [signOutError, setSignOutError] = useState('')

  const handleSignOut = async () => {
    setSignOutError('')
    try {
      await signOutUser()
    } catch (error) {
      setSignOutError(getAuthenticationErrorMessage(error, t))
    }
  }

  return (
    <main className="application-error" role="main">
      <section className="auth-card" aria-labelledby="profile-unavailable-title">
        <div className="auth-card__heading">
          <p className="auth-card__eyebrow">HolaLocal</p>
          <h1 id="profile-unavailable-title">{t('auth.errors.profileLoad')}</h1>
          <p>{t('account.profileUnavailable.description')}</p>
        </div>
        {signOutError && (
          <p className="form-error" role="alert">
            {signOutError}
          </p>
        )}
        <div className="auth-actions">
          <button
            className="button button--primary"
            disabled={profileLoading}
            onClick={() => void retryUserProfile()}
            type="button"
          >
            {profileLoading ? t('common.loading') : t('common.retry')}
          </button>
          <button className="button button--secondary" onClick={() => void handleSignOut()} type="button">
            {t('auth.logout')}
          </button>
        </div>
      </section>
    </main>
  )
}

function BlockedAccountScreen({ accountStatus }) {
  const { t } = useTranslation()
  const { signOutUser } = useAuthentication()
  const [signOutError, setSignOutError] = useState('')
  const [signingOut, setSigningOut] = useState(false)
  const statusKey = ['suspended', 'deletion_pending', 'deleted'].includes(accountStatus)
    ? accountStatus
    : 'unavailable'

  async function handleSignOut() {
    setSignOutError('')
    setSigningOut(true)
    try {
      await signOutUser()
    } catch (error) {
      setSignOutError(getAuthenticationErrorMessage(error, t))
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <main className="application-error" role="main">
      <section className="auth-card" aria-labelledby="blocked-account-title">
        <div className="auth-card__heading">
          <p className="auth-card__eyebrow">HolaLocal</p>
          <h1 id="blocked-account-title">{t('account.blocked.title')}</h1>
          <p>{t(`account.blocked.status.${statusKey}`)}</p>
          <p>{t('account.blocked.help')}</p>
        </div>
        {signOutError && <p className="form-error" role="alert">{signOutError}</p>}
        <button
          aria-busy={signingOut || undefined}
          className="button button--primary"
          disabled={signingOut}
          onClick={() => void handleSignOut()}
          type="button"
        >
          {signingOut ? t('common.loading') : t('auth.logout')}
        </button>
      </section>
    </main>
  )
}

export default BlockedAccountScreen
