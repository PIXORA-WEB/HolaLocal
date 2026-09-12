import { getAnalyticsChoice, subscribeAnalyticsChoice } from './analyticsConsent.js'
import { analyticsPage, analyticsReferrer, clearAnalyticsCookies, privacyControlBlocksAnalytics } from './analyticsPolicy.js'

// The console review is a release prerequisite, not an implicit consequence of
// visitors accepting. Browser tests and previews never send to the live property.
const configured = import.meta.env.VITE_ANALYTICS_CONSENT_ENABLED === 'true'
  && import.meta.env.MODE !== 'browser-test'
  && /^G-[A-Z0-9]+$/.test(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? '')
const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
let route = null
let lastPage = null
let generation = 0
let transport
let transportPromise
const referrer = typeof document === 'undefined' ? '' : analyticsReferrer(document.referrer)
function allowed() {
  return configured && getAnalyticsChoice() === 'accepted' && route !== null
    && !privacyControlBlocksAnalytics(navigator)
}
// Firebase's collection-enable helper awaits initialization. Keep this switch
// synchronous so a deferred enable cannot override a later withdrawal.
function disable() {
  if (measurementId) window[`ga-disable-${measurementId}`] = true
}
export function updateAnalyticsRoute(pathname) {
  route = analyticsPage(pathname)
  void reconcile()
}
async function reconcile() {
  const current = ++generation
  if (!allowed()) {
    disable()
    lastPage = null
    if (getAnalyticsChoice() !== 'accepted' || privacyControlBlocksAnalytics(navigator)) {
      clearAnalyticsCookies(document, location.hostname, location.pathname)
    }
    return
  }
  const page = route
  try {
    transportPromise ??= import('../firebase/analyticsClient.js')
    transport = await transportPromise
    const stillAllowed = () => current === generation && allowed()
    if (!stillAllowed()) return
    // Keep Google's collection switch closed while asynchronous initialization runs.
    disable()
    const client = await transport.startAnalytics(stillAllowed, page, referrer)
    if (!client || !stillAllowed()) return
    window[`ga-disable-${measurementId}`] = false
    if (lastPage === page.page_location) return
    transport.recordAnalyticsPage(page, referrer)
    lastPage = page.page_location
  } catch {
    disable() // Analytics failure must never affect browsing or account actions.
    transportPromise = null
  }
}
export function watchAnalyticsChoice() {
  return subscribeAnalyticsChoice(() => { disable(); void reconcile() })
}
