import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import LanguageSwitcher from '../../../src/components/common/LanguageSwitcher.jsx'
import ForgotPasswordPage from '../../../src/pages/auth/ForgotPasswordPage.jsx'
import RegisterPage from '../../../src/pages/auth/RegisterPage.jsx'
import { i18nReady } from '../../../src/i18n/index.js'
import '../../../src/styles/tokens.css'
import '../../../src/styles/base.css'
import '../../../src/styles/global.css'
await i18nReady
window.operationalFixture = { resets: [] }
createRoot(document.getElementById('root')).render(<BrowserRouter><LanguageSwitcher /><Link to="/register">Registration fixture</Link><Routes><Route path="/recovery" element={<ForgotPasswordPage />} /><Route path="/register" element={<RegisterPage />} /></Routes></BrowserRouter>)
