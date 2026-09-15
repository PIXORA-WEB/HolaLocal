import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import LanguageSwitcher from '../../../src/components/common/LanguageSwitcher.jsx'
import RegisterPage from '../../../src/pages/auth/RegisterPage.jsx'
import LegalConsentPage from '../../../src/pages/auth/LegalConsentPage.jsx'
import { i18nReady } from '../../../src/i18n/index.js'
import '../../../src/styles/tokens.css'
import '../../../src/styles/base.css'
import '../../../src/styles/global.css'
await i18nReady
window.consentFixture = { registrations: [], consents: 0 }
createRoot(document.getElementById('root')).render(<BrowserRouter><LanguageSwitcher /><nav><Link to="/register">Registration fixture</Link><Link to="/consent">Consent fixture</Link></nav><Routes><Route path="/register" element={<RegisterPage />} /><Route path="/consent" element={<LegalConsentPage />} /><Route path="/verify-email" element={<p data-destination>Fixture verification</p>} /></Routes></BrowserRouter>)
