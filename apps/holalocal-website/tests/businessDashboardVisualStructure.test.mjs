import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const dashboardUrl = new URL('../src/pages/business/BusinessDashboardPage.jsx', import.meta.url)
const insightsUrl = new URL('../src/components/business/BusinessInsightsPanel.jsx', import.meta.url)
const stylesUrl = new URL('../src/styles/global.css', import.meta.url)

test('business dashboard keeps its data, conditions, and destinations unchanged', async () => {
  const source = await readFile(dashboardUrl, 'utf8')

  assert.match(source, /ensureBusinessProfile\(userId/)
  assert.match(source, /getBusinessProfileCompletion\(businessProfile\)/)
  assert.match(source, /isOwnerEditableBusinessStatus\(status\)/)
  assert.match(source, /loadOwnerSubscriptionProjection/)
  assert.match(source, /<BusinessInsightsPanel businessId=\{businessProfile\.businessId\} status=\{status\} \/>/)
  assert.match(source, /to="\/business\/edit"/)
  assert.match(source, /to="\/business\/edit#business-contact-title"/)
  assert.match(source, /to="\/subscription"/)
})

test('dashboard cards use natural height and balanced responsive placement', async () => {
  const [source, styles] = await Promise.all([readFile(dashboardUrl, 'utf8'), readFile(stylesUrl, 'utf8')])

  assert.match(styles, /\.business-dashboard__grid \{[\s\S]*?align-items: start;/)
  assert.match(styles, /\.business-dashboard__card \{[\s\S]*?align-self: start;/)
  assert.doesNotMatch(styles.match(/\.business-dashboard__card \{[^}]*\}/)?.[0] ?? '', /height:/)
  assert.match(source, /className="business-dashboard__status-stack"[\s\S]*?business-dashboard__card--next[\s\S]*?business-dashboard__card--visibility/)
  assert.match(styles, /\.business-dashboard__status-stack \{[\s\S]*?display: grid;[\s\S]*?gap: 0\.9rem;[\s\S]*?align-self: start;/)
  assert.match(styles, /@media \(min-width: 64rem\) \{[\s\S]*?\.business-dashboard__grid \{[\s\S]*?grid-template-columns: repeat\(12, minmax\(0, 1fr\)\)/)
  assert.match(styles, /\.business-dashboard__card--completion,[\s\S]*?\.business-dashboard__card--coverage,[\s\S]*?grid-column: span 6;/)
  assert.match(styles, /\.business-dashboard__status-stack,[\s\S]*?\.business-dashboard__card--account-summary,[\s\S]*?grid-column: span 6;/)
  assert.match(styles, /\.business-dashboard__card--completion,[\s\S]*?\.business-dashboard__card--coverage,[\s\S]*?\.business-dashboard__card--account-summary \{[\s\S]*?align-self: stretch;/)
  assert.match(styles, /\.business-dashboard__card--coverage \.business-dashboard__details \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(styles, /\.business-dashboard__card--actions \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto;/)
  assert.match(styles, /\.business-summary \.image-avatar--business-logo \{[\s\S]*?width: 6rem;/)
})

test('dashboard loading uses one accessible layout skeleton without changing readiness logic', async () => {
  const [source, styles] = await Promise.all([readFile(dashboardUrl, 'utf8'), readFile(stylesUrl, 'utf8')])

  assert.match(source, /function BusinessDashboardSkeleton\(\{ message \}\)/)
  assert.match(source, /aria-busy="true" aria-live="polite" role="status"/)
  assert.match(source, /<p className="visually-hidden">\{message\}<\/p>/)
  assert.match(source, /<div className="business-dashboard-skeleton__grid" aria-hidden="true">/)
  assert.match(source, /if \(loading\) return <BusinessDashboardSkeleton message=\{t\('business\.control\.loading'\)\} \/>/)
  assert.doesNotMatch(source, /setTimeout|artificialDelay/)
  assert.match(styles, /\.business-dashboard-skeleton__grid \{[\s\S]*?display: grid;/)
  assert.match(styles, /@media \(min-width: 64rem\) \{[\s\S]*?\.business-dashboard-skeleton__grid \{[\s\S]*?grid-template-columns: repeat\(12, minmax\(0, 1fr\)\)/)
  assert.doesNotMatch(styles.match(/\.business-dashboard-skeleton \{[^}]*\}/)?.[0] ?? '', /animation:/)
})

test('insights preserve accessible state and range structures with compact empty activity', async () => {
  const [insights, styles] = await Promise.all([readFile(insightsUrl, 'utf8'), readFile(stylesUrl, 'utf8')])

  assert.match(insights, /htmlFor="business-insights-range"/)
  assert.match(insights, /aria-live="polite" role="status"/)
  assert.match(insights, /aria-live="assertive"[\s\S]*?role="alert"/)
  assert.match(insights, /displayed\.selectedRange/)
  assert.match(insights, /displayed\.allTime/)
  assert.match(styles, /\.business-insights__activity-empty \{[\s\S]*?border: 1px solid/)
  assert.doesNotMatch(styles.match(/\.business-insights__activity-empty \{[^}]*\}/)?.[0] ?? '', /dashed/)
})
