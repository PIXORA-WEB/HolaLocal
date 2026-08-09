import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAuthenticationErrorMessage } from '../../firebase/auth.js'
import useAuthentication from '../../hooks/useAuthentication.js'

function VerificationPendingPage() {
  const { t } = useTranslation()
  const {
    emailVerified,
    refreshEmailVerification,
    resendVerificationEmail,
    signOutUser,
    user,
  } = useAuthentication()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [checking, setChecking] = useState(false)
  const [resending, setResending] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState(
    location.state?.verificationEmailSent === false
      ? t('auth.verification.initialSendFailed')
      : t('auth.verification.sent'),
  )
  const intent = searchParams.get('intent')
  const destination = intent ? `/complete-profile?intent=${intent}` : '/complete-profile'

  useEffect(() => {
    if (emailVerified) navigate(destination, {
      replace: true,
      state: { from: location.state?.from },
    })
  }, [destination, emailVerified, location.state?.from, navigate])

  async function checkVerification() {
    setError('')
    setChecking(true)
    try {
      const verified = await refreshEmailVerification()
      if (verified) navigate(destination, {
        replace: true,
        state: { from: location.state?.from },
      })
      else setMessage(t('auth.verification.notVerified'))
    } catch (verificationError) {
      setError(getAuthenticationErrorMessage(verificationError, t))
    } finally {
      setChecking(false)
    }
  }

  async function resendVerification() {
    setError('')
    setResending(true)
    try {
      await resendVerificationEmail()
      setMessage(t('auth.verification.resent'))
    } catch (verificationError) {
      setError(getAuthenticationErrorMessage(verificationError, t))
    } finally {
      setResending(false)
    }
  }

  async function handleSignOut() {
    setError('')
    setSigningOut(true)
    try {
      await signOutUser()
    } catch (signOutError) {
      setError(getAuthenticationErrorMessage(signOutError, t))
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <section className="auth-card verification-card" aria-labelledby="verification-title">
      <div className="auth-card__heading">
        <p className="auth-card__eyebrow">{t('auth.verification.eyebrow')}</p>
        <h1 id="verification-title">{t('auth.verification.title')}</h1>
        <p>{t('auth.verification.description', { email: user?.email })}</p>
      </div>

      {message && <p className="form-message form-message--success" role="status">{message}</p>}
      {error && <p className="form-message form-message--error" role="alert">{error}</p>}

      <div className="verification-card__actions">
        <button
          className="button button--primary"
          disabled={checking || resending || signingOut}
          onClick={() => void checkVerification()}
          type="button"
        >
          {checking ? t('common.loading') : t('auth.verification.checkedAction')}
        </button>
        <button
          className="button button--secondary"
          disabled={checking || resending || signingOut}
          onClick={() => void resendVerification()}
          type="button"
        >
          {resending ? t('auth.verification.resending') : t('auth.verification.resend')}
        </button>
        <button
          aria-busy={signingOut || undefined}
          className="button button--text"
          disabled={signingOut}
          onClick={() => void handleSignOut()}
          type="button"
        >
          {signingOut ? t('common.loading') : t('auth.logout')}
        </button>
      </div>
    </section>
  )
}

export default VerificationPendingPage
