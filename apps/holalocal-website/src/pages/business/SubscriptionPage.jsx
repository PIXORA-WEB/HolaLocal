import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import LoadingScreen from '../../components/common/LoadingScreen.jsx'
import RecoveryMessage from '../../components/common/RecoveryMessage.jsx'
import useAuthentication from '../../hooks/useAuthentication.js'
import { ensureBusinessProfile } from '../../services/businessService.js'
import {
  classifyFrontendError,
  getRecoveryActionTranslationKey,
} from '../../utils/frontendErrors.js'

function SubscriptionPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { refreshUserProfile, signOutUser, user, userProfile } = useAuthentication()
  const [businessProfile, setBusinessProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [recoveryPending, setRecoveryPending] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const attemptedProfileRefreshBusinessIdRef = useRef(null)
  const userId = user.uid
  const userBusinessId = userProfile?.businessId ?? null
  const hasBusinessRole = userProfile?.roles?.includes('business') === true

  useEffect(() => {
    let active = true

    ensureBusinessProfile(userId, {
      businessId: userBusinessId,
      roles: hasBusinessRole ? ['business'] : [],
    })
      .then(async (profile) => {
        if (active) setBusinessProfile(profile)
        if (
          profile?.businessId
          && profile.businessId !== userBusinessId
          && attemptedProfileRefreshBusinessIdRef.current !== profile.businessId
        ) {
          attemptedProfileRefreshBusinessIdRef.current = profile.businessId
          await refreshUserProfile({ uid: userId }, { background: true }).catch(() => undefined)
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(classifyFrontendError(loadError, {
            domain: 'workflow',
            fallbackType: 'BUSINESS_CREATE_FAILED',
          }))
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [hasBusinessRole, loadAttempt, refreshUserProfile, t, userBusinessId, userId])

  if (loading) return <LoadingScreen message={t('subscription.loading')} />

  async function refreshAccount() {
    setRecoveryPending(true)
    try {
      await refreshUserProfile({ uid: userId }, { background: true })
      setError(null)
      setLoading(true)
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

  async function handleSignOut() {
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

  const errorAction = error?.recovery === 'sign-in'
    ? () => navigate('/login')
    : error?.recovery === 'verify-email'
      ? () => navigate('/verify-email')
      : error?.recovery === 'complete-profile'
        ? () => navigate('/complete-profile')
        : error?.recovery === 'sign-out'
          ? () => void handleSignOut()
          : error?.recovery === 'refresh-account'
            ? () => void refreshAccount()
            : error?.recovery === 'contact-support'
              ? () => navigate('/contact')
              : () => {
                  setLoading(true)
                  setError(null)
                  setLoadAttempt((attempt) => attempt + 1)
                }

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
          actionLabel={t(getRecoveryActionTranslationKey(error.recovery) ?? 'common.retry')}
          actionPending={recoveryPending}
          message={t(error.translationKey)}
          onAction={errorAction}
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
