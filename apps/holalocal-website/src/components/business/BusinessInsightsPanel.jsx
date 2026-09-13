import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BUSINESS_CONTACT_ACTIONS } from '@holalocal/firebase-contract'
import SelectField from '../common/SelectField.jsx'
import { getOwnerBusinessInsights } from '../../services/businessInsightsService.js'
import {
  currentLocalDateKey,
  INSIGHT_RANGE_PRESETS,
  localeDate,
  presetDateRequest,
  validateCustomInsightRange,
} from '../../services/businessInsightsRanges.js'

const metricKeys = ['profileViews', 'enquiries', 'contactActions']

const contactIcons = {
  holalocal: 'M4 4h16v12H9l-5 4V4Z',
  phone: 'M7 3H3c0 10 8 18 18 18v-4l-5-2-2 2a15 15 0 0 1-7-7l2-2-2-5Z',
  email: 'M3 5h18v14H3V5Zm0 0 9 8 9-8',
  whatsapp: 'M12 3a9 9 0 0 1 0 18 9 9 0 0 1-4-1l-5 1 1-5a9 9 0 0 1 8-13Zm-4 5c0 4 4 8 8 8',
  website: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z',
}

export default function BusinessInsightsPanel({ businessId, status, business }) {
  const { i18n, t } = useTranslation()
  const today = currentLocalDateKey()
  const defaultDates = presetDateRequest('last_30_days', today)
  const [state, setState] = useState({ status: 'loading', data: null })
  const [selection, setSelection] = useState({ preset: 'last_30_days', request: null })
  const [custom, setCustom] = useState(defaultDates)
  const [validationError, setValidationError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [metric, setMetric] = useState('profileViews')
  const [chartWidth, setChartWidth] = useState(640)
  const chartContainer = useRef(null)
  const unrecordedPattern = useId()

  useEffect(() => {
    if (!chartContainer.current) return
    const observer = new ResizeObserver(([entry]) => setChartWidth(Math.max(1, Math.round(entry.contentRect.width))))
    observer.observe(chartContainer.current)
    return () => observer.disconnect()
  }, [state.data])

  useEffect(() => {
    let current = true
    getOwnerBusinessInsights(businessId, selection.request)
      .then((data) => { if (current) setState({ status: 'ready', data }) })
      .catch(() => { if (current) setState((previous) => ({ status: 'error', data: previous.data })) })
    return () => { current = false }
  }, [attempt, businessId, selection.request])

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

  function choosePreset(preset) {
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
  const contact = business?.publicContact ?? {}
  const publicAvailable = Boolean(business?.publicContact)
  const available = {
    holalocal: publicAvailable && Boolean(business?.ownerId),
    phone: publicAvailable && Boolean(contact.phone),
    email: publicAvailable && Boolean(contact.email),
    whatsapp: publicAvailable && Boolean(contact.whatsappNumber),
    website: publicAvailable && Boolean(contact.website),
  }
  const visibleActions = BUSINESS_CONTACT_ACTIONS.filter((action) => (
    available[action] || (displayed?.selectedRange.contactActionBreakdown[action] ?? 0) > 0
  ))
  const rangeLabel = displayed
    ? t('businessInsights.range.dates', {
        start: localeDate(displayed.range.startDate, locale),
        end: localeDate(displayed.range.endDate, locale),
      })
    : ''
  const trackingDate = displayed?.trackingStartedAt ? new Date(displayed.trackingStartedAt).toISOString().slice(0, 10) : null
  const isRecorded = (day) => !trackingDate || day.date >= trackingDate
  const maximum = Math.max(4, Math.ceil(Math.max(0, ...(displayed?.days ?? []).filter(isRecorded).map((day) => day[metric])) / 4) * 4)
  const hasActivity = displayed?.days.some((day) => isRecorded(day) && day[metric] > 0) ?? false
  const hasUnrecordedDays = displayed?.days.some((day) => !isRecorded(day)) ?? false
  const plotWidth = Math.max(1, chartWidth - 64)
  const partialCoverage = trackingDate && new Date(displayed.trackingStartedAt).getTime() > Date.parse(`${displayed.range.startDate}T00:00:00Z`)
  const number = (value) => new Intl.NumberFormat(locale).format(value)
  const rangeOptions = INSIGHT_RANGE_PRESETS.map((preset) => ({
    label: t(`businessInsights.range.presets.${preset}`),
    value: preset,
  }))

  return (
    <section className="account-card business-insights" aria-labelledby="business-insights-title">
      <header className="business-insights__header">
        <div>
        <h2 id="business-insights-title">{t('businessInsights.title')}</h2>
        <p>{t('businessInsights.subtitle')}</p>
        </div>

      <div className="business-insights__range-controls" aria-busy={state.status === 'loading'}>
        <div className="business-insights__range-select">
          <label htmlFor="business-insights-range">{t('businessInsights.range.label')}</label>
          <SelectField
            ariaLabel={t('businessInsights.range.label')}
            className="select-field--form business-insights__range-field"
            disabled={state.status === 'loading'}
            id="business-insights-range"
            onChange={choosePreset}
            options={rangeOptions}
            value={selection.preset}
          />
        </div>
        {selection.preset === 'custom' && (
          <form className="business-insights__custom-range" onSubmit={applyCustomRange}>
            <label>{t('businessInsights.range.from')}<input aria-describedby={validationError ? 'business-insights-range-error' : undefined} aria-invalid={Boolean(validationError)} max={today} onChange={(event) => setCustom((value) => ({ ...value, startDate: event.target.value }))} type="date" value={custom.startDate} /></label>
            <label>{t('businessInsights.range.to')}<input aria-describedby={validationError ? 'business-insights-range-error' : undefined} aria-invalid={Boolean(validationError)} max={today} onChange={(event) => setCustom((value) => ({ ...value, endDate: event.target.value }))} type="date" value={custom.endDate} /></label>
            <button className="button button--secondary" disabled={state.status === 'loading'} type="submit">{t('businessInsights.range.apply')}</button>
          </form>
        )}
        {validationError && <p className="business-insights__range-error" id="business-insights-range-error" role="alert">{validationError}</p>}
      </div>

      </header>
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
            <span>{rangeLabel}</span>
            <span>{trackingDate ? t(partialCoverage ? 'businessInsights.partialCoverage' : 'businessInsights.state.collectingSince', { date: localeDate(trackingDate, locale) }) : t('businessInsights.state.notStarted')}</span>
            {(unpublished || inactive) && <span>{t(unpublished ? 'businessInsights.state.unpublished' : 'businessInsights.state.inactive')}</span>}
          </p>
          <div className="business-insights__grid">
            {metricKeys.map((key) => <article key={key}><span>{t(`businessInsights.${key}`)}</span><strong>{number(displayed.selectedRange[key])}</strong></article>)}
          </div>
          <section ref={chartContainer} className="business-insights__activity" aria-labelledby="insights-activity-title">
            <div className="business-insights__chart-heading">
              <h3 id="insights-activity-title">{t('businessInsights.activityTitle')}</h3>
              <div><label htmlFor="business-insights-metric">{t('businessInsights.metric')}</label><SelectField id="business-insights-metric" ariaLabel={t('businessInsights.metric')} className="select-field--form" value={metric} onChange={setMetric} options={metricKeys.map((key) => ({ value: key, label: t(`businessInsights.${key}`) }))} /></div>
            </div>
            {hasActivity || hasUnrecordedDays ? <svg className="business-insights__chart" viewBox={`0 0 ${chartWidth} 200`} aria-hidden="true">
              <defs><pattern id={unrecordedPattern} width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#f1f5f9" /><path d="M0 8 8 0" stroke="#cbd5e1" strokeWidth="1" /></pattern></defs>
              {displayed.days.map((day, index) => !isRecorded(day) && <rect className="business-insights__unrecorded" key={day.date} x={44 + index * plotWidth / displayed.days.length} y="25" width={plotWidth / displayed.days.length} height="140" fill={`url(#${unrecordedPattern})`} />)}
              {[0, maximum / 2, maximum].map((tick) => <g key={tick}><line x1="44" x2={chartWidth - 20} y1={165 - tick / maximum * 140} y2={165 - tick / maximum * 140} /><text x="36" y={169 - tick / maximum * 140} textAnchor="end">{number(tick)}</text></g>)}
              {displayed.days.map((day, index) => isRecorded(day) && <rect className="business-insights__bar" data-date={day.date} key={day.date} x={44 + index * plotWidth / displayed.days.length} y={165 - day[metric] / maximum * 140} width={plotWidth / displayed.days.length * 0.8} height={day[metric] / maximum * 140} />)}
              {[0, Math.floor((displayed.days.length - 1) / 2), displayed.days.length - 1].filter((index, position, items) => items.indexOf(index) === position).map((index, position) => <text key={index} x={position === 0 ? 44 : index === displayed.days.length - 1 ? chartWidth - 20 : 44 + plotWidth / 2} y="190" textAnchor={position === 0 ? 'start' : index === displayed.days.length - 1 ? 'end' : 'middle'}>{new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${displayed.days[index].date}T00:00:00Z`))}</text>)}
            </svg> : <div className="business-insights__activity-empty" role="status"><p>{t('businessInsights.emptyMetric')}</p></div>}
            {hasUnrecordedDays && <p className="business-insights__legend"><span aria-hidden="true" />{t('businessInsights.notRecorded')}</p>}
            <details className="business-insights__details"><summary>{t('businessInsights.exactValues')}</summary><div className="business-insights__table" tabIndex={0} role="region" aria-label={t('businessInsights.exactValues')}><table><thead><tr><th scope="col">{t('businessInsights.range.label')}</th><th scope="col">{t(`businessInsights.${metric}`)}</th></tr></thead><tbody>{displayed.days.map((day) => <tr key={day.date}><th scope="row">{localeDate(day.date, locale)}</th><td>{isRecorded(day) ? number(day[metric]) : t('businessInsights.notRecorded')}</td></tr>)}</tbody></table></div></details>
          </section>
          {visibleActions.length > 0 && <section className="business-insights__breakdown" aria-labelledby="contact-breakdown-title">
            <h3 id="contact-breakdown-title">{t('businessInsights.contactBreakdownSelected')}</h3>
            <dl>{visibleActions.map((action) => <div key={action}><dt><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d={contactIcons[action]} /></svg><span>{t(`businessInsights.actions.${action}`)}{!available[action] && <small>{t('businessInsights.historicalChannel')}</small>}</span></dt><dd>{number(displayed.selectedRange.contactActionBreakdown[action])}</dd></div>)}</dl>
          </section>}
          <details className="business-insights__details"><summary>{t('businessInsights.about')}</summary><p>{t('businessInsights.description')}</p><p>{t('businessInsights.activityDescription')}</p></details>
          <section className="business-insights__all-time" aria-labelledby="insights-all-time-title">
            <h3 id="insights-all-time-title">{t('businessInsights.allTimeTitle')}</h3>
            <dl>{metricKeys.map((key) => <div key={key}><dt>{t(`businessInsights.${key}`)}</dt><dd>{number(displayed.allTime[key])}</dd></div>)}</dl>
          </section>
        </>
      )}
    </section>
  )
}
