import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../../../src/i18n/locales/en.json'
import '../../../src/styles/tokens.css'
import '../../../src/styles/base.css'
import '../../../src/styles/global.css'
export const Home = lazy(() => import('../../../src/pages/HomePage.jsx'))
export const Services = lazy(() => import('../../../src/pages/ServicesPage.jsx'))
export const Editor = lazy(() => import('../../../src/pages/business/EditBusinessPage.jsx'))
export const Variants = lazy(() => import('./variants.jsx'))
await i18n.use(initReactI18next).init({ lng: 'en', resources: { en: { translation: en } }, fallbackLng: false })
const business = { businessId: 'synthetic-business', ownerId: 'synthetic-owner', managerIds: [], name: 'Synthetic Costa Home and Garden – Reparaciones y mantenimiento para toda la comunidad', description: ('A long synthetic description of reliable local services and garden maintenance. ').repeat(12), category: 'handyman', primaryCategoryId: 'handyman', categoryIds: ['handyman'], serviceIds: ['handyman'], serviceAreas: ['marbella', 'estepona'], serviceArea: 'Marbella / Estepona', languages: ['en', 'de', 'es'], primaryLanguage: 'en', location: { locality: 'Marbella', region: 'malaga', countryCode: 'ES' }, status: 'active', contact: {}, publicContact: {}, galleryImages: [], galleryUrls: [], services: ['handyman'] }
window.h = { events: [], business, businesses: [business, { ...business, businessId: 'synthetic-logo', name: 'Synthetic Logo Business', logoUrl: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="navy"/></svg>') }, { ...business, businessId: 'synthetic-broken', name: 'Broken Image Fallback', logoUrl: '/broken-logo.png' }], user: { uid: 'synthetic-owner', emailVerified: true }, profile: { roles: ['business'], accountStatus: 'active', businessId: 'synthetic-business', preferredLocale: 'en' } }
createRoot(document.getElementById('root')).render(<BrowserRouter><nav aria-label="Fixture navigation"><Link to="/">Fixture Home</Link> <Link to="/services">Fixture Services</Link> <Link to="/editor">Fixture Editor</Link> <Link to="/variants">Fixture Variants</Link></nav><Suspense fallback={<p>Loading fixture</p>}><Routes><Route path="/" element={<Home />} /><Route path="/services" element={<Services />} /><Route path="/services/:businessId" element={<Services />} /><Route path="/editor" element={<Editor />} /><Route path="/variants" element={<Variants />} /></Routes></Suspense></BrowserRouter>)
