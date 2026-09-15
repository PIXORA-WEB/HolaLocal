import {createRoot} from 'react-dom/client'
import {BrowserRouter,Routes,Route} from 'react-router-dom'
import SiteHeader from '../../../src/components/layout/SiteHeader.jsx'
import SiteFooter from '../../../src/components/layout/SiteFooter.jsx'
import AdminLayout from '../../../src/components/layout/AdminLayout.jsx'
import OnboardingPage from '../../../src/pages/auth/OnboardingPage.jsx'
import {i18nReady} from '../../../src/i18n/index.js'
import '../../../src/styles/tokens.css'
import '../../../src/styles/base.css'
import '../../../src/styles/global.css'
await i18nReady
createRoot(document.getElementById('root')).render(<BrowserRouter><Routes><Route path="/" element={<><SiteHeader/><SiteFooter/></>}/><Route path="/onboarding" element={<OnboardingPage/>}/><Route path="/admin" element={<AdminLayout/>}/></Routes></BrowserRouter>)
