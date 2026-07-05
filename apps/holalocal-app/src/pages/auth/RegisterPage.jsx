import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAuthenticationErrorMessage } from '../../firebase/auth.js'
import useAuthentication from '../../hooks/useAuthentication.js'

function RegisterPage() {
  const { t } = useTranslation()
  const { signUp } = useAuthentication()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)

    try {
      await signUp(email.trim(), password)
      navigate('/complete-profile', { replace: true })
    } catch (submissionError) {
      setError(getAuthenticationErrorMessage(submissionError))
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

        <button className="button button--primary" disabled={submitting} type="submit">
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
