import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import BusinessDashboardPage from '../../../src/pages/business/BusinessDashboardPage.jsx'
import i18n, { loadLocale } from '../../../src/i18n/index.js'
import '../../../src/styles/tokens.css'
import '../../../src/styles/base.css'
import '../../../src/styles/global.css'
const locale = new URLSearchParams(location.search).get('locale') || 'en'
await loadLocale(locale); await i18n.changeLanguage(locale)
window.statusFixture = { explanation: i18n.t('business.control.statusExplanation'), draft: i18n.t('business.control.status.draft') }
createRoot(document.getElementById('root')).render(<BrowserRouter><div className="site-shell"><main className="site-content"><BusinessDashboardPage /></main></div></BrowserRouter>)
