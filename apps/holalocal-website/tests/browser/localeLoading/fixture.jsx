import { createRoot } from 'react-dom/client'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../../../src/components/common/LanguageSwitcher.jsx'
import i18n, { i18nReady } from '../../../src/i18n/index.js'
import '../../../src/styles/tokens.css'
import '../../../src/styles/base.css'
import '../../../src/styles/global.css'
await i18nReady
window.localeFixture = { i18n }
export function Fixture() {
 const { t }=useTranslation()
 return <main className="account-card"><LanguageSwitcher /><h1>{t('businessInsights.title')}</h1><p>{t('business.control.statusExplanation')}</p><p>{t('businessInsights.state.collectingSince',{date:'DATE-SENTINEL'})}</p></main>
}
createRoot(document.getElementById('root')).render(<Fixture />)
