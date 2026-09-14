// Synthetic boundaries; provider and protected/business guards are original.
import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import Provider from '../../../src/context/AuthenticationProvider.jsx'
import useAuthentication from '../../../src/hooks/useAuthentication.js'
import ProtectedRoute from '../../../src/routes/ProtectedRoute.jsx'
import LegalConsentPage from '../../../src/pages/auth/LegalConsentPage.jsx'
import BusinessRoute from '../../../src/routes/BusinessRoute.jsx'

await i18n.use(initReactI18next).init({ lng: 'en', resources: { en: { translation: {} } }, fallbackLng: false })
const timestamp = { seconds: 1, nanoseconds: 0, toMillis: () => 1000 }
const profile = (uid, roles) => ({
  uid, displayName: 'Person ' + uid, roles, accountStatus: 'active',
  profileCompleted: true, onboardingCompleted: true,
  termsAccepted: true, privacyAccepted: true, termsVersion: '1.1', privacyVersion: '1.1',
  termsAcceptedAt: timestamp, privacyAcceptedAt: timestamp, businessId: 'business-' + uid,
})
const harness = window.h = {
  profiles: { A: profile('A', ['business']), B: profile('B', ['customer']) },
  queues: {}, pending: {}, done: {}, events: [], observers: [], subscriptions: 0, cleanups: 0,
  call(kind, uid) {
    this.events.push({ kind, uid })
    const id = this.queues[kind]?.shift()
    if (id) return new Promise((resolve, reject) => { this.pending[id] = { resolve, reject } })
    return Promise.resolve(kind === 'read' ? this.profiles[uid] : undefined)
  },
  defer(kind, id) { (this.queues[kind] ??= []).push(id) },
  resolve(id, value) { this.pending[id].resolve(value) },
  reject(id, code) { this.pending[id].reject(Object.assign(new Error(code), { code })) },
  emit(uid, emailVerified = true) {
    return this.observer(uid ? { uid, emailVerified } : null)
  },
  start(method, ...args) {
    this.done[method] = null
    this.api[method](...args).then(value => {
      this.done[method] = { value }
      this.events.push({ completed: method })
    }, error => {
      this.done[method] = { error: error.message }
      this.events.push({ rejected: method, code: error.code })
    })
  },
}
export function Probe() {
  const auth = useAuthentication()
  const navigate = useNavigate()
  const location = useLocation()
  const state = {
    uid: auth.user?.uid ?? null, profileUid: auth.userProfile?.uid ?? null,
    name: auth.userProfile?.displayName ?? null, roles: auth.userProfile?.roles ?? null,
    loading: auth.loading, profileLoading: auth.profileLoading, status: auth.profileStatus,
    error: auth.sessionError, verified: auth.emailVerified, path: location.pathname,
  }
  useEffect(() => {
    harness.api = auth
    harness.nav = navigate
    harness.state = state
    harness.events.push({ state })
  })
  return <pre id="state">{JSON.stringify(state)}</pre>
}
export function Fixture() {
  return <Provider><BrowserRouter><Probe /><Routes>
    <Route element={<ProtectedRoute />}>
      <Route element={<BusinessRoute />}>
        <Route path="/business" element={<div id="business">Business content</div>} />
      </Route>
      <Route path="/secure" element={<div id="secure">Protected content</div>} />
    </Route>
    <Route path="/legal-consent" element={<LegalConsentPage />} />
    <Route path="*" element={<div id="destination">Destination</div>} />
  </Routes></BrowserRouter></Provider>
}
let root = createRoot(document.getElementById('root'))
harness.remount = () => {
  root.unmount()
  root = createRoot(document.getElementById('root'))
  root.render(<StrictMode><Fixture /></StrictMode>)
}
root.render(<StrictMode><Fixture /></StrictMode>)
