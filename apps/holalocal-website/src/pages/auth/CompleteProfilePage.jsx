import { useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAuthenticationErrorMessage } from '../../firebase/auth.js'
import useAuthentication from '../../hooks/useAuthentication.js'
import { supportedUILanguages } from '../../utils/languages.js'
import SelectField from '../../components/common/SelectField.jsx'
import { getDisplayName } from '../../utils/profile.js'
import FormFieldError from '../../components/common/FormFieldError.jsx'

function CompleteProfilePage() {
  const { t } = useTranslation()
  const { completeUserProfile, sessionError, userProfile } = useAuthentication()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [firstName, setFirstName] = useState(userProfile?.firstName ?? '')
  const [lastName, setLastName] = useState(userProfile?.lastName ?? '')
  const [preferredLocale, setPreferredLocale] = useState(
    userProfile?.preferredLocale ?? 'en',
  )
  const [city, setCity] = useState(userProfile?.city ?? '')
  const [country, setCountry] = useState(userProfile?.country ?? 'Spain')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    const normalizedFirstName = firstName.trim()
    const normalizedLastName = lastName.trim()
    const normalizedCity = city.trim()

    const nextErrors = {}
    if (!normalizedFirstName) nextErrors.firstName = t('validation.firstName')
    if (!normalizedLastName) nextErrors.lastName = t('validation.lastName')
    if (!preferredLocale) nextErrors.preferredLocale = t('validation.language')
    if (!normalizedCity) nextErrors.city = t('validation.city')
    setFieldErrors(nextErrors)
    const firstInvalidField = ['firstName', 'lastName', 'preferredLocale', 'city'].find((field) => nextErrors[field])
    if (firstInvalidField) {
      const id = firstInvalidField === 'preferredLocale' ? 'profile-language' : `profile-${firstInvalidField.replace('firstName', 'first-name').replace('lastName', 'last-name')}`
      document.getElementById(id)?.focus()
      return
    }

    setSubmitting(true)

    try {
      await completeUserProfile({
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        displayName: getDisplayName(normalizedFirstName, normalizedLastName),
        preferredLocale,
        city: normalizedCity,
        country: country.trim() || 'Spain',
        profileCompleted: true,
      })
      const intent = searchParams.get('intent')
      navigate(intent ? `/onboarding?intent=${intent}` : '/onboarding', {
        replace: true,
        state: { from: location.state?.from },
      })
    } catch (submissionError) {
      setError(getAuthenticationErrorMessage(submissionError, t))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-card" aria-labelledby="complete-profile-title">
      <div className="auth-card__heading">
        <p className="auth-card__eyebrow">{t('profile.completion.eyebrow')}</p>
        <h1 id="complete-profile-title">{t('profile.completion.title')}</h1>
        <p>{t('profile.completion.description')}</p>
      </div>

      {(error || sessionError) && (
        <p className="form-message form-message--error" role="alert">
          {error || t(sessionError)}
        </p>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="profile-first-name">{t('profile.firstName')}</label>
        <input
          autoComplete="given-name"
          aria-describedby={fieldErrors.firstName ? 'profile-first-name-error' : undefined}
          aria-invalid={Boolean(fieldErrors.firstName)}
          id="profile-first-name"
          maxLength={60}
          onChange={(event) => setFirstName(event.target.value)}
          required
          type="text"
          value={firstName}
        />
        <FormFieldError id="profile-first-name-error" message={fieldErrors.firstName} />

        <label htmlFor="profile-last-name">{t('profile.lastName')}</label>
        <input
          autoComplete="family-name"
          aria-describedby={fieldErrors.lastName ? 'profile-last-name-error' : undefined}
          aria-invalid={Boolean(fieldErrors.lastName)}
          id="profile-last-name"
          maxLength={60}
          onChange={(event) => setLastName(event.target.value)}
          required
          type="text"
          value={lastName}
        />
        <FormFieldError id="profile-last-name-error" message={fieldErrors.lastName} />

        <label htmlFor="profile-language">{t('language.label')}</label>
        <SelectField
          ariaLabel={t('language.label')}
          ariaDescribedBy={fieldErrors.preferredLocale ? 'profile-language-error' : undefined}
          ariaInvalid={Boolean(fieldErrors.preferredLocale)}
          className="select-field--form"
          id="profile-language"
          onChange={setPreferredLocale}
          options={supportedUILanguages.map(({ code, flag, name }) => ({ icon: flag, label: name, value: code }))}
          showLeadingIcon
          value={preferredLocale}
        />
        <FormFieldError id="profile-language-error" message={fieldErrors.preferredLocale} />

        <label htmlFor="profile-city">{t('profile.city')}</label>
        <input
          autoComplete="address-level2"
          aria-describedby={fieldErrors.city ? 'profile-city-error' : undefined}
          aria-invalid={Boolean(fieldErrors.city)}
          id="profile-city"
          maxLength={100}
          onChange={(event) => setCity(event.target.value)}
          required
          type="text"
          value={city}
        />
        <FormFieldError id="profile-city-error" message={fieldErrors.city} />

        <label htmlFor="profile-country">{t('profile.country')}</label>
        <input
          autoComplete="country-name"
          id="profile-country"
          maxLength={100}
          onChange={(event) => setCountry(event.target.value)}
          type="text"
          value={country}
        />

        <button className="button button--primary" disabled={submitting} type="submit">
          {submitting ? t('common.loading') : t('common.save')}
        </button>
      </form>
    </section>
  )
}

export default CompleteProfilePage
