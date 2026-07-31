import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import logoIcon from '../../assets/logos/logo-icon-display.png'
import RecoveryMessage from '../../components/common/RecoveryMessage.jsx'
import useAuthentication from '../../hooks/useAuthentication.js'
import {
  classifyFrontendError,
  getRecoveryActionTranslationKey,
} from '../../utils/frontendErrors.js'

const onboardingOptions = ['customer', 'business', 'both']

function OnboardingPage() {
  const { t } = useTranslation()
  const { completeOnboarding, sessionError, signOutUser } = useAuthentication()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const intent = searchParams.get('intent')
  const [accountType, setAccountType] = useState(
    intent === 'business' || intent === 'customer' ? intent : '',
  )
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [recoveryPending, setRecoveryPending] = useState(false)

  async function handleRecoverySignOut() {
    setRecoveryPending(true)
    try {
      await signOutUser()
      navigate('/login')
    } catch (signOutError) {
      setError(classifyFrontendError(signOutError, {
        domain: 'workflow',
        fallbackType: 'ACCOUNT_TRANSITION_FAILED',
      }))
    } finally {
      setRecoveryPending(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)

    if (!accountType) {
      setError({
        translationKey: 'onboarding.required',
        recovery: 'edit',
      })
      document.getElementById('onboarding-customer')?.focus()
      return
    }

    const requiresBusinessProfile = accountType === 'business' || accountType === 'both'
    setSubmitting(true)

    try {
      await completeOnboarding(accountType)

      navigate(requiresBusinessProfile ? '/business/dashboard' : '/profile', { replace: true })
    } catch (submissionError) {
      setError(classifyFrontendError(submissionError, {
        domain: 'workflow',
        fallbackType: 'ACCOUNT_TRANSITION_FAILED',
      }))
    } finally {
      setSubmitting(false)
    }
  }

  const errorAction = error?.recovery === 'verify-email'
    ? () => navigate('/verify-email')
    : error?.recovery === 'sign-in'
      ? () => navigate('/login')
      : error?.recovery === 'complete-profile'
        ? () => navigate('/complete-profile')
        : error?.recovery === 'sign-out'
          ? () => void handleRecoverySignOut()
          : error?.recovery === 'retry'
            ? () => document.querySelector('form')?.requestSubmit()
            : undefined

  return (
    <section className="auth-card onboarding-card" aria-labelledby="onboarding-title">
      <div className="onboarding-card__heading">
        <img className="onboarding-card__logo" decoding="async" height="200" src={logoIcon} alt={t('onboarding.logoAlt')} width="184" />
        <p className="auth-card__eyebrow">{t('onboarding.eyebrow')}</p>
        <h1 id="onboarding-title">{t('onboarding.title')}</h1>
        <p>{t('onboarding.description')}</p>
      </div>

      {error && (
        <RecoveryMessage
          actionLabel={t(getRecoveryActionTranslationKey(error.recovery) ?? 'common.retry')}
          actionPending={recoveryPending}
          message={t(error.translationKey)}
          onAction={errorAction}
        />
      )}
      {!error && sessionError && <RecoveryMessage message={t(sessionError)} />}

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
