import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SelectField from '../../components/common/SelectField.jsx'
import AccessibleDialog from '../../components/common/AccessibleDialog.jsx'
import { EditableImageAvatar } from '../../components/common/PublicBusinessCard.jsx'
import FormFieldError from '../../components/common/FormFieldError.jsx'
import RecoveryMessage from '../../components/common/RecoveryMessage.jsx'
import { getAuthenticationErrorMessage } from '../../firebase/auth.js'
import useAuthentication from '../../hooks/useAuthentication.js'
import { uploadUserProfilePhoto } from '../../services/userService.js'
import { supportedUILanguages } from '../../utils/languages.js'
import { getDisplayName } from '../../utils/profile.js'

const preferredLocaleOptions = supportedUILanguages.map(({ code, name }) => ({
  label: name,
  value: code,
}))

function ProfilePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const {
    enableBusinessAccess,
    refreshUserProfile,
    signOutUser,
    updateUserProfile,
    user,
    userProfile,
  } = useAuthentication()
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
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [businessUpgradeSubmitting, setBusinessUpgradeSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const photoRetryRef = useRef(null)
  const hasBusinessAccess = userProfile?.roles?.includes('business') === true
  const displayName = userProfile?.displayName || t('profile.title')
  const profileIsComplete = userProfile?.profileCompleted === true
  const profilePhotoUrl = userProfile?.profilePhoto?.downloadUrl || userProfile?.photoURL || user?.photoURL

  function resetForm() {
    setFirstName(userProfile?.firstName ?? '')
    setLastName(userProfile?.lastName ?? '')
    setPreferredLocale(userProfile?.preferredLocale ?? 'en')
    setCity(userProfile?.city ?? '')
    setCountry(userProfile?.country ?? 'Spain')
  }

  function startEditing() {
    resetForm()
    setError('')
    setFieldErrors({})
    setSuccess('')
    setEditing(true)
  }

  function closeEditor() {
    if (submitting) return
    resetForm()
    setEditing(false)
    setError('')
  }

  async function uploadProfilePhoto(file) {
    setPhotoError('')
    setPhotoUploading(true)

    try {
      await uploadUserProfilePhoto(user.uid, file)
      await refreshUserProfile(user)
      photoRetryRef.current = null
      setSuccess(t('profile.imageUpdated'))
    } catch (uploadError) {
      photoRetryRef.current = () => void uploadProfilePhoto(file)
      setPhotoError(uploadError.message || t('profile.imageUploadError'))
    } finally {
      setPhotoUploading(false)
    }
  }

  function handleProfilePhotoChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void uploadProfilePhoto(file)
  }

  async function handleLogout() {
    setError('')
    setSubmitting(true)

    try {
      await signOutUser()
    } catch (logoutError) {
      setError(getAuthenticationErrorMessage(logoutError, t))
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
    const nextErrors = {}
    if (!normalizedFirstName) nextErrors.firstName = t('validation.firstName')
    if (!normalizedLastName) nextErrors.lastName = t('validation.lastName')
    if (!preferredLocale) nextErrors.preferredLocale = t('validation.language')
    if (!normalizedCity) nextErrors.city = t('validation.city')
    setFieldErrors(nextErrors)
    const firstInvalidField = ['firstName', 'lastName', 'preferredLocale', 'city'].find(
      (field) => nextErrors[field],
    )
    if (firstInvalidField) {
      document.getElementById(`edit-${firstInvalidField.replace('preferredLocale', 'language')}`)?.focus()
      return
    }

    setSubmitting(true)

    try {
      await updateUserProfile({
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        displayName: getDisplayName(normalizedFirstName, normalizedLastName),
        preferredLocale,
        city: normalizedCity,
        country: country.trim() || 'Spain',
      })
      setEditing(false)
      setSuccess(t('profile.updateSuccess'))
    } catch (updateError) {
      setError(getAuthenticationErrorMessage(updateError, t))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleBusinessUpgrade() {
    setError('')
    setSuccess('')
    setBusinessUpgradeSubmitting(true)

    try {
      await enableBusinessAccess()
      navigate('/business/edit')
    } catch (upgradeError) {
      setError(getAuthenticationErrorMessage(upgradeError, t))
      setBusinessUpgradeSubmitting(false)
    }
  }

  return (
    <section className="profile-card">
      <header className="profile-summary">
        <div className="profile-summary__media">
          <EditableImageAvatar
            className="image-avatar--profile"
            disabled={photoUploading}
            inputLabel={t('profile.changeImage')}
            name={displayName}
            onChange={handleProfilePhotoChange}
            src={profilePhotoUrl}
            uploading={photoUploading}
          />
          {photoError && (
            <RecoveryMessage message={photoError} onRetry={() => photoRetryRef.current?.()} />
          )}
        </div>
        <div className="profile-summary__identity">
          <p className="placeholder-page__eyebrow">{t('profile.yourAccount')}</p>
          <h1>{displayName}</h1>
          <p>{userProfile?.email || user?.email}</p>
        </div>
        <div className="profile-summary__badges">
          <span className="profile-summary__badge">
            {t(`profile.accountTypes.${userProfile?.accountType || 'customer'}`)}
          </span>
          <span className={`profile-summary__badge ${profileIsComplete ? 'is-complete' : 'is-incomplete'}`}>
            {t(profileIsComplete ? 'profile.complete' : 'profile.incomplete')}
          </span>
        </div>
        <div className="profile-summary__actions">
          {!editing && (
            <button className="button button--secondary" onClick={startEditing} type="button">
              {t('profile.edit')}
            </button>
          )}
          {hasBusinessAccess && (
            <Link className="button button--secondary" to="/business/dashboard">
              {t('account.business')}
            </Link>
          )}
          <button className="button button--text" disabled={submitting} onClick={handleLogout} type="button">
            {submitting ? t('common.loading') : t('auth.logout')}
          </button>
        </div>
      </header>

      {error && (
        <RecoveryMessage
          message={error}
          onRetry={() => void refreshUserProfile(user).then(() => setError('')).catch((retryError) => setError(getAuthenticationErrorMessage(retryError, t)))}
        />
      )}
      {success && <p className="form-message form-message--success" role="status">{success}</p>}

      <div className="profile-dashboard">
        <section className="account-card profile-dashboard__card profile-dashboard__card--personal" aria-labelledby="personal-details-title">
          <header className="account-card__header">
            <p className="account-card__eyebrow">{t('account.profile')}</p>
            <h2 id="personal-details-title">{t('profile.personalDetails')}</h2>
          </header>
          <dl className="profile-details">
            <div>
              <dt>{t('profile.name')}</dt>
              <dd>{userProfile?.displayName || t('common.notSet')}</dd>
            </div>
            <div>
              <dt>{t('auth.email')}</dt>
              <dd>{userProfile?.email || user?.email}</dd>
            </div>
          </dl>
        </section>

        <section className="account-card profile-dashboard__card profile-dashboard__card--account" aria-labelledby="account-details-title">
          <header className="account-card__header">
            <p className="account-card__eyebrow">{t('account.fallback')}</p>
            <h2 id="account-details-title">{t('profile.accountDetails')}</h2>
          </header>
          <dl className="profile-details">
            <div>
              <dt>{t('profile.accountUse')}</dt>
              <dd>{t(`profile.accountTypes.${userProfile?.accountType || 'customer'}`)}</dd>
            </div>
            <div>
              <dt>{t('profile.profileStatus')}</dt>
              <dd>{t(profileIsComplete ? 'profile.complete' : 'profile.incomplete')}</dd>
            </div>
          </dl>
        </section>

        <section className="account-card profile-dashboard__card profile-dashboard__card--preferences" aria-labelledby="preferences-title">
          <header className="account-card__header">
            <p className="account-card__eyebrow">{t('profile.preferences')}</p>
            <h2 id="preferences-title">{t('profile.languageLocation')}</h2>
          </header>
          <dl className="profile-details">
            <div>
              <dt>{t('profile.preferredLanguage')}</dt>
              <dd>{supportedUILanguages.find(({ code }) => code === userProfile?.preferredLocale)?.name || t('common.notSet')}</dd>
            </div>
            <div>
              <dt>{t('profile.city')}</dt>
              <dd>{userProfile?.city || t('common.notSet')}</dd>
            </div>
            <div>
              <dt>{t('profile.country')}</dt>
              <dd>{userProfile?.country || t('common.notSet')}</dd>
            </div>
          </dl>
        </section>

        {hasBusinessAccess ? (
          <section className="account-card business-tools-card" aria-labelledby="business-tools-title">
            <div>
              <header className="account-card__header">
                <p className="account-card__eyebrow">{t('profile.businessAccess')}</p>
                <h2 id="business-tools-title">{t('profile.businessTools')}</h2>
              </header>
              <p>
                {t(userProfile?.accountType === 'both' ? 'profile.businessBothDescription' : 'profile.businessDescription')}
              </p>
              <dl className="profile-details profile-details--compact">
                <div>
                  <dt>{t('profile.businessProfileStatus')}</dt>
                  <dd>{t(userProfile?.businessProfileCompleted ? 'profile.complete' : 'profile.incomplete')}</dd>
                </div>
              </dl>
            </div>
            <div className="business-tools-card__actions">
              <Link className="button button--primary" to="/business/dashboard">
                {t('account.business')}
              </Link>
              <Link className="button button--secondary" to="/business/edit">
                {t('profile.editBusiness')}
              </Link>
            </div>
          </section>
        ) : (
          <section className="account-card business-tools-card" aria-labelledby="business-upgrade-title">
            <div>
              <header className="account-card__header">
                <p className="account-card__eyebrow">{t('profile.forProfessionals')}</p>
                <h2 id="business-upgrade-title">{t('profile.becomeBusiness')}</h2>
              </header>
              <p>{t('profile.becomeBusinessDescription')}</p>
              <p className="business-tools-card__assurance">
                {t('profile.businessAssurance')}
              </p>
            </div>
            <div className="business-tools-card__actions">
              <button
                className="button button--primary"
                disabled={businessUpgradeSubmitting}
                onClick={() => void handleBusinessUpgrade()}
                type="button"
              >
                {businessUpgradeSubmitting ? t('profile.preparingBusiness') : t('profile.startBusiness')}
              </button>
            </div>
          </section>
        )}
      </div>

      <AccessibleDialog
        ariaLabelledBy="profile-edit-title"
        className="profile-edit-dialog"
        closeDisabled={submitting}
        onClose={closeEditor}
        open={editing}
      >
        <div className="profile-edit-dialog__panel">
          <header className="profile-edit-dialog__header">
            <div>
              <p className="placeholder-page__eyebrow">{t('profile.yourAccount')}</p>
              <h2 id="profile-edit-title">{t('profile.edit')}</h2>
            </div>
            <button
              aria-label={t('profile.closeEditor')}
              disabled={submitting}
              onClick={closeEditor}
              type="button"
            >
              ×
            </button>
          </header>

          <form className="auth-form profile-edit-form" onSubmit={handleProfileUpdate}>
            {error && <p className="form-message form-message--error" role="alert">{error}</p>}

          <label htmlFor="edit-first-name">{t('profile.firstName')}</label>
          <input
            autoComplete="given-name"
            aria-describedby={fieldErrors.firstName ? 'edit-first-name-error' : undefined}
            aria-invalid={Boolean(fieldErrors.firstName)}
            id="edit-first-name"
            maxLength={60}
            onChange={(event) => setFirstName(event.target.value)}
            required
            type="text"
            value={firstName}
          />
          <FormFieldError id="edit-first-name-error" message={fieldErrors.firstName} />

          <label htmlFor="edit-last-name">{t('profile.lastName')}</label>
          <input
            autoComplete="family-name"
            aria-describedby={fieldErrors.lastName ? 'edit-last-name-error' : undefined}
            aria-invalid={Boolean(fieldErrors.lastName)}
            id="edit-last-name"
            maxLength={60}
            onChange={(event) => setLastName(event.target.value)}
            required
            type="text"
            value={lastName}
          />
          <FormFieldError id="edit-last-name-error" message={fieldErrors.lastName} />

          <label htmlFor="edit-language">{t('profile.preferredLanguage')}</label>
          <SelectField
            ariaDescribedBy={fieldErrors.preferredLocale ? 'edit-language-error' : undefined}
            ariaInvalid={Boolean(fieldErrors.preferredLocale)}
            ariaLabel={t('profile.preferredLanguage')}
            className="select-field--form"
            id="edit-language"
            onChange={setPreferredLocale}
            options={preferredLocaleOptions}
            value={preferredLocale}
          />
          <FormFieldError id="edit-language-error" message={fieldErrors.preferredLocale} />

          <label htmlFor="edit-city">{t('profile.city')}</label>
          <input
            autoComplete="address-level2"
            aria-describedby={fieldErrors.city ? 'edit-city-error' : undefined}
            aria-invalid={Boolean(fieldErrors.city)}
            id="edit-city"
            maxLength={100}
            onChange={(event) => setCity(event.target.value)}
            required
            type="text"
            value={city}
          />
          <FormFieldError id="edit-city-error" message={fieldErrors.city} />

          <label htmlFor="edit-country">{t('profile.country')}</label>
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
              onClick={closeEditor}
              type="button"
            >
              {t('common.cancel')}
            </button>
          </div>
          </form>
        </div>
      </AccessibleDialog>

    </section>
  )
}

export default ProfilePage
