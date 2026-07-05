import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAuthenticationErrorMessage } from '../../firebase/auth.js'
import useAuthentication from '../../hooks/useAuthentication.js'
import FormFieldError from '../../components/common/FormFieldError.jsx'

function ForgotPasswordPage() {
  const { t } = useTranslation()
  const { resetPassword } = useAuthentication()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fieldError, setFieldError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setFieldError(t('validation.email'))
      document.getElementById('reset-email')?.focus()
      return
    }
    setFieldError('')
    setSent(false)
    setSubmitting(true)

    try {
      await resetPassword(email.trim())
      setSent(true)
    } catch (submissionError) {
      setError(getAuthenticationErrorMessage(submissionError, t))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-card" aria-labelledby="reset-title">
      <div className="auth-card__heading">
        <p className="auth-card__eyebrow">{t('auth.recovery.eyebrow')}</p>
        <h1 id="reset-title">{t('auth.forgotPassword')}</h1>
        <p>{t('auth.recovery.description')}</p>
      </div>

      {error && <p className="form-message form-message--error" role="alert">{error}</p>}
      {sent && (
        <p className="form-message form-message--success" role="status">
          {t('auth.recovery.sent')}
        </p>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="reset-email">{t('auth.email')}</label>
        <input
          autoComplete="email"
          aria-describedby={fieldError ? 'reset-email-error' : undefined}
          aria-invalid={Boolean(fieldError)}
          id="reset-email"
          inputMode="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
        <FormFieldError id="reset-email-error" message={fieldError} />

        <button className="button button--primary" disabled={submitting} type="submit">
          {submitting ? t('common.loading') : t('auth.recovery.action')}
        </button>
      </form>

      <p className="auth-card__footer"><Link to="/login">{t('auth.login')}</Link></p>
    </section>
  )
}

export default ForgotPasswordPage
