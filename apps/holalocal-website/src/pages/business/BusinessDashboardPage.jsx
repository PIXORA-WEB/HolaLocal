import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LoadingScreen from '../../components/common/LoadingScreen.jsx'
import BusinessInsightsPanel from '../../components/business/BusinessInsightsPanel.jsx'
import RecoveryMessage from '../../components/common/RecoveryMessage.jsx'
import { ImageAvatar } from '../../components/common/PublicBusinessCard.jsx'
import useAuthentication from '../../hooks/useAuthentication.js'
import { ensureBusinessProfile, submitBusinessForReview } from '../../services/businessService.js'
import { formatLanguageList, getLanguageNameFromCode } from '../../utils/languages.js'
import { getBusinessProfileCompletion } from '../../utils/businessCompletion.js'
import {
  getBusinessCategoryLabel,
  isOwnerEditableBusinessStatus,
} from '../../utils/business.js'
import { getServiceAreaLabel } from '../../utils/locations.js'
import {
  classifyFrontendError,
  getRecoveryActionTranslationKey,
} from '../../utils/frontendErrors.js'

function BusinessDashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { refreshUserProfile, signOutUser, user, userProfile } = useAuthentication()
  const [businessProfile, setBusinessProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState('')
  const [submittingForReview, setSubmittingForReview] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [recoveryPending, setRecoveryPending] = useState(false)
  const attemptedProfileRefreshBusinessIdRef = useRef(null)
  const userId = user.uid
  const userBusinessId = userProfile?.businessId ?? null
  const hasBusinessRole = userProfile?.roles?.includes('business') === true

  useEffect(() => {
    let active = true

    async function loadBusinessProfile() {
      setError(null)
      setLoading(true)
      try {
        const profile = await ensureBusinessProfile(userId, {
          businessId: userBusinessId,
          roles: hasBusinessRole ? ['business'] : [],
        })
        if (active) setBusinessProfile(profile)
        if (
          profile?.businessId
          && profile.businessId !== userBusinessId
          && attemptedProfileRefreshBusinessIdRef.current !== profile.businessId
        ) {
          attemptedProfileRefreshBusinessIdRef.current = profile.businessId
          await refreshUserProfile({ uid: userId }, { background: true }).catch(() => undefined)
        }
      } catch (loadError) {
        if (active) {
          setError(classifyFrontendError(loadError, {
            domain: 'workflow',
            fallbackType: 'BUSINESS_CREATE_FAILED',
          }))
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadBusinessProfile()
    return () => { active = false }
  }, [hasBusinessRole, loadAttempt, refreshUserProfile, t, userBusinessId, userId])

  async function handleSubmitForReview() {
    if (!businessProfile?.businessId) return
    setSubmittingForReview(true)
    setSubmitError(null)
    setSubmitSuccess('')
    try {
      const submittedBusiness = await submitBusinessForReview(businessProfile.businessId)
      setBusinessProfile(submittedBusiness)
      setSubmitSuccess(t('business.control.submitSuccess'))
    } catch (submissionError) {
      setSubmitError(classifyFrontendError(submissionError, {
        domain: 'workflow',
        operation: 'submit-business',
        fallbackType: 'BUSINESS_SUBMIT_FAILED',
      }))
    } finally {
      setSubmittingForReview(false)
    }
  }

  if (loading) return <LoadingScreen message={t('business.control.loading')} />
  if (error) {
    const handleAccountRecovery = async () => {
      setRecoveryPending(true)
      try {
        await refreshUserProfile({ uid: userId }, { background: true })
        setError(null)
        setLoadAttempt((attempt) => attempt + 1)
      } catch (refreshError) {
        setError(classifyFrontendError(refreshError, {
          domain: 'workflow',
          fallbackType: 'BUSINESS_CREATE_FAILED',
        }))
      } finally {
        setRecoveryPending(false)
      }
    }
    const handleRecoverySignOut = async () => {
      setRecoveryPending(true)
      try {
        await signOutUser()
      } catch (signOutError) {
        setError(classifyFrontendError(signOutError, {
          domain: 'workflow',
          fallbackType: 'ACCOUNT_TRANSITION_FAILED',
        }))
      } finally {
        setRecoveryPending(false)
      }
    }
    const onRecovery = error.recovery === 'sign-in'
      ? () => navigate('/login')
      : error.recovery === 'verify-email'
        ? () => navigate('/verify-email')
        : error.recovery === 'complete-profile'
          ? () => navigate('/complete-profile')
          : error.recovery === 'contact-support'
            ? () => navigate('/contact')
            : error.recovery === 'sign-out'
              ? () => void handleRecoverySignOut()
              : error.recovery === 'refresh-account'
                ? () => void handleAccountRecovery()
                : () => setLoadAttempt((attempt) => attempt + 1)
    return (
      <RecoveryMessage
        actionLabel={t(getRecoveryActionTranslationKey(error.recovery) ?? 'common.retry')}
        actionPending={recoveryPending}
        message={t(error.translationKey)}
        onAction={onRecovery}
      />
    )
  }

  const businessName = businessProfile?.name || t('business.control.yourBusiness')
  const status = businessProfile?.status || 'draft'
  const verificationStatus = businessProfile?.verificationStatus || 'unverified'
  const subscriptionTier = businessProfile?.entitlements?.effectivePlanId ?? 'early_access'
  const locality = businessProfile?.location?.locality || ''
  const serviceAreas = businessProfile?.serviceAreas ?? []
  const languages = businessProfile?.languages ?? []
  const primaryLanguage = businessProfile?.primaryLanguage || languages[0]
  const completion = getBusinessProfileCompletion(businessProfile)
  const locationGuidanceKey = !completion.locationValidation.primarySelected
    ? 'business.form.location.selectPrimary'
    : !completion.locationValidation.serviceAreasValid
      ? completion.locationValidation.unresolvedServiceAreas.length > 0
        ? 'business.form.location.resolveServiceAreas'
        : 'business.form.location.selectServiceArea'
      : null
  const canEditBusiness = isOwnerEditableBusinessStatus(status)
  const canSubmitForReview = canEditBusiness && completion.ready
  const submitErrorAction = submitError?.recovery === 'edit-business'
    ? () => navigate('/business/edit')
    : submitError?.recovery === 'sign-in'
      ? () => navigate('/login')
      : submitError?.recovery === 'verify-email'
        ? () => navigate('/verify-email')
        : submitError?.recovery === 'refresh-business'
          ? () => setLoadAttempt((attempt) => attempt + 1)
          : submitError?.recovery === 'refresh-account'
            ? () => void refreshUserProfile({ uid: userId }, { background: true })
                .then(() => {
                  setSubmitError(null)
                  setLoadAttempt((attempt) => attempt + 1)
                })
                .catch((refreshError) => setSubmitError(classifyFrontendError(refreshError, {
                  domain: 'workflow',
                  fallbackType: 'BUSINESS_SUBMIT_FAILED',
                })))
            : submitError?.recovery === 'retry'
              ? () => void handleSubmitForReview()
              : undefined
  const hasHeroContext = Boolean(businessProfile?.primaryCategoryId && locality)
  const additionalAreaCount = serviceAreas.filter(
    (area) => area.trim().toLocaleLowerCase() !== locality.trim().toLocaleLowerCase(),
  ).length

  return (
    <section className="business-dashboard">
      <header className="business-summary">
        <div className="business-summary__media">
          <ImageAvatar alt={t('business.form.media.logoAlt', { name: businessName })} className="image-avatar--business-logo" name={businessName} src={businessProfile?.logoUrl} />
        </div>
        <div className="business-summary__identity">
          <p className="placeholder-page__eyebrow">{t('account.business')}</p>
          <h1>{businessName}</h1>
          <p>
            {hasHeroContext
              ? t(additionalAreaCount > 0 ? 'business.control.heroContextAreas' : 'business.control.heroContext', {
                  category: getBusinessCategoryLabel(businessProfile.primaryCategoryId, t),
                  count: additionalAreaCount,
                  location: locality,
                })
              : t('business.control.heroPrompt')}
          </p>
        </div>
        <div className="business-summary__badges">
          <span className={status === 'active' ? 'is-complete' : ''}>{t(`business.control.status.${status}`)}</span>
          <span className={verificationStatus === 'verified' ? 'is-verified' : ''}>{t(`business.control.verification.${verificationStatus}`)}</span>
          <span>{t('business.control.planBadge', { plan: t(`subscription.plans.${subscriptionTier}`, { defaultValue: subscriptionTier }) })}</span>
          <span className={completion.ready ? 'is-complete' : 'is-incomplete'}>{t(completion.ready ? 'business.control.ready' : 'business.control.needsWork')}</span>
        </div>
      </header>

      <div className="business-dashboard__grid business-dashboard__grid--control-centre">
        {status === 'rejected' && businessProfile.currentRejection && (
          <section className="account-card business-rejection-feedback" aria-labelledby="business-rejection-title">
            <header className="account-card__header">
              <p className="account-card__eyebrow">{t('rejection.owner.eyebrow')}</p>
              <h2 id="business-rejection-title">{t('rejection.owner.title')}</h2>
            </header>
            <p><strong>{t('rejection.owner.category')}:</strong> {t(`rejection.reason.${businessProfile.currentRejection.reasonCode}`)}</p>
            <p className="business-rejection-feedback__guidance">{businessProfile.currentRejection.guidance}</p>
            <p>{t('rejection.owner.nextStep')}</p>
            <Link className="button button--primary" to="/business/edit">{t('rejection.owner.edit')}</Link>
          </section>
        )}
        <article className="account-card business-dashboard__card business-dashboard__card--completion">
          <header className="account-card__header">
            <p className="account-card__eyebrow">{t('business.control.completionEyebrow')}</p>
            <h2>{t('business.completion', { percent: completion.percentage })}</h2>
          </header>
          <progress max="100" value={completion.percentage}>{completion.percentage}%</progress>
          <p>{t('business.control.missingCount', { count: completion.remainingItems.length })}</p>
          <ul className="business-completion-checklist">
            {completion.items.map(({ complete, key }) => (
              <li className={complete ? 'is-complete' : ''} key={key}>
                <span aria-hidden="true">{complete ? '✓' : '○'}</span>
                {t(`business.control.checklist.${key}`)}
              </li>
            ))}
          </ul>
        </article>

        <article className="account-card business-dashboard__card business-dashboard__card--next">
          <header className="account-card__header">
            <p className="account-card__eyebrow">{t('business.control.nextEyebrow')}</p>
            <h2>{t('business.control.nextTitle')}</h2>
          </header>
          <p>
            {completion.ready
              ? t('business.control.coreReady')
              : locationGuidanceKey
                ? t(locationGuidanceKey)
                : t('business.control.nextPrompt', {
                    item: t(`business.control.checklist.${completion.nextRecommendation}`),
                  })}
          </p>
          {submitError && (
            <RecoveryMessage
              actionLabel={t(getRecoveryActionTranslationKey(submitError.recovery) ?? 'common.retry')}
              message={t(submitError.translationKey)}
              onAction={submitErrorAction}
            />
          )}
          {submitSuccess && <p className="form-message form-message--success" role="status">{submitSuccess}</p>}
          {canSubmitForReview ? (
            <button
              className="button button--primary"
              disabled={submittingForReview}
              onClick={() => void handleSubmitForReview()}
              type="button"
            >
              {submittingForReview ? t('common.loading') : t('business.control.submitForReview')}
            </button>
          ) : canEditBusiness ? (
            <Link className="button button--primary" to="/business/edit">{t('business.edit')}</Link>
          ) : null}
        </article>

        <article className={`account-card business-dashboard__card business-dashboard__card--visibility business-dashboard__card--${status}`}>
          <header className="account-card__header account-card__header--row">
            <div>
              <p className="account-card__eyebrow">{t('business.control.visibilityEyebrow')}</p>
              <h2>{t(`business.control.status.${status}`)}</h2>
            </div>
            <span className="status-indicator" aria-hidden="true" />
          </header>
          <p>{t(`business.control.visibility.${status}`)}</p>
          {status === 'draft' && (
            <ul className="business-visibility-steps">
              {['saved', 'private', 'visibleToYou', 'notPublic', 'comingLater'].map((key, index) => (
                <li className={index < 3 ? 'is-complete' : ''} key={key}>
                  <span aria-hidden="true">{index < 3 ? '✓' : '○'}</span>
                  {t(`business.control.visibilitySteps.${key}`)}
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="account-card business-dashboard__card business-dashboard__card--coverage">
          <header className="account-card__header">
            <p className="account-card__eyebrow">{t('business.control.coverageEyebrow')}</p>
            <h2>{t('business.control.coverageTitle')}</h2>
          </header>
          <dl className="business-dashboard__details">
            <div><dt><span aria-hidden="true">📍</span> {t('business.control.primaryArea')}</dt><dd>{locality || t('business.control.notSet')}</dd></div>
            <div><dt><span aria-hidden="true">🗺</span> {t('business.control.serviceAreas', { count: serviceAreas.length })}</dt><dd>{serviceAreas.map((area) => getServiceAreaLabel(area, t)).join(' • ') || t('business.control.addAreas')}</dd></div>
            <div><dt><span aria-hidden="true">🌍</span> {t('business.control.primaryLanguage')}</dt><dd>{primaryLanguage ? getLanguageNameFromCode(primaryLanguage) : t('business.control.notSet')}</dd></div>
            <div><dt><span aria-hidden="true">💬</span> {t('business.control.spokenLanguages')}</dt><dd>{formatLanguageList(languages) || t('business.control.addLanguages')}</dd></div>
          </dl>
        </article>

        <article className="account-card business-dashboard__card business-dashboard__card--account-summary">
          <header className="account-card__header">
            <p className="account-card__eyebrow">{t('business.control.accountEyebrow')}</p>
            <h2>{t('business.control.accountTitle')}</h2>
          </header>
          <div className="business-account-chips">
            <div className="is-info"><span>{t('business.control.subscriptionLabel')}</span><strong>{t(`subscription.plans.${subscriptionTier}`, { defaultValue: subscriptionTier })}</strong></div>
            <div className={verificationStatus === 'verified' ? 'is-positive' : 'is-attention'}><span>{t('business.control.verificationLabel')}</span><strong>{t(`business.control.verification.${verificationStatus}`)}</strong></div>
            <div className={status === 'active' ? 'is-positive' : 'is-attention'}><span>{t('business.control.visibilityEyebrow')}</span><strong>{t(`business.control.status.${status}`)}</strong></div>
            <div className={completion.ready ? 'is-positive' : 'is-info'}><span>{t('business.control.completionEyebrow')}</span><strong>{completion.percentage}%</strong></div>
          </div>
        </article>

        <article className="account-card business-dashboard__card business-dashboard__card--actions">
          <div>
            <header className="account-card__header">
              <p className="account-card__eyebrow">{t('business.control.quickEyebrow')}</p>
              <h2>{t('business.control.quickTitle')}</h2>
            </header>
            <p>{t('business.control.quickDescription')}</p>
          </div>
          <div className="business-dashboard__actions">
            {canEditBusiness && (
              <>
                <Link className="button button--primary" to="/business/edit">{t('business.edit')}</Link>
                <Link className="button button--secondary" to="/business/edit#business-contact-title">{t('business.control.contactSettings')}</Link>
              </>
            )}
            <Link className="button button--secondary" to="/business/subscription">{t('business.subscription')}</Link>
          </div>
        </article>

        <BusinessInsightsPanel businessId={businessProfile.businessId} status={status} />
      </div>
    </section>
  )
}

export default BusinessDashboardPage
