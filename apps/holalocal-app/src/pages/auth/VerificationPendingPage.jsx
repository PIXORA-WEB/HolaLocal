import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAuthenticationErrorMessage } from '../../firebase/auth.js'
import useAuthentication from '../../hooks/useAuthentication.js'

function VerificationPendingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { emailVerified, refreshEmailVerification, resendVerificationEmail, signOutUser, user } = useAuthentication()
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [resendDisabled, setResendDisabled] = useState(false)

  useEffect(() => {
    if (emailVerified) navigate('/complete-profile', { replace: true })
  }, [emailVerified, navigate])

  async function check() {
    setBusy('check'); setError('')
    try {
      if (await refreshEmailVerification()) navigate('/complete-profile', { replace: true })
      else setMessage(t('auth.verification.notVerified'))
    } catch (caught) {
      setError(getAuthenticationErrorMessage(caught, t))
    } finally { setBusy('') }
  }

  async function resend() {
    setBusy('resend'); setError('')
    try {
      await resendVerificationEmail()
      setResendDisabled(true)
      setMessage(t('auth.verification.resent'))
    } catch (caught) {
      setError(getAuthenticationErrorMessage(caught, t))
    } finally { setBusy('') }
  }

  return (
    <section className="auth-card" aria-labelledby="verification-title">
      <div className="auth-card__heading">
        <p className="auth-card__eyebrow">{t('auth.verification.eyebrow')}</p>
        <h1 id="verification-title">{t('auth.verification.title')}</h1>
        <p>{t('auth.verification.description', { email: user?.email })}</p>
        <p>{t('auth.verification.returnInstruction')}</p>
      </div>
      {message && <p className="form-message form-message--success" role="status">{message}</p>}
      {error && <p className="form-message form-message--error" role="alert">{error}</p>}
      <button className="button button--primary" disabled={Boolean(busy)} onClick={check} type="button">
        {busy === 'check' ? t('common.loading') : t('auth.verification.check')}
      </button>
      <button className="button button--secondary" disabled={Boolean(busy) || resendDisabled} onClick={resend} type="button">
        {busy === 'resend' ? t('common.loading') : t('auth.verification.resend')}
      </button>
      <button className="button button--text" disabled={Boolean(busy)} onClick={signOutUser} type="button">
        {t('auth.logout')}
      </button>
    </section>
  )
}

export default VerificationPendingPage
