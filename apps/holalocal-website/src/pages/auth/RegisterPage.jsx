import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAuthenticationErrorMessage } from '../../firebase/auth.js'
import FormFieldError from '../../components/common/FormFieldError.jsx'
import PasswordField from '../../components/common/PasswordField.jsx'
import useAuthentication from '../../hooks/useAuthentication.js'
import { POLICY_VERSION } from '../../utils/policies.js'

function RegisterPage() {
  const { t } = useTranslation()
  const { signUp } = useAuthentication()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    const nextErrors = {}

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) nextErrors.email = t('validation.email')
    if (password.length < 8) nextErrors.password = t('validation.passwordLength')
    if (password !== confirmPassword) nextErrors.confirmPassword = t('auth.registration.passwordMismatch')
    if (!termsAccepted || !privacyAccepted) nextErrors.consent = t('auth.registration.consentRequired')
    setFieldErrors(nextErrors)
    const firstInvalidField = ['email', 'password', 'confirmPassword', 'consent'].find(
      (field) => nextErrors[field],
    )
    if (firstInvalidField) {
      document.getElementById(`register-${firstInvalidField}`)?.focus()
      return
    }

    setSubmitting(true)

    try {
      const registration = await signUp(email.trim(), password, {
        termsAccepted,
        termsVersion: POLICY_VERSION,
        privacyAccepted,
        privacyVersion: POLICY_VERSION,
      })
      const intent = searchParams.get('intent')
      navigate(intent ? `/verify-email?intent=${intent}` : '/verify-email', {
        replace: true,
        state: { verificationEmailSent: registration.verificationEmailSent },
      })
    } catch (submissionError) {
      setError(getAuthenticationErrorMessage(submissionError, t))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-card" aria-labelledby="register-title">
      <div className="auth-card__heading">
        <p className="auth-card__eyebrow">{t('auth.registration.eyebrow')}</p>
        <h1 id="register-title">{t('auth.registration.title')}</h1>
        <p>{t('auth.registration.description')}</p>
      </div>

      {error && <p className="form-message form-message--error" role="alert">{error}</p>}

      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="register-email">{t('auth.email')}</label>
        <input
          autoComplete="email"
          aria-describedby={fieldErrors.email ? 'register-email-error' : undefined}
          aria-invalid={Boolean(fieldErrors.email)}
          id="register-email"
          inputMode="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
        <FormFieldError id="register-email-error" message={fieldErrors.email} />

        <PasswordField
          autoComplete="new-password"
          error={fieldErrors.password}
          hideLabel={t('auth.passwordUx.hide')}
          hint={t('auth.registration.passwordHint')}
          id="register-password"
          label={t('auth.password')}
          minLength={8}
          onChange={(event) => setPassword(event.target.value)}
          showLabel={t('auth.passwordUx.show')}
          value={password}
        />

        <PasswordField
          autoComplete="new-password"
          error={fieldErrors.confirmPassword}
          hideLabel={t('auth.passwordUx.hide')}
          id="register-confirm-password"
          label={t('auth.registration.confirmPassword')}
          minLength={8}
          onChange={(event) => setConfirmPassword(event.target.value)}
          showLabel={t('auth.passwordUx.show')}
          value={confirmPassword}
        />

        <fieldset
          aria-describedby={fieldErrors.consent ? 'register-consent-error' : undefined}
          aria-invalid={Boolean(fieldErrors.consent)}
          className="registration-consent"
          id="register-consent"
          tabIndex={fieldErrors.consent ? -1 : undefined}
        >
          <legend>{t('auth.registration.consentLegend')}</legend>
          <label>
            <input
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              required
              type="checkbox"
            />
            <span>
              {t('auth.registration.termsPrefix')}{' '}
              <Link
                onClick={(event) => event.stopPropagation()}
                rel="noreferrer"
                target="_blank"
                to="/terms"
              >
                {t('footer.terms')}
              </Link>
            </span>
          </label>
          <label>
            <input
              checked={privacyAccepted}
              onChange={(event) => setPrivacyAccepted(event.target.checked)}
              required
              type="checkbox"
            />
            <span>
              {t('auth.registration.privacyPrefix')}{' '}
              <Link
                onClick={(event) => event.stopPropagation()}
                rel="noreferrer"
                target="_blank"
                to="/privacy"
              >
                {t('footer.privacy')}
              </Link>
            </span>
          </label>
          <FormFieldError id="register-consent-error" message={fieldErrors.consent} />
        </fieldset>

        <button
          className="button button--primary"
          disabled={submitting || !termsAccepted || !privacyAccepted}
          type="submit"
        >
          {submitting ? t('common.loading') : t('auth.register')}
        </button>
      </form>

      <p className="auth-card__footer">
        {t('auth.registration.existingAccount')}{' '}
        <Link to="/login">{t('auth.login')}</Link>
      </p>
    </section>
  )
}

export default RegisterPage
