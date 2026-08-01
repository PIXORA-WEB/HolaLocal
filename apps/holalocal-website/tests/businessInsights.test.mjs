import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { BUSINESS_INSIGHT_TOKEN_PATTERN } from '@holalocal/firebase-contract'
import {
  createBusinessInsightsTracker,
  profileViewToken,
  secureRandomToken,
} from '../src/services/businessInsightsTracking.js'
import {
  activityChartConfiguration,
  currentLocalDateKey,
  INSIGHT_RANGE_PRESETS,
  presetDateRequest,
  showActivityDayLabel,
  validateCustomInsightRange,
} from '../src/services/businessInsightsRanges.js'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('dashboard uses real insights states and excludes misleading placeholder metrics', async () => {
  const [dashboard, panel] = await Promise.all([
    read('../src/pages/business/BusinessDashboardPage.jsx'),
    read('../src/components/business/BusinessInsightsPanel.jsx'),
  ])
  assert.match(dashboard, /<BusinessInsightsPanel/)
  for (const state of ['loading', 'loadingRange', 'error', 'unpublished', 'inactive', 'notStarted', 'collectingSince', 'empty']) {
    assert.match(panel, new RegExp(`businessInsights\\.state\\.${state}`))
  }
  assert.doesNotMatch(panel, /saved|reviews|rating|revenue/i)
  assert.match(panel, /setAttempt/)
  assert.match(panel, /displayed\.days\.map/)
  assert.match(panel, /useState\(\{ preset: 'last_30_days'/)
  assert.match(panel, /selection\.preset === 'custom'/)
  assert.match(panel, /validateCustomInsightRange/)
  assert.match(panel, /displayed\.selectedRange/)
  assert.match(panel, /displayed\.allTime/)
  assert.match(panel, /max=\{today\}/)
})

test('presets use the required order and keep Last 30 days as the default', async () => {
  assert.deepEqual(INSIGHT_RANGE_PRESETS, [
    'last_7_days',
    'last_30_days',
    'this_month',
    'last_month',
    'last_90_days',
    'custom',
  ])
  const [panel, englishSource] = await Promise.all([
    read('../src/components/business/BusinessInsightsPanel.jsx'),
    read('../src/i18n/locales/en.json'),
  ])
  const labels = JSON.parse(englishSource).businessInsights.range.presets
  assert.deepEqual(INSIGHT_RANGE_PRESETS.map((preset) => labels[preset]), [
    'Last 7 days',
    'Last 30 days',
    'This month',
    'Last month',
    'Last 90 days',
    'Custom dates',
  ])
  assert.match(panel, /useState\(\{ preset: 'last_30_days', request: null \}\)/)
  assert.match(panel, /INSIGHT_RANGE_PRESETS\.map/)
})

test('rolling preset requests use inclusive UTC 7, 30 and 90-day boundaries', () => {
  assert.deepEqual(presetDateRequest('last_7_days', '2026-08-01'), { startDate: '2026-07-26', endDate: '2026-08-01' })
  assert.deepEqual(presetDateRequest('last_30_days', '2026-08-01'), { startDate: '2026-07-03', endDate: '2026-08-01' })
  assert.deepEqual(presetDateRequest('last_90_days', '2026-08-01'), { startDate: '2026-05-04', endDate: '2026-08-01' })
})

test('local today remains 1 August while the corresponding UTC instant is 31 July', () => {
  const madridBoundary = new Date('2026-07-31T22:30:00.000Z')
  madridBoundary.getFullYear = () => 2026
  madridBoundary.getMonth = () => 7
  madridBoundary.getDate = () => 1

  assert.equal(madridBoundary.toISOString().slice(0, 10), '2026-07-31')
  const today = currentLocalDateKey(madridBoundary)
  assert.equal(today, '2026-08-01')
  assert.deepEqual(presetDateRequest('this_month', today), { startDate: '2026-08-01', endDate: '2026-08-01' })
  assert.deepEqual(presetDateRequest('last_month', today), { startDate: '2026-07-01', endDate: '2026-07-31' })
})

test('This month begins on day one and ends today at month boundaries', () => {
  assert.deepEqual(presetDateRequest('this_month', '2026-08-17'), { startDate: '2026-08-01', endDate: '2026-08-17' })
  assert.deepEqual(presetDateRequest('this_month', '2026-08-01'), { startDate: '2026-08-01', endDate: '2026-08-01' })
  assert.deepEqual(presetDateRequest('this_month', '2026-08-31'), { startDate: '2026-08-01', endDate: '2026-08-31' })
})

test('Last month spans the complete previous calendar month', () => {
  assert.deepEqual(presetDateRequest('last_month', '2026-08-17'), { startDate: '2026-07-01', endDate: '2026-07-31' })
  assert.deepEqual(presetDateRequest('last_month', '2026-01-15'), { startDate: '2025-12-01', endDate: '2025-12-31' })
  assert.deepEqual(presetDateRequest('last_month', '2026-05-01'), { startDate: '2026-04-01', endDate: '2026-04-30' })
})

test('Last month handles leap and non-leap February', () => {
  assert.deepEqual(presetDateRequest('last_month', '2024-03-20'), { startDate: '2024-02-01', endDate: '2024-02-29' })
  assert.deepEqual(presetDateRequest('last_month', '2025-03-20'), { startDate: '2025-02-01', endDate: '2025-02-28' })
})

test('calendar presets keep custom controls hidden and preserve the selected preset', async () => {
  const panel = await read('../src/components/business/BusinessInsightsPanel.jsx')
  assert.match(panel, /selection\.preset === 'custom'/)
  assert.match(panel, /setSelection\(\{ preset, request \}\)/)
  assert.match(panel, /value=\{selection\.preset\}/)
  assert.doesNotMatch(panel, /data\.range\.preset/)
})

test('custom ranges validate before a backend request is constructed', () => {
  assert.deepEqual(validateCustomInsightRange('2026-07-01', '2026-07-12', '2026-08-01'), {
    valid: true, startDate: '2026-07-01', endDate: '2026-07-12', numberOfDays: 12,
  })
  assert.equal(validateCustomInsightRange('', '2026-07-12', '2026-08-01').valid, false)
  assert.equal(validateCustomInsightRange('2026-07-13', '2026-07-12', '2026-08-01').reason, 'order')
  assert.equal(validateCustomInsightRange('2026-07-01', '2026-08-02', '2026-08-01').reason, 'future')
  assert.equal(validateCustomInsightRange('2025-07-31', '2026-08-01', '2026-08-01').reason, 'tooLong')
})

test('range UI keeps selected and all-time values separate with accessible zero-day output', async () => {
  const panel = await read('../src/components/business/BusinessInsightsPanel.jsx')
  assert.match(panel, /businessInsights\.selectedPeriod/)
  assert.match(panel, /businessInsights\.range\.dates/)
  assert.match(panel, /businessInsights\.allTimeTitle/)
  assert.match(panel, /aria-label=\{t\('businessInsights\.dayLabel'/)
  assert.match(panel, /Math\.max\(total \? 8 : 2/)
  assert.match(panel, /businessInsights\.state\.collectingSince/)
  assert.doesNotMatch(panel, /saved|reviews/i)
})

test('range toolbar reuses the HolaLocal select and accessible form-control patterns', async () => {
  const [panel, styles] = await Promise.all([
    read('../src/components/business/BusinessInsightsPanel.jsx'),
    read('../src/styles/global.css'),
  ])
  assert.match(panel, /import SelectField from '\.\.\/common\/SelectField\.jsx'/)
  assert.match(panel, /<SelectField[\s\S]*?className="select-field--form business-insights__range-field"/)
  assert.doesNotMatch(panel, /<select/)
  assert.match(panel, /htmlFor="business-insights-range"/)
  assert.match(panel, /type="date"/)
  assert.match(panel, /aria-invalid=\{Boolean\(validationError\)\}/)
  assert.match(panel, /aria-describedby=\{validationError/)
  assert.match(panel, /max=\{today\}/)
  assert.match(styles, /business-insights__range-select[\s\S]*?width: 13rem;[\s\S]*?max-width: 100%/)
  assert.match(styles, /business-insights__range-field \.select-field__menu[\s\S]*?width: min\(16rem, calc\(100vw - 3rem\)\)/)
  assert.match(styles, /business-insights__range-field \.select-field__menu button > span:first-child[\s\S]*?white-space: nowrap/)
  assert.match(styles, /business-insights__custom-range input:focus-visible/)
})

test('zero activity uses a compact state while populated activity retains the chart', async () => {
  const [panel, styles] = await Promise.all([
    read('../src/components/business/BusinessInsightsPanel.jsx'),
    read('../src/styles/global.css'),
  ])
  assert.match(panel, /const hasActivity = displayed\?\.days\.some/)
  assert.match(panel, /hasActivity \? \(/)
  assert.match(panel, /business-insights__activity-empty/)
  assert.match(panel, /<ol className="visually-hidden">/)
  assert.match(panel, /business-insights__activity-days--\$\{chartConfiguration\.density\}/)
  assert.match(styles, /business-insights__activity-empty[\s\S]*?padding: 0\.85rem 1rem/)
  assert.doesNotMatch(styles, /\.business-insights__activity ol\s*\{/)
})

test('all-time and contact summaries keep values grouped in responsive tiles', async () => {
  const [panel, styles] = await Promise.all([
    read('../src/components/business/BusinessInsightsPanel.jsx'),
    read('../src/styles/global.css'),
  ])
  assert.match(panel, /business-insights__all-time/)
  assert.match(panel, /displayed\.allTime\[key\]/)
  assert.match(panel, /business-insights__breakdown/)
  assert.match(panel, /BUSINESS_CONTACT_ACTIONS\.map/)
  assert.match(styles, /business-insights__all-time dl div[\s\S]*?border-radius: 0\.75rem/)
  assert.match(styles, /business-insights__breakdown dl[\s\S]*?minmax\(min\(7rem, 100%\), 1fr\)/)
  assert.doesNotMatch(panel, /saved|reviews/i)
})

test('activity chart config adapts for 7, 30, 90 and 366 days', () => {
  assert.deepEqual(activityChartConfiguration(7), { density: 'spacious', labelEvery: 1 })
  assert.deepEqual(activityChartConfiguration(30), { density: 'spacious', labelEvery: 1 })
  assert.deepEqual(activityChartConfiguration(90), { density: 'compact', labelEvery: 10 })
  assert.deepEqual(activityChartConfiguration(366), { density: 'dense', labelEvery: 0 })
  assert.equal(showActivityDayLabel(6, 7), true)
  assert.equal(showActivityDayLabel(8, 90), false)
  assert.equal(showActivityDayLabel(9, 90), true)
  assert.equal(showActivityDayLabel(365, 366), false)
})

test('dense charts remove fixed gaps while retaining every accessible daily list item', async () => {
  const [panel, styles] = await Promise.all([
    read('../src/components/business/BusinessInsightsPanel.jsx'),
    read('../src/styles/global.css'),
  ])
  assert.match(panel, /data-day-count=\{displayed\.days\.length\}/)
  assert.match(panel, /--activity-day-count/)
  assert.match(panel, /displayed\.days\.map\(\(day, index\)/)
  assert.match(panel, /aria-label=\{t\('businessInsights\.dayLabel'/)
  assert.match(panel, /className="visually-hidden"/)
  assert.match(panel, /showActivityDayLabel/)
  assert.match(styles, /grid-template-columns: repeat\(var\(--activity-day-count\), minmax\(0, 1fr\)\)/)
  assert.match(styles, /business-insights__activity-days--dense[\s\S]*?gap: 0;/)
  assert.match(styles, /business-insights__activity[\s\S]*?min-width: 0;[\s\S]*?max-width: 100%;[\s\S]*?overflow: hidden;/)
  assert.doesNotMatch(styles, /business-insights__activity ol[\s\S]{0,200}display: flex/)
  assert.doesNotMatch(panel, /saved|reviews/i)
})

test('public profile and deliberate contact controls are instrumented non-blockingly', async () => {
  const [services, detail, tracker, tokenHelper] = await Promise.all([
    read('../src/pages/ServicesPage.jsx'),
    read('../src/components/common/BusinessDetailPanel.jsx'),
    read('../src/services/businessInsightsService.js'),
    read('../src/services/businessInsightsTracking.js'),
  ])
  assert.match(services, /recordPublicProfileView\(selectedBusiness\.businessId\)/)
  assert.match(services, /recordPublicContactAction\(selectedBusiness\.businessId, 'holalocal'\)/)
  for (const action of ['phone', 'email', 'whatsapp', 'website']) {
    assert.match(detail, new RegExp(`onContactAction\\?\\.\\('${action}'\\)`))
  }
  assert.match(tracker, /createBusinessInsightsTracker/)
  assert.match(tokenHelper, /Promise\.resolve\(callable\(payload\)\)\.catch/)
  assert.match(tokenHelper, /sessionStorage/)
  assert.doesNotMatch(tracker, /await recordBusinessInsightCallable/)
})

function cryptoSequence() {
  let value = 0
  return {
    getRandomValues(bytes) {
      value += 1
      bytes.fill(value)
      return bytes
    },
  }
}

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

test('profile tracking fails closed when secure cryptography is unavailable', () => {
  const calls = []
  const tracker = createBusinessInsightsTracker({ callable: (payload) => calls.push(payload), cryptoApi: null, storage: memoryStorage() })
  assert.doesNotThrow(() => tracker.recordProfileView('biz'))
  assert.equal(calls.length, 0)
})

test('contact tracking fails closed when secure cryptography throws', () => {
  const calls = []
  const cryptoApi = { getRandomValues() { throw new Error('cryptography unavailable') } }
  const tracker = createBusinessInsightsTracker({ callable: (payload) => calls.push(payload), cryptoApi, storage: memoryStorage() })
  assert.doesNotThrow(() => tracker.recordContactAction('biz', 'phone'))
  assert.equal(calls.length, 0)
})

test('session storage read and write failures remain non-blocking', () => {
  const cryptoApi = cryptoSequence()
  const readFailure = { getItem() { throw new Error('read denied') }, setItem() {} }
  const writeFailure = { getItem() { return null }, setItem() { throw new Error('write denied') } }
  assert.doesNotThrow(() => profileViewToken('biz', { cryptoApi, storage: readFailure }))
  assert.doesNotThrow(() => profileViewToken('biz', { cryptoApi, storage: writeFailure }))
  assert.match(profileViewToken('biz', { cryptoApi, storage: readFailure }), BUSINESS_INSIGHT_TOKEN_PATTERN)
  assert.match(profileViewToken('biz', { cryptoApi, storage: writeFailure }), BUSINESS_INSIGHT_TOKEN_PATTERN)
})

test('secure profile tokens are valid and reused for the same business session', () => {
  const storage = memoryStorage()
  const cryptoApi = cryptoSequence()
  const first = profileViewToken('biz', { cryptoApi, storage })
  const second = profileViewToken('biz', { cryptoApi, storage })
  assert.match(first, BUSINESS_INSIGHT_TOKEN_PATTERN)
  assert.equal(second, first)
  assert.match(secureRandomToken(cryptoApi), BUSINESS_INSIGHT_TOKEN_PATTERN)
})

test('normal contact activations generate separate valid tokens', () => {
  const calls = []
  const tracker = createBusinessInsightsTracker({ callable: (payload) => calls.push(payload), cryptoApi: cryptoSequence(), storage: memoryStorage() })
  tracker.recordContactAction('biz', 'website')
  tracker.recordContactAction('biz', 'website')
  assert.equal(calls.length, 2)
  assert.match(calls[0].eventToken, BUSINESS_INSIGHT_TOKEN_PATTERN)
  assert.match(calls[1].eventToken, BUSINESS_INSIGHT_TOKEN_PATTERN)
  assert.notEqual(calls[0].eventToken, calls[1].eventToken)
})
