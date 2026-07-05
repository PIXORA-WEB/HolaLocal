import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAuthenticationErrorMessage } from '../../firebase/auth.js'
import useAuthentication from '../../hooks/useAuthentication.js'

function LoginPage() {
  const { t } = useTranslation()
  const { signIn } = useAuthentication()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await signIn(email.trim(), password)
      const destination = location.state?.from?.pathname ?? '/'
      navigate(destination, { replace: true })
    } catch (submissionError) {
      setError(getAuthenticationErrorMessage(submissionError))
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
          id="login-email"
          inputMode="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />

        <div className="auth-form__label-row">
          <label htmlFor="login-password">{t('auth.password')}</label>
          <Link to="/forgot-password">{t('auth.forgotPassword')}</Link>
        </div>
        <input
          autoComplete="current-password"
          id="login-password"
          minLength={6}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />

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
