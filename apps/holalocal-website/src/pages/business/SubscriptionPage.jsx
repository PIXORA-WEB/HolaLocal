import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import LoadingScreen from '../../components/common/LoadingScreen.jsx'
import RecoveryMessage from '../../components/common/RecoveryMessage.jsx'
import { getAuthenticationErrorMessage } from '../../firebase/auth.js'
import useAuthentication from '../../hooks/useAuthentication.js'
import { getBusinessByOwnerId } from '../../services/businessService.js'

function SubscriptionPage() {
  const { t } = useTranslation()
  const { user } = useAuthentication()
  const [businessProfile, setBusinessProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    let active = true

    getBusinessByOwnerId(user.uid)
      .then((profile) => {
        if (active) setBusinessProfile(profile)
      })
      .catch((loadError) => {
        if (active) setError(getAuthenticationErrorMessage(loadError, t))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [loadAttempt, t, user.uid])

  if (loading) return <LoadingScreen message={t('subscription.loading')} />

  const plan = businessProfile?.subscription?.tier || 'free'
  const status = businessProfile?.status || 'draft'

  return (
    <section className="business-subscription">
      <header className="business-page-heading">
        <p className="placeholder-page__eyebrow">{t('subscription.eyebrow')}</p>
        <h1>{t('business.subscription')}</h1>
        <p>{t('subscription.description')}</p>
      </header>

      {error ? (
        <RecoveryMessage
          message={error}
          onRetry={() => {
            setLoading(true)
            setError('')
            setLoadAttempt((attempt) => attempt + 1)
          }}
        />
      ) : !businessProfile ? (
        <div className="services-state">
          <span aria-hidden="true">✦</span>
          <h2>{t('subscription.emptyTitle')}</h2>
          <p>{t('subscription.emptyDescription')}</p>
          <Link className="button button--primary" to="/business/edit">{t('business.edit')}</Link>
        </div>
      ) : (
        <article className="subscription-card">
          <div className="subscription-card__heading">
            <div>
              <p>{t('subscription.currentPlan')}</p>
              <h2>{t(`subscription.plans.${plan}`)}</h2>
            </div>
            <span className={status === 'active' ? 'is-active' : ''}>{t(`business.control.status.${status}`)}</span>
          </div>
          <p>{t('subscription.summary', { plan: t(`subscription.plans.${plan}`) })}</p>
          <ul>
            <li>{t('subscription.features.manage')}</li>
            <li>{t('subscription.features.marketplace')}</li>
            <li>{t('subscription.features.future')}</li>
          </ul>
          <button className="button button--primary" disabled type="button">
            {t('subscription.comingSoon')}
          </button>
        </article>
      )}
    </section>
  )
}

export default SubscriptionPage
