import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LocationCombobox from '../../../src/components/business/LocationCombobox.jsx'
import EditBusinessPage from '../../../src/pages/business/EditBusinessPage.jsx'
import { primaryLocationInputState, primaryLocationSelectionState } from '../../../src/utils/locations.js'
import '../../../src/styles/tokens.css'
import '../../../src/styles/base.css'
import '../../../src/styles/global.css'
await i18n.use(initReactI18next).init({ lng: 'en', resources: { en: { translation: {} } }, fallbackLng: false })
window.h = {
  user: { uid: 'synthetic-owner', emailVerified: true },
  profile: { uid: 'synthetic-owner', businessId: 'synthetic-business', roles: ['business'], accountStatus: 'active', preferredLanguage: 'en' },
  business: { businessId: 'synthetic-business', ownerId: 'synthetic-owner', name: 'Synthetic business', status: 'draft', languages: ['en'], location: { locality: 'Unresolved synthetic village', countryCode: 'ES', region: 'malaga' }, contact: {}, serviceAreas: [] },
}
export function Controls() {
  const [form, setForm] = useState({ city: '', primaryLocationId: '' })
  const [mounted, setMounted] = useState(true)
  window.h.setText = value => setForm(primaryLocationInputState(value))
  window.h.unmount = () => setMounted(false)
  return <main className="auth-card"><h1>Location fixture</h1><button id="before">Before</button>
    <div className="auth-form">{mounted && <LocationCombobox label="Primary location" error={form.city && !form.primaryLocationId ? 'Choose a canonical location' : ''}
      inputValue={form.city} selectedLocationId={form.primaryLocationId}
      onInputChange={value => setForm(primaryLocationInputState(value))}
      onSelect={location => setForm(primaryLocationSelectionState(location))} />}
      <label htmlFor="after">Following field</label><input id="after" />
    </div><button id="outside">Outside</button><output id="canonical">{JSON.stringify(form)}</output>
    <div aria-hidden="true" style={{ height: 1000 }} />
  </main>
}
createRoot(document.getElementById('root')).render(<StrictMode><BrowserRouter>
  {new URLSearchParams(location.search).has('editor') ? <EditBusinessPage /> : <Controls />}
</BrowserRouter></StrictMode>)
