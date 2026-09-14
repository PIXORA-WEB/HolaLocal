// Synthetic boundaries; provider and protected/business guards are original.
import { StrictMode, useEffect, useLayoutEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import AdminRoute from '../../../src/routes/AdminRoute.jsx'
import AdminOnlyRoute from '../../../src/routes/AdminOnlyRoute.jsx'
import Provider from '../../../src/context/AuthenticationProvider.jsx'
import useAuthentication from '../../../src/hooks/useAuthentication.js'
import ProtectedRoute from '../../../src/routes/ProtectedRoute.jsx'



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
  users: {}, claims: {}, queues: {}, pending: {}, done: {}, events: [], observers: [], subscriptions: 0, cleanups: 0,
  call(kind, uid, force) {
    this.events.push({ kind, uid, force })
    const id = this.queues[kind]?.shift()
    if (id) return new Promise((resolve, reject) => { this.pending[id] = { resolve, reject } })
    return Promise.resolve(kind === 'read' ? this.profiles[uid] : kind === 'token' ? { claims: this.claims[uid] ?? { admin: true } } : undefined)
  },
  defer(kind, id) { (this.queues[kind] ??= []).push(id) },
  resolve(id, value) { this.pending[id].resolve(value) },
  reject(id, code) { this.pending[id].reject(Object.assign(new Error(code), { code })) },
  emit(uid, emailVerified = true) {
    if (uid) this.users[uid] ??= { uid, emailVerified, getIdTokenResult: force => this.call('token', uid, force) }
    return this.observer(uid ? this.users[uid] : null)
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
function ProtectedChild() {
  const { user } = useAuthentication()
  useLayoutEffect(() => { harness.events.push({ admitted: user?.uid ?? null }) })
  return <div id="admitted">Private child {user?.uid}</div>
}
export function Fixture() {
  const [generation, setGeneration] = useState(0)
  harness.replayGuard = () => setGeneration(n => n + 1)
  const Guard = new URLSearchParams(window.location.search).get('guard') === 'only' ? AdminOnlyRoute : AdminRoute
  const nested = new URLSearchParams(window.location.search).has('nested')
  const routes = <Routes>
    <Route element={<Guard />}><Route path="/" element={<ProtectedChild />} /></Route>
    <Route path="/login" element={<div id="login">Login</div>} />
  </Routes>
  return <Provider><BrowserRouter><Probe /><StrictMode key={generation}>
    {nested ? <Routes><Route element={<ProtectedRoute allowIncompleteOnboarding allowIncompleteProfile />}>
      <Route element={<AdminRoute />}><Route element={<AdminOnlyRoute />}>
        <Route path="/" element={<ProtectedChild />} />
      </Route></Route>
    </Route><Route path="*" element={<div id="destination">Destination</div>} /></Routes> : routes}
  </StrictMode></BrowserRouter></Provider>
}
let root = createRoot(document.getElementById('root'))
harness.remount = () => {
  root.unmount()
  root = createRoot(document.getElementById('root'))
  root.render(<StrictMode><Fixture /></StrictMode>)
}
root.render(<StrictMode><Fixture /></StrictMode>)
