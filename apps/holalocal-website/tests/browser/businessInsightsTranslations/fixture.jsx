import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import BusinessInsightsPanel from '../../../src/components/business/BusinessInsightsPanel.jsx'
import i18n, { loadLocale } from '../../../src/i18n/index.js'
import { formatPickerDate } from '../../../src/components/common/datePickerDates.js'
import { localeDate } from '../../../src/services/businessInsightsRanges.js'
import '../../../src/styles/tokens.css'
import '../../../src/styles/base.css'
import '../../../src/styles/global.css'
const locale = new URLSearchParams(location.search).get('locale') || 'de'
await loadLocale(locale); await i18n.changeLanguage(locale)
const totals = { profileViews: 0, enquiries: 0, contactActions: 0, contactActionBreakdown: {} }
window.insights = {
  pending: [], calls: [],
  t: (key, options) => i18n.t(`businessInsights.${key}`, options),
  switchLanguage: async code => { await loadLocale(code); await i18n.changeLanguage(code) },
  date: value => formatPickerDate(value, i18n.language),
  collecting: () => i18n.t('businessInsights.state.collectingSince', { date: localeDate('2026-01-01', i18n.language) }),
  resolve: (tracking = false) => window.insights.pending.shift().resolve({
    range: { startDate: '2026-01-01', endDate: '2026-01-02' },
    trackingStartedAt: tracking ? '2026-01-01T00:00:00Z' : null,
    selectedRange: totals, allTime: totals,
    days: ['2026-01-01','2026-01-02'].map(date => ({ date, ...totals })),
  }),
  reject: () => window.insights.pending.shift().reject(new Error('Synthetic unavailable')),
}
export function Fixture() {
  const [status, setStatus] = useState('active')
  window.insights.setStatus = setStatus
  return <div className="site-shell"><main className="site-content"><BusinessInsightsPanel businessId="synthetic-business" status={status} business={{ ownerId: 'synthetic-owner', publicContact: {} }} /></main></div>
}
createRoot(document.getElementById('root')).render(<Fixture />)
