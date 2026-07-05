import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import logoIcon from '../../assets/logos/logo-icon-display.png'
import { getAuthenticationErrorMessage } from '../../firebase/auth.js'
import useAuthentication from '../../hooks/useAuthentication.js'
import { brand } from '../../utils/brand.js'

const onboardingOptions = ['customer', 'business', 'both']

function OnboardingPage() {
  const { t } = useTranslation()
  const { completeOnboarding, sessionError } = useAuthentication()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const intent = searchParams.get('intent')
  const [accountType, setAccountType] = useState(
    intent === 'business' || intent === 'customer' ? intent : '',
  )
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!accountType) {
      setError(t('onboarding.required'))
      document.getElementById('onboarding-customer')?.focus()
      return
    }

    const requiresBusinessProfile = accountType === 'business' || accountType === 'both'
    setSubmitting(true)

    try {
      await completeOnboarding(accountType)

      navigate(requiresBusinessProfile ? '/business/dashboard' : '/profile', { replace: true })
    } catch (submissionError) {
      setError(getAuthenticationErrorMessage(submissionError, t))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-card onboarding-card" aria-labelledby="onboarding-title">
      <div className="onboarding-card__heading">
        <img className="onboarding-card__logo" decoding="async" height="200" src={logoIcon} alt={`${brand.name} logo`} width="184" />
        <p className="auth-card__eyebrow">{t('onboarding.eyebrow')}</p>
        <h1 id="onboarding-title">{t('onboarding.title')}</h1>
        <p>{t('onboarding.description')}</p>
      </div>

      {(error || sessionError) && (
        <p className="form-message form-message--error" role="alert">
          {error || t(sessionError)}
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <fieldset className="onboarding-options">
          <legend className="visually-hidden">{t('onboarding.legend')}</legend>
          {onboardingOptions.map((option) => (
            <label className="onboarding-option" key={option}>
              <input
                checked={accountType === option}
                id={`onboarding-${option}`}
                name="accountType"
                onChange={() => setAccountType(option)}
                type="radio"
                value={option}
              />
              <span>
                <strong>{t(`onboarding.options.${option}.title`)}</strong>
                <small>{t(`onboarding.options.${option}.description`)}</small>
              </span>
            </label>
          ))}
        </fieldset>

        <button className="button button--primary onboarding-card__submit" disabled={submitting} type="submit">
          {submitting ? t('common.loading') : t('common.continue')}
        </button>
      </form>
    </section>
  )
}

export default OnboardingPage
