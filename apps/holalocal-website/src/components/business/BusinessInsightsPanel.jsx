import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BUSINESS_CONTACT_ACTIONS } from '@holalocal/firebase-contract'
import { getOwnerBusinessInsights } from '../../services/businessInsightsService.js'
import {
  activityChartConfiguration,
  currentUtcDate,
  localeDate,
  presetDateRequest,
  showActivityDayLabel,
  validateCustomInsightRange,
} from '../../services/businessInsightsRanges.js'

const metricKeys = ['profileViews', 'enquiries', 'contactActions']
const presets = ['last_7_days', 'last_30_days', 'last_90_days', 'custom']

function totalActivity(day) {
  return day.profileViews + day.enquiries + day.contactActions
}

export default function BusinessInsightsPanel({ businessId, status }) {
  const { i18n, t } = useTranslation()
  const today = currentUtcDate()
  const defaultDates = presetDateRequest('last_30_days', today)
  const [state, setState] = useState({ status: 'loading', data: null })
  const [selection, setSelection] = useState({ preset: 'last_30_days', request: null })
  const [custom, setCustom] = useState(defaultDates)
  const [validationError, setValidationError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    getOwnerBusinessInsights(businessId, selection.request)
      .then((data) => { if (current) setState({ status: 'ready', data }) })
      .catch(() => { if (current) setState((previous) => ({ status: 'error', data: previous.data })) })
    return () => { current = false }
  }, [attempt, businessId, selection.request])

  const maximum = useMemo(() => Math.max(1, ...(state.data?.days ?? []).map(totalActivity)), [state.data])
  const inactive = ['suspended', 'archived', 'deleted'].includes(status)
  const unpublished = ['draft', 'pending_review', 'rejected'].includes(status)
  const locale = i18n.resolvedLanguage ?? i18n.language

  function loadRange(preset, request) {
    const requestKey = JSON.stringify(request)
    if (selection.preset === preset && JSON.stringify(selection.request) === requestKey) return
    setValidationError('')
    setState((previous) => ({ status: 'loading', data: previous.data }))
    setSelection({ preset, request })
  }

  function choosePreset(event) {
    const preset = event.target.value
    if (preset === 'custom') {
      setValidationError('')
      setSelection((previous) => ({ ...previous, preset }))
      return
    }
    loadRange(preset, presetDateRequest(preset, today))
  }

  function applyCustomRange(event) {
    event.preventDefault()
    const result = validateCustomInsightRange(custom.startDate, custom.endDate, today)
    if (!result.valid) {
      setValidationError(t(`businessInsights.range.errors.${result.reason}`))
      return
    }
    loadRange('custom', { startDate: result.startDate, endDate: result.endDate })
  }

  function retry() {
    setState((previous) => ({ status: 'loading', data: previous.data }))
    setAttempt((value) => value + 1)
  }

  const displayed = state.data
  const rangeLabel = displayed
    ? t('businessInsights.range.displayed', {
        start: localeDate(displayed.range.startDate, locale),
        end: localeDate(displayed.range.endDate, locale),
      })
    : ''
  const chartConfiguration = activityChartConfiguration(displayed?.days.length)

  return (
    <section className="account-card business-insights" aria-labelledby="business-insights-title">
      <header className="account-card__header">
        <p className="account-card__eyebrow">{t('businessInsights.eyebrow')}</p>
        <h2 id="business-insights-title">{t('businessInsights.title')}</h2>
        <p>{t('businessInsights.description')}</p>
      </header>

      <div className="business-insights__range-controls">
        <label htmlFor="business-insights-range">{t('businessInsights.range.label')}</label>
        <select id="business-insights-range" onChange={choosePreset} value={selection.preset}>
          {presets.map((preset) => <option key={preset} value={preset}>{t(`businessInsights.range.presets.${preset}`)}</option>)}
        </select>
        {selection.preset === 'custom' && (
          <form className="business-insights__custom-range" onSubmit={applyCustomRange}>
            <label>{t('businessInsights.range.from')}<input aria-describedby={validationError ? 'business-insights-range-error' : undefined} aria-invalid={Boolean(validationError)} max={today} onChange={(event) => setCustom((value) => ({ ...value, startDate: event.target.value }))} type="date" value={custom.startDate} /></label>
            <label>{t('businessInsights.range.to')}<input aria-describedby={validationError ? 'business-insights-range-error' : undefined} aria-invalid={Boolean(validationError)} max={today} onChange={(event) => setCustom((value) => ({ ...value, endDate: event.target.value }))} type="date" value={custom.endDate} /></label>
            <button className="button button--secondary" type="submit">{t('businessInsights.range.apply')}</button>
          </form>
        )}
        {validationError && <p className="business-insights__range-error" id="business-insights-range-error" role="alert">{validationError}</p>}
      </div>

      {state.status === 'loading' && <p aria-live="polite" role="status">{t(displayed ? 'businessInsights.state.loadingRange' : 'businessInsights.state.loading')}</p>}
      {state.status === 'error' && (
        <div aria-live="assertive" className="business-insights__state" role="alert">
          <p>{t('businessInsights.state.error')}</p>
          <button className="button button--secondary" onClick={retry} type="button">{t('common.retry')}</button>
        </div>
      )}
      {displayed && (
        <>
          <p className="business-insights__notice" role="status">
            {unpublished && t('businessInsights.state.unpublished')}
            {inactive && t('businessInsights.state.inactive')}
            {!unpublished && !inactive && !displayed.trackingStartedAt && t('businessInsights.state.notStarted')}
            {!unpublished && !inactive && displayed.trackingStartedAt && t('businessInsights.state.collectingSince', {
              date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(displayed.trackingStartedAt)),
            })}
          </p>
          <p className="business-insights__range-label">{rangeLabel}</p>
          <div className="business-insights__grid">
            {metricKeys.map((key) => <article key={key}><strong>{displayed.selectedRange[key]}</strong><span>{t(`businessInsights.${key}`)}</span><small>{t('businessInsights.selectedPeriod')}</small></article>)}
          </div>
          {metricKeys.every((key) => displayed.selectedRange[key] === 0) && <p className="business-insights__empty">{t('businessInsights.state.empty')}</p>}
          <section className="business-insights__all-time" aria-labelledby="insights-all-time-title">
            <h3 id="insights-all-time-title">{t('businessInsights.allTimeTitle')}</h3>
            <dl>{metricKeys.map((key) => <div key={key}><dt>{t(`businessInsights.${key}`)}</dt><dd>{displayed.allTime[key]}</dd></div>)}</dl>
          </section>
          <section className="business-insights__breakdown" aria-labelledby="contact-breakdown-title">
            <h3 id="contact-breakdown-title">{t('businessInsights.contactBreakdownSelected')}</h3>
            <dl>{BUSINESS_CONTACT_ACTIONS.map((action) => <div key={action}><dt>{t(`businessInsights.actions.${action}`)}</dt><dd>{displayed.selectedRange.contactActionBreakdown[action]}</dd></div>)}</dl>
          </section>
          <section className="business-insights__activity" aria-labelledby="insights-activity-title">
            <h3 id="insights-activity-title">{t('businessInsights.activityTitle')}</h3>
            <p>{t('businessInsights.activityDescription')}</p>
            <ol
              className={`business-insights__activity-days business-insights__activity-days--${chartConfiguration.density}`}
              data-day-count={displayed.days.length}
              style={{ '--activity-day-count': displayed.days.length }}
            >
              {displayed.days.map((day, index) => {
                const total = totalActivity(day)
                const date = localeDate(day.date, locale)
                const showLabel = showActivityDayLabel(index, displayed.days.length)
                return <li aria-label={t('businessInsights.dayLabel', { date, count: total })} key={day.date}><span style={{ '--activity-size': `${Math.max(total ? 8 : 2, (total / maximum) * 100)}%` }} />{showLabel && <small aria-hidden="true">{day.date.slice(8)}</small>}<span className="visually-hidden">{t('businessInsights.dayDetails', { views: day.profileViews, enquiries: day.enquiries, contacts: day.contactActions })}</span></li>
              })}
            </ol>
          </section>
        </>
      )}
    </section>
  )
}
