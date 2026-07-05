import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAuthenticationErrorMessage } from '../../firebase/auth.js'
import useAuthentication from '../../hooks/useAuthentication.js'

function ForgotPasswordPage() {
  const { t } = useTranslation()
  const { resetPassword } = useAuthentication()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSent(false)
    setSubmitting(true)

    try {
      await resetPassword(email.trim())
      setSent(true)
    } catch (submissionError) {
      setError(getAuthenticationErrorMessage(submissionError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-card" aria-labelledby="reset-title">
      <div className="auth-card__heading">
        <p className="auth-card__eyebrow">Account recovery</p>
        <h1 id="reset-title">{t('auth.forgotPassword')}</h1>
        <p>We will send password reset instructions to your email address.</p>
      </div>

      {error && <p className="form-message form-message--error" role="alert">{error}</p>}
      {sent && (
        <p className="form-message form-message--success" role="status">
          If an account exists for that email, reset instructions have been sent.
        </p>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="reset-email">{t('auth.email')}</label>
        <input
          autoComplete="email"
          id="reset-email"
          inputMode="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />

        <button className="button button--primary" disabled={submitting} type="submit">
          {submitting ? t('common.loading') : 'Send reset link'}
        </button>
      </form>

      <p className="auth-card__footer"><Link to="/login">{t('auth.login')}</Link></p>
    </section>
  )
}

export default ForgotPasswordPage
