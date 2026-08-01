import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAuthenticationErrorMessage } from '../../firebase/auth.js'
import useAuthentication from '../../hooks/useAuthentication.js'
import { POLICY_VERSION } from '../../services/userPayloads.js'

function RegisterPage() {
  const { i18n, t } = useTranslation()
  const { signUp } = useAuthentication()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!termsAccepted || !privacyAccepted) {
      setError(t('auth.registration.consentRequired'))
      return
    }

    setSubmitting(true)

    try {
      const registration = await signUp(email.trim(), password, {
        termsAccepted: true,
        termsVersion: POLICY_VERSION,
        privacyAccepted: true,
        privacyVersion: POLICY_VERSION,
        preferredLocale: i18n.resolvedLanguage,
      })
      navigate('/verify-email', { replace: true, state: registration })
    } catch (submissionError) {
      setError(getAuthenticationErrorMessage(submissionError, t))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-card" aria-labelledby="register-title">
      <div className="auth-card__heading">
        <p className="auth-card__eyebrow">Join the community</p>
        <h1 id="register-title">Create your account</h1>
        <p>Start with your email, then tell us how you plan to use HolaLocal.</p>
      </div>

      {error && <p className="form-message form-message--error" role="alert">{error}</p>}

      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="register-email">{t('auth.email')}</label>
        <input
          autoComplete="email"
          id="register-email"
          inputMode="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />

        <label htmlFor="register-password">{t('auth.password')}</label>
        <input
          autoComplete="new-password"
          id="register-password"
          minLength={6}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
        <p className="auth-form__hint">Use at least six characters.</p>

        <label htmlFor="register-confirm-password">Confirm password</label>
        <input
          autoComplete="new-password"
          id="register-confirm-password"
          minLength={6}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          type="password"
          value={confirmPassword}
        />

        <fieldset>
          <legend>{t('auth.registration.consentLegend')}</legend>
          <label>
            <input checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} required type="checkbox" />
            <span>{t('auth.registration.termsPrefix')} <a href="https://www.holalocal.es/terms" rel="noreferrer" target="_blank">{t('auth.registration.terms')}</a></span>
          </label>
          <label>
            <input checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} required type="checkbox" />
            <span>{t('auth.registration.privacyPrefix')} <a href="https://www.holalocal.es/privacy" rel="noreferrer" target="_blank">{t('auth.registration.privacy')}</a></span>
          </label>
        </fieldset>

        <button className="button button--primary" disabled={submitting || !termsAccepted || !privacyAccepted} type="submit">
          {submitting ? t('common.loading') : t('auth.register')}
        </button>
      </form>

      <p className="auth-card__footer">
        Already have an account? <Link to="/login">{t('auth.login')}</Link>
      </p>
    </section>
  )
}

export default RegisterPage
