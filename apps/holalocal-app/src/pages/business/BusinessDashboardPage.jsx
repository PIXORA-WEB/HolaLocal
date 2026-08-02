import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LoadingScreen from '../../components/LoadingScreen.jsx'
import { getAuthenticationErrorMessage } from '../../firebase/auth.js'
import useAuthentication from '../../hooks/useAuthentication.js'
import { getBusinessByOwnerId } from '../../services/businessService.js'
import { BUSINESS_CATEGORY_KEYS } from '../../services/businessPayloads.js'

function BusinessDashboardPage() {
  const { t } = useTranslation()
  const { user, userProfile } = useAuthentication()
  const [businessProfile, setBusinessProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadBusinessProfile() {
      try {
        const profile = await getBusinessByOwnerId(user.uid, userProfile.businessId)
        if (active) setBusinessProfile(profile)
      } catch (loadError) {
        if (active) setError(getAuthenticationErrorMessage(loadError, t))
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadBusinessProfile()

    return () => {
      active = false
    }
  }, [t, user.uid, userProfile.businessId])

  if (loading) return <LoadingScreen message={t('business.loading')} />

  if (error) {
    return <p className="form-message form-message--error" role="alert">{error}</p>
  }

  if (!businessProfile) {
    return (
      <section className="business-dashboard">
        <h1>{t('business.setupDeferred.title')}</h1>
        <p>{t('business.setupDeferred.description')}</p>
      </section>
    )
  }

  if (!businessProfile.profileCompleted) {
    return (
      <section className="business-dashboard">
        <p className="placeholder-page__eyebrow">{t('business.account')}</p>
        <h1>{businessProfile.editSupport.supported ? t('business.complete.title') : t('business.readOnly.title')}</h1>
        <p>{businessProfile.editSupport.supported ? t('business.complete.description') : t('business.readOnly.description')}</p>

        <div className="business-status-card">
          <span>{t('business.profileStatus')}</span>
          <strong>{t('business.setupRequired')}</strong>
        </div>

        {businessProfile.editSupport.supported && <Link className="button button--primary" to="/business/edit">{t('business.complete.action')}</Link>}
      </section>
    )
  }

  const subscriptionPlan = businessProfile.entitlements?.effectivePlanId ?? 'early_access'
  const subscriptionStatus = businessProfile.entitlements?.accessStatus ?? 'active'

  return (
    <section className="business-dashboard">
      <p className="placeholder-page__eyebrow">{t('business.dashboard')}</p>
      <h1>{businessProfile.name}</h1>

      <dl className="profile-details business-details">
        <div>
          <dt>Category</dt>
          <dd>{BUSINESS_CATEGORY_KEYS[businessProfile.primaryCategoryId]
            ? t(`business.categoryLabels.${BUSINESS_CATEGORY_KEYS[businessProfile.primaryCategoryId]}`)
            : businessProfile.primaryCategoryId}</dd>
        </div>
        <div>
          <dt>City</dt>
          <dd>{businessProfile.location?.locality}</dd>
        </div>
        <div>
          <dt>Profile status</dt>
          <dd>{businessProfile.profileCompleted ? 'Complete' : 'Incomplete'}</dd>
        </div>
        <div>
          <dt>Verification</dt>
          <dd>{businessProfile.verificationStatus ?? t('business.trust.unverifiedLegacy')}</dd>
        </div>
        <div>
          <dt>{t('business.subscription')}</dt>
          <dd>
            {t(`business.subscriptionPlans.${subscriptionPlan}`, { defaultValue: subscriptionPlan })}
            {' · '}
            {t(`business.subscriptionStatuses.${subscriptionStatus}`, { defaultValue: subscriptionStatus })}
          </dd>
        </div>
      </dl>

      {businessProfile.editSupport.supported
        ? <Link className="button button--secondary" to="/business/edit">{t('business.edit')}</Link>
        : <p className="form-message" role="status">{t('business.readOnly.description')}</p>}
    </section>
  )
}

export default BusinessDashboardPage
