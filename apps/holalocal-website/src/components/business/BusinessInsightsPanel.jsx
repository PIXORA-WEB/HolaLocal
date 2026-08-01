import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BUSINESS_CONTACT_ACTIONS } from '@holalocal/firebase-contract'
import { getOwnerBusinessInsights } from '../../services/businessInsightsService.js'

const metricKeys = ['profileViews', 'enquiries', 'contactActions']

function totalActivity(day) {
  return day.profileViews + day.enquiries + day.contactActions
}

export default function BusinessInsightsPanel({ businessId, status }) {
  const { i18n, t } = useTranslation()
  const [state, setState] = useState({ status: 'loading', data: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    getOwnerBusinessInsights(businessId)
      .then((data) => { if (current) setState({ status: 'ready', data }) })
      .catch(() => { if (current) setState({ status: 'error', data: null }) })
    return () => { current = false }
  }, [attempt, businessId])

  const maximum = useMemo(() => Math.max(1, ...(state.data?.days ?? []).map(totalActivity)), [state.data])
  const inactive = ['suspended', 'archived', 'deleted'].includes(status)
  const unpublished = ['draft', 'pending_review', 'rejected'].includes(status)

  function retry() {
    setState({ status: 'loading', data: null })
    setAttempt((value) => value + 1)
  }

  return (
    <section className="account-card business-insights" aria-labelledby="business-insights-title">
      <header className="account-card__header">
        <p className="account-card__eyebrow">{t('businessInsights.eyebrow')}</p>
        <h2 id="business-insights-title">{t('businessInsights.title')}</h2>
        <p>{t('businessInsights.description')}</p>
      </header>
      {state.status === 'loading' && <p aria-live="polite" role="status">{t('businessInsights.state.loading')}</p>}
      {state.status === 'error' && (
        <div aria-live="assertive" className="business-insights__state" role="alert">
          <p>{t('businessInsights.state.error')}</p>
          <button className="button button--secondary" onClick={retry} type="button">{t('common.retry')}</button>
        </div>
      )}
      {state.status === 'ready' && (
        <>
          <p className="business-insights__notice" role="status">
            {unpublished && t('businessInsights.state.unpublished')}
            {inactive && t('businessInsights.state.inactive')}
            {!unpublished && !inactive && !state.data.trackingStartedAt && t('businessInsights.state.notStarted')}
            {!unpublished && !inactive && state.data.trackingStartedAt && t('businessInsights.state.collectingSince', {
              date: new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, { dateStyle: 'medium' }).format(new Date(state.data.trackingStartedAt)),
            })}
          </p>
          <div className="business-insights__grid">
            {metricKeys.map((key) => (
              <article key={key}>
                <strong>{state.data.last30Days[key]}</strong>
                <span>{t(`businessInsights.${key}`)}</span>
                <small>{t('businessInsights.last30Days')}</small>
                <small>{t('businessInsights.allTime', { count: state.data.allTime[key] })}</small>
              </article>
            ))}
          </div>
          {metricKeys.every((key) => state.data.allTime[key] === 0) && <p className="business-insights__empty">{t('businessInsights.state.empty')}</p>}
          <section className="business-insights__breakdown" aria-labelledby="contact-breakdown-title">
            <h3 id="contact-breakdown-title">{t('businessInsights.contactBreakdown')}</h3>
            <dl>{BUSINESS_CONTACT_ACTIONS.map((action) => <div key={action}><dt>{t(`businessInsights.actions.${action}`)}</dt><dd>{state.data.contactActionBreakdown[action]}</dd></div>)}</dl>
          </section>
          <section className="business-insights__activity" aria-labelledby="insights-activity-title">
            <h3 id="insights-activity-title">{t('businessInsights.activityTitle')}</h3>
            <p>{t('businessInsights.activityDescription')}</p>
            <ol>
              {state.data.days.map((day) => {
                const total = totalActivity(day)
                return <li aria-label={t('businessInsights.dayLabel', { date: day.date, count: total })} key={day.date}><span style={{ '--activity-size': `${Math.max(total ? 8 : 2, (total / maximum) * 100)}%` }} /><small>{day.date.slice(8)}</small><span className="visually-hidden">{t('businessInsights.dayDetails', { views: day.profileViews, enquiries: day.enquiries, contacts: day.contactActions })}</span></li>
              })}
            </ol>
          </section>
        </>
      )}
    </section>
  )
}
