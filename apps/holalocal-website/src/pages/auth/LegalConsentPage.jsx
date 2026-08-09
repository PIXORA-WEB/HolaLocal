import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import FormFieldError from '../../components/common/FormFieldError.jsx'
import useAuthentication from '../../hooks/useAuthentication.js'
import { getAuthenticationErrorMessage } from '../../firebase/auth.js'
import { hasCurrentLegalConsent } from '../../utils/policies.js'
import { internalPathFromLocation } from '../../utils/internalNavigation.js'

function nextAccountPath(profile, intended) {
  if (profile?.profileCompleted !== true) return '/complete-profile'
  if (profile?.onboardingCompleted !== true) return '/onboarding'
  return internalPathFromLocation(intended)
}

function LegalConsentPage() {
  const { t } = useTranslation()
  const {
    acceptLegalConsent,
    signOutUser,
    userProfile,
  } = useAuthentication()
  const location = useLocation()
  const navigate = useNavigate()
  const intended = location.state?.from ?? null
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptPrivacy, setAcceptPrivacy] = useState(false)
  const [error, setError] = useState('')
  const [consentError, setConsentError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (!hasCurrentLegalConsent(userProfile)) return
    navigate(nextAccountPath(userProfile, intended), {
      replace: true,
      state: { from: intended },
    })
  }, [intended, navigate, userProfile])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    const missingConsent = !acceptTerms || !acceptPrivacy
    setConsentError(missingConsent)
    if (missingConsent) {
      document.getElementById(!acceptTerms ? 'legal-consent-terms' : 'legal-consent-privacy')?.focus()
      return
    }

    setSubmitting(true)
    try {
      const { profile } = await acceptLegalConsent()
      navigate(nextAccountPath(profile, intended), {
        replace: true,
        state: { from: intended },
      })
    } catch (submissionError) {
      setError(getAuthenticationErrorMessage(submissionError, t))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSignOut() {
    setError('')
    setSigningOut(true)
    try {
      await signOutUser()
      navigate('/login', { replace: true })
    } catch (signOutError) {
      setError(getAuthenticationErrorMessage(signOutError, t))
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <section className="auth-card" aria-labelledby="legal-consent-title">
      <div className="auth-card__heading">
        <p className="auth-card__eyebrow">{t('legalConsent.eyebrow')}</p>
        <h1 id="legal-consent-title">{t('legalConsent.title')}</h1>
        <p>{t('legalConsent.description')}</p>
        <p>{t('legalConsent.currentDocuments')}</p>
      </div>

      {error && <p className="form-message form-message--error" role="alert">{error}</p>}

      <form className="auth-form" onSubmit={handleSubmit}>
        <fieldset
          aria-describedby={consentError ? 'legal-consent-error' : undefined}
          aria-invalid={consentError}
          className="registration-consent"
        >
          <legend>{t('legalConsent.legend')}</legend>
          <label>
            <input
              checked={acceptTerms}
              id="legal-consent-terms"
              onChange={(event) => setAcceptTerms(event.target.checked)}
              type="checkbox"
            />
            <span>
              {t('legalConsent.termsPrefix')}{' '}
              <Link onClick={(event) => event.stopPropagation()} target="_blank" to="/terms">
                {t('legalConsent.termsLink')}
              </Link>
            </span>
          </label>
          <label>
            <input
              checked={acceptPrivacy}
              id="legal-consent-privacy"
              onChange={(event) => setAcceptPrivacy(event.target.checked)}
              type="checkbox"
            />
            <span>
              {t('legalConsent.privacyPrefix')}{' '}
              <Link onClick={(event) => event.stopPropagation()} target="_blank" to="/privacy">
                {t('legalConsent.privacyLink')}
              </Link>
            </span>
          </label>
          <FormFieldError
            id="legal-consent-error"
            message={consentError ? t('legalConsent.bothRequired') : ''}
          />
        </fieldset>

        <button aria-busy={submitting || undefined} className="button button--primary" disabled={submitting || signingOut} type="submit">
          {submitting ? t('legalConsent.submitting') : t('legalConsent.submit')}
        </button>
        <button className="button button--secondary" disabled={submitting || signingOut} onClick={() => void handleSignOut()} type="button">
          {signingOut ? t('common.loading') : t('legalConsent.logout')}
        </button>
      </form>
    </section>
  )
}

export default LegalConsentPage
