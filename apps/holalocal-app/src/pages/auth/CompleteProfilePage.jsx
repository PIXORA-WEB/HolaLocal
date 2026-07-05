import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAuthenticationErrorMessage } from '../../firebase/auth.js'
import useAuthentication from '../../hooks/useAuthentication.js'
import { getDisplayName, languageOptions } from '../../utils/profile.js'

function CompleteProfilePage() {
  const { t } = useTranslation()
  const { sessionError, updateUserProfile, userProfile } = useAuthentication()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState(userProfile?.firstName ?? '')
  const [lastName, setLastName] = useState(userProfile?.lastName ?? '')
  const [preferredLanguage, setPreferredLanguage] = useState(
    userProfile?.preferredLanguage ?? 'English',
  )
  const [city, setCity] = useState(userProfile?.city ?? '')
  const [country, setCountry] = useState(userProfile?.country ?? 'Spain')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    const normalizedFirstName = firstName.trim()
    const normalizedLastName = lastName.trim()
    const normalizedCity = city.trim()
    const normalizedLanguage = preferredLanguage.trim()

    if (!normalizedFirstName || !normalizedLastName || !normalizedCity || !normalizedLanguage) {
      setError('First name, last name, preferred language, and city are required.')
      return
    }

    setSubmitting(true)

    try {
      await updateUserProfile({
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        displayName: getDisplayName(normalizedFirstName, normalizedLastName),
        preferredLanguage: normalizedLanguage,
        city: normalizedCity,
        country: country.trim() || 'Spain',
        profileCompleted: true,
      })
      navigate('/onboarding', { replace: true })
    } catch (submissionError) {
      setError(getAuthenticationErrorMessage(submissionError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-card" aria-labelledby="complete-profile-title">
      <div className="auth-card__heading">
        <p className="auth-card__eyebrow">One final step</p>
        <h1 id="complete-profile-title">Complete your profile</h1>
        <p>This helps HolaLocal prepare the right experience for you.</p>
      </div>

      {(error || sessionError) && (
        <p className="form-message form-message--error" role="alert">
          {error || sessionError}
        </p>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="profile-first-name">First name</label>
        <input
          autoComplete="given-name"
          id="profile-first-name"
          maxLength={60}
          onChange={(event) => setFirstName(event.target.value)}
          required
          type="text"
          value={firstName}
        />

        <label htmlFor="profile-last-name">Last name</label>
        <input
          autoComplete="family-name"
          id="profile-last-name"
          maxLength={60}
          onChange={(event) => setLastName(event.target.value)}
          required
          type="text"
          value={lastName}
        />

        <label htmlFor="profile-language">{t('language.label')}</label>
        <select
          id="profile-language"
          onChange={(event) => setPreferredLanguage(event.target.value)}
          required
          value={preferredLanguage}
        >
          {languageOptions.map((language) => (
            <option key={language} value={language}>{language}</option>
          ))}
        </select>

        <label htmlFor="profile-city">City</label>
        <input
          autoComplete="address-level2"
          id="profile-city"
          maxLength={100}
          onChange={(event) => setCity(event.target.value)}
          required
          type="text"
          value={city}
        />

        <label htmlFor="profile-country">Country</label>
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
