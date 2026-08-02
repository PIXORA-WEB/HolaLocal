import {
  PLAN_DEFINITIONS,
  PLAN_IDS,
  SUBSCRIPTION_LIMIT_UNLIMITED,
} from '@holalocal/firebase-contract'
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

const PLAN_ORDER = [
  PLAN_IDS.EARLY_ACCESS,
  PLAN_IDS.STARTER,
  PLAN_IDS.GROWTH,
  PLAN_IDS.PRO,
]

const PLAN_LIMIT_KEYS = [
  'galleryImages',
  'categoryIds',
  'serviceAreas',
  'languages',
  'insightHistoryDays',
  'translatedMessagesPerMonth',
]

function formatPlanLimit(t, planId, key, value) {
  if (value === SUBSCRIPTION_LIMIT_UNLIMITED) {
    if (planId === PLAN_IDS.PRO && key === 'translatedMessagesPerMonth') {
      return t('subscription.limitValues.unlimitedFairUse')
    }
    return t('subscription.limitValues.unlimited')
  }

  return t(`subscription.limitValues.${key}`, { count: value })
}

function planCapabilityKeys(features) {
  const insights = features.advancedInsights
    ? 'advancedInsights'
    : 'businessInsights'

  const visibility = features.priorityDirectoryVisibility
    ? 'priorityVisibility'
    : features.enhancedDirectoryVisibility
      ? 'enhancedVisibility'
      : 'standardVisibility'

  const profile = features.enhancedProfile
    ? 'enhancedProfile'
    : 'standardProfile'

  return [
    insights,
    visibility,
    profile,
    ...(features.prioritySupport ? ['priorityFeatures'] : []),
  ]
}

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

  const plan = businessProfile?.entitlements?.effectivePlanId ?? PLAN_IDS.EARLY_ACCESS
  const subscriptionStatus = businessProfile?.entitlements?.accessStatus ?? 'active'

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
        <div className="subscription-content">
          <article className="subscription-current-card">
            <div className="subscription-current-card__main">
              <div className="subscription-current-card__heading">
                <div>
                  <p>{t('subscription.currentPlan')}</p>
                  <h2>{t(`subscription.plans.${plan}`)}</h2>
                </div>
                <span className={subscriptionStatus === 'active' ? 'is-active' : ''}>
                  {t(`subscription.status.${subscriptionStatus}`)}
                </span>
              </div>
              <p>{t('subscription.summary', { plan: t(`subscription.plans.${plan}`) })}</p>
            </div>

            <div className="subscription-current-card__notice">
              <span aria-hidden="true">✦</span>
              <div>
                <p>{t('subscription.earlyAccess.eyebrow')}</p>
                <strong>{t('subscription.earlyAccess.title')}</strong>
                <span>{t('subscription.earlyAccess.description')}</span>
              </div>
            </div>
          </article>

          <section aria-labelledby="subscription-plans-title" className="subscription-plans">
            <header className="subscription-plans__heading">
              <p>{t('subscription.compareEyebrow')}</p>
              <h2 id="subscription-plans-title">{t('subscription.compareTitle')}</h2>
              <span>{t('subscription.compareDescription')}</span>
            </header>

            <div className="subscription-plan-grid">
              {PLAN_ORDER.map((planId) => {
                const definition = PLAN_DEFINITIONS[planId]
                const isCurrentPlan = planId === plan
                const isRecommended = planId === PLAN_IDS.GROWTH
                const capabilityKeys = planCapabilityKeys(definition.features)

                return (
                  <div className="subscription-plan-item" key={planId}>
                    <article
                      aria-current={isCurrentPlan ? 'true' : undefined}
                      className={[
                        'subscription-plan-card',
                        isCurrentPlan ? 'is-current' : '',
                        isRecommended ? 'is-recommended' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <div className="subscription-plan-card__intro">
                        <p>{t(`subscription.planAudience.${planId}`)}</p>
                        <h3>{t(`subscription.plans.${planId}`)}</h3>
                        <span>{t(`subscription.planDescriptions.${planId}`)}</span>
                      </div>

                      <div className="subscription-plan-card__capabilities">
                        <p>{t('subscription.includedTitle')}</p>
                        <ul>
                          {capabilityKeys.map((capabilityKey) => (
                            <li key={capabilityKey}>
                              <span aria-hidden="true">✓</span>
                              {t(`subscription.capabilities.${capabilityKey}`)}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <dl className="subscription-plan-card__limits">
                        {PLAN_LIMIT_KEYS.map((limitKey) => (
                          <div key={limitKey}>
                            <dt>{t(`subscription.limitLabels.${limitKey}`)}</dt>
                            <dd>{formatPlanLimit(t, planId, limitKey, definition.limits[limitKey])}</dd>
                          </div>
                        ))}
                      </dl>

                      <button
                        className="button subscription-plan-card__action"
                        disabled
                        type="button"
                      >
                        {isCurrentPlan
                          ? t('subscription.currentPlanAction')
                          : t('subscription.comingSoon')}
                      </button>
                    </article>

                    <div className="subscription-plan-item__statuses">
                      {isCurrentPlan ? (
                        <span className="subscription-plan-card__badge subscription-plan-card__badge--current">
                          {t('subscription.badges.current')}
                        </span>
                      ) : null}
                      {isRecommended ? (
                        <span className="subscription-plan-card__badge subscription-plan-card__badge--recommended">
                          {t('subscription.badges.recommended')}
                        </span>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="subscription-plans__note">{t('subscription.pricingNote')}</p>
          </section>
        </div>
      )}
    </section>
  )
}

export default SubscriptionPage
