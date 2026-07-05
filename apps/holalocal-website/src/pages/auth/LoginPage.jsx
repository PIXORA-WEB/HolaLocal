import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAuthenticationErrorMessage } from '../../firebase/auth.js'
import FormFieldError from '../../components/common/FormFieldError.jsx'
import PasswordField from '../../components/common/PasswordField.jsx'
import useAuthentication from '../../hooks/useAuthentication.js'

function LoginPage() {
  const { t } = useTranslation()
  const { signIn } = useAuthentication()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    const nextErrors = {}
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) nextErrors.email = t('validation.email')
    if (!password) nextErrors.password = t('validation.passwordRequired')
    setFieldErrors(nextErrors)
    const firstInvalidField = ['email', 'password'].find((field) => nextErrors[field])
    if (firstInvalidField) {
      document.getElementById(`login-${firstInvalidField}`)?.focus()
      return
    }
    setSubmitting(true)

    try {
      await signIn(email.trim(), password)
      const returnLocation = location.state?.from
      const destination = returnLocation
        ? `${returnLocation.pathname}${returnLocation.search ?? ''}${returnLocation.hash ?? ''}`
        : '/'
      navigate(destination, { replace: true })
    } catch (submissionError) {
      setError(getAuthenticationErrorMessage(submissionError, t))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-card" aria-labelledby="login-title">
      <div className="auth-card__heading">
        <p className="auth-card__eyebrow">{t('auth.welcomeBack')}</p>
        <h1 id="login-title">{t('auth.loginTitle')}</h1>
        <p>{t('auth.loginDescription')}</p>
      </div>

      {error && <p className="form-message form-message--error" role="alert">{error}</p>}

      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="login-email">{t('auth.email')}</label>
        <input
          autoComplete="email"
          aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
          aria-invalid={Boolean(fieldErrors.email)}
          id="login-email"
          inputMode="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
        <FormFieldError id="login-email-error" message={fieldErrors.email} />

        <PasswordField
          autoComplete="current-password"
          error={fieldErrors.password}
          hideLabel={t('auth.passwordUx.hide')}
          id="login-password"
          label={t('auth.password')}
          onChange={(event) => setPassword(event.target.value)}
          showLabel={t('auth.passwordUx.show')}
          value={password}
        />
        <Link className="auth-form__recovery-link" to="/forgot-password">{t('auth.forgotPassword')}</Link>

        <button className="button button--primary" disabled={submitting} type="submit">
          {submitting ? t('auth.loggingIn') : t('auth.login')}
        </button>
      </form>

      <p className="auth-card__footer">
        {t('auth.newUser')} <Link to="/register">{t('auth.createAccount')}</Link>
      </p>
    </section>
  )
}

export default LoginPage
