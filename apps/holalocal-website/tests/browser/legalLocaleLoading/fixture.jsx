import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import LanguageSwitcher from '../../../src/components/common/LanguageSwitcher.jsx'
import PrivacyPage from '../../../src/pages/PrivacyPage.jsx'
import TermsPage from '../../../src/pages/TermsPage.jsx'
import { i18nReady } from '../../../src/i18n/index.js'
import '../../../src/styles/tokens.css'
import '../../../src/styles/base.css'
import '../../../src/styles/global.css'
await i18nReady
createRoot(document.getElementById('root')).render(<BrowserRouter><LanguageSwitcher /><nav><Link to="/privacy">Privacy fixture</Link><Link to="/terms">Terms fixture</Link></nav><Routes><Route path="/privacy" element={<PrivacyPage />} /><Route path="/terms" element={<TermsPage />} /></Routes></BrowserRouter>)
