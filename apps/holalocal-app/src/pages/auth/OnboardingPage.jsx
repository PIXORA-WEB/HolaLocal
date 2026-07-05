import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import logoIcon from '../../assets/images/logo-icon.png'
import { getAuthenticationErrorMessage } from '../../firebase/auth.js'
import useAuthentication from '../../hooks/useAuthentication.js'
import { brand } from '../../utils/brand.js'
import { getRolesForAccountType } from '../../utils/profile.js'

const onboardingOptions = [
  {
    value: 'customer',
    title: 'Finding services',
    description: 'Discover trusted local professionals when you need help.',
  },
  {
    value: 'business',
    title: 'Offering services',
    description: 'Prepare to create a business profile and offer your services.',
  },
  {
    value: 'both',
    title: 'Both',
    description: 'Find local help and offer services through the same account.',
  },
]

function OnboardingPage() {
  const { t } = useTranslation()
  const { sessionError, updateUserProfile, userProfile } = useAuthentication()
  const navigate = useNavigate()
  const [accountType, setAccountType] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    const roles = getRolesForAccountType(accountType)
    if (!roles) {
      setError('Choose how you plan to use HolaLocal.')
      return
    }

    const requiresBusinessProfile = accountType === 'business' || accountType === 'both'
    setSubmitting(true)

    try {
      await updateUserProfile({
        accountType,
        roles,
        onboardingCompleted: true,
        businessProfileRequired: requiresBusinessProfile,
        businessProfileCompleted: userProfile?.businessProfileCompleted === true,
      })

      navigate(requiresBusinessProfile ? '/business/dashboard' : '/profile', { replace: true })
    } catch (submissionError) {
      setError(getAuthenticationErrorMessage(submissionError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-card onboarding-card" aria-labelledby="onboarding-title">
      <div className="onboarding-card__heading">
        <img className="onboarding-card__logo" src={logoIcon} alt={`${brand.name} logo`} />
        <p className="auth-card__eyebrow">Set up your experience</p>
        <h1 id="onboarding-title">What are you using HolaLocal for?</h1>
        <p>You can use one account to find services, offer services, or do both.</p>
      </div>

      {(error || sessionError) && (
        <p className="form-message form-message--error" role="alert">
          {error || sessionError}
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <fieldset className="onboarding-options">
          <legend className="visually-hidden">Choose how you will use HolaLocal</legend>
          {onboardingOptions.map((option) => (
            <label className="onboarding-option" key={option.value}>
              <input
                checked={accountType === option.value}
                name="accountType"
                onChange={() => setAccountType(option.value)}
                type="radio"
                value={option.value}
              />
              <span>
                <strong>{option.title}</strong>
                <small>{option.description}</small>
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
