import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import RegisterPage from '../../../src/pages/auth/RegisterPage.jsx'
import i18n from '../../../src/i18n/index.js'
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '../../../src/utils/policies.js'
import '../../../src/styles/tokens.css'
import '../../../src/styles/base.css'
import '../../../src/styles/global.css'

await i18n.changeLanguage('en')
window.registrationFixture = {
  calls: [], termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION,
  mismatch: i18n.t('auth.registration.passwordMismatch'),
}
createRoot(document.getElementById('root')).render(<StrictMode><BrowserRouter><Routes>
  <Route path="/register" element={<RegisterPage />} />
  <Route path="/verify-email" element={<p data-testid="verified-destination">Synthetic verification destination</p>} />
</Routes></BrowserRouter></StrictMode>)
