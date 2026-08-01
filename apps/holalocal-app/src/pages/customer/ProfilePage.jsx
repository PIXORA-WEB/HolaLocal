import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAuthenticationErrorMessage } from '../../firebase/auth.js'
import useAuthentication from '../../hooks/useAuthentication.js'
import {
  getAccountDisplayName,
  getDisplayName,
  getUserInitials,
  languageOptions,
} from '../../utils/profile.js'
import { getLanguageDisplayName } from '../../utils/languages.js'

function ProfilePage() {
  const { i18n, t } = useTranslation()
  const { signOutUser, updateUserProfile, user, userProfile } = useAuthentication()
  const [editing, setEditing] = useState(false)
  const [firstName, setFirstName] = useState(userProfile?.firstName ?? '')
  const [lastName, setLastName] = useState(userProfile?.lastName ?? '')
  const [preferredLocale, setPreferredLocale] = useState(
    userProfile?.preferredLocale ?? 'en',
  )
  const [city, setCity] = useState(userProfile?.city ?? '')
  const [country, setCountry] = useState(userProfile?.country ?? 'Spain')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const hasBusinessAccess = userProfile?.roles?.includes('business') === true
  const accountDisplayName = getAccountDisplayName(
    userProfile,
    user,
    t('profile.accountFallback'),
  )
  const initials = getUserInitials(accountDisplayName)

  function resetForm() {
    setFirstName(userProfile?.firstName ?? '')
    setLastName(userProfile?.lastName ?? '')
    setPreferredLocale(userProfile?.preferredLocale ?? 'en')
    setCity(userProfile?.city ?? '')
    setCountry(userProfile?.country ?? 'Spain')
  }

  async function handleLogout() {
    setError('')
    setSubmitting(true)

    try {
      await signOutUser()
    } catch (logoutError) {
      setError(getAuthenticationErrorMessage(logoutError))
      setSubmitting(false)
    }
  }

  async function handleProfileUpdate(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    const normalizedFirstName = firstName.trim()
    const normalizedLastName = lastName.trim()
    const normalizedCity = city.trim()
    const normalizedLanguage = preferredLocale.trim()

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
        preferredLocale: normalizedLanguage,
        city: normalizedCity,
        country: country.trim() || 'Spain',
      })
      setEditing(false)
      setSuccess('Your profile has been updated.')
    } catch (updateError) {
      setError(getAuthenticationErrorMessage(updateError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="profile-card">
      <header className="profile-summary">
        <div className="profile-summary__avatar" aria-hidden="true">{initials}</div>
        <div>
          <p className="placeholder-page__eyebrow">{t('profile.accountEyebrow')}</p>
          <h1>{accountDisplayName}</h1>
          <p>{user?.email}</p>
        </div>
      </header>

      {error && <p className="form-message form-message--error" role="alert">{error}</p>}
      {success && <p className="form-message form-message--success" role="status">{success}</p>}

      <dl className="profile-details">
        <div>
          <dt>Name</dt>
          <dd>{userProfile?.displayName || 'Not set'}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{userProfile?.email || user?.email}</dd>
        </div>
        <div>
          <dt>Account type</dt>
          <dd>{userProfile?.accountType || 'customer'}</dd>
        </div>
        <div>
          <dt>Roles</dt>
          <dd>{userProfile?.roles?.join(', ') || 'customer'}</dd>
        </div>
        <div>
          <dt>Onboarding status</dt>
          <dd>{userProfile?.onboardingCompleted ? 'Complete' : 'Incomplete'}</dd>
        </div>
        <div>
          <dt>Business profile required</dt>
          <dd>{userProfile?.businessProfileRequired ? 'Yes' : 'No'}</dd>
        </div>
        <div>
          <dt>Business profile status</dt>
          <dd>{userProfile?.businessProfileCompleted ? 'Complete' : 'Incomplete'}</dd>
        </div>
        <div>
          <dt>Preferred language</dt>
          <dd>{getLanguageDisplayName(userProfile?.preferredLocale || 'en', i18n.resolvedLanguage)}</dd>
        </div>
        <div>
          <dt>City</dt>
          <dd>{userProfile?.city || 'Not set'}</dd>
        </div>
        <div>
          <dt>Country</dt>
          <dd>{userProfile?.country || 'Not set'}</dd>
        </div>
        <div>
          <dt>Profile status</dt>
          <dd>{userProfile?.profileCompleted ? 'Complete' : 'Incomplete'}</dd>
        </div>
      </dl>

      {hasBusinessAccess && (
        <section className="business-tools-card" aria-labelledby="business-tools-title">
          <div>
            <p className="placeholder-page__eyebrow">Business access</p>
            <h2 id="business-tools-title">{t('profile.businessTools')}</h2>
            <p>
              {userProfile?.accountType === 'both'
                ? 'Your account can find local services and manage your business.'
                : 'Manage your business profile and setup from here.'}
            </p>
          </div>
          <div className="business-tools-card__actions">
            <Link className="button button--primary" to="/business/dashboard">
              {t('profile.businessDashboard')}
            </Link>
            <Link className="button button--secondary" to="/business/edit">
              {t('profile.editBusiness')}
            </Link>
          </div>
        </section>
      )}

      {!editing && (
        <button
          className="button button--secondary"
          onClick={() => {
            resetForm()
            setError('')
            setSuccess('')
            setEditing(true)
          }}
          type="button"
        >
          {t('profile.edit')}
        </button>
      )}

      {editing && (
        <form className="auth-form profile-edit-form" onSubmit={handleProfileUpdate}>
          <h2>Edit profile</h2>

          <label htmlFor="edit-first-name">First name</label>
          <input
            autoComplete="given-name"
            id="edit-first-name"
            maxLength={60}
            onChange={(event) => setFirstName(event.target.value)}
            required
            type="text"
            value={firstName}
          />

          <label htmlFor="edit-last-name">Last name</label>
          <input
            autoComplete="family-name"
            id="edit-last-name"
            maxLength={60}
            onChange={(event) => setLastName(event.target.value)}
            required
            type="text"
            value={lastName}
          />

          <label htmlFor="edit-language">Preferred language</label>
          <select
            id="edit-language"
            onChange={(event) => setPreferredLocale(event.target.value)}
            required
            value={preferredLocale}
          >
            {languageOptions.map((language) => (
              <option key={language} value={language}>{getLanguageDisplayName(language, i18n.resolvedLanguage)}</option>
            ))}
          </select>

          <label htmlFor="edit-city">City</label>
          <input
            autoComplete="address-level2"
            id="edit-city"
            maxLength={100}
            onChange={(event) => setCity(event.target.value)}
            required
            type="text"
            value={city}
          />

          <label htmlFor="edit-country">Country</label>
          <input
            autoComplete="country-name"
            id="edit-country"
            maxLength={100}
            onChange={(event) => setCountry(event.target.value)}
            type="text"
            value={country}
          />

          <div className="profile-edit-form__actions">
            <button className="button button--primary" disabled={submitting} type="submit">
              {submitting ? t('common.loading') : t('common.save')}
            </button>
            <button
              className="button button--secondary"
              disabled={submitting}
              onClick={() => {
                resetForm()
                setEditing(false)
                setError('')
              }}
              type="button"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}

      <button className="button button--text" disabled={submitting} onClick={handleLogout} type="button">
        {submitting ? t('common.loading') : t('auth.logout')}
      </button>
    </section>
  )
}

export default ProfilePage
