// Loaded only after explicit acceptance on an approved public route.
import { initializeAnalytics, isSupported, logEvent, setConsent, setDefaultEventParameters } from 'firebase/analytics'
import { getFirebaseApp } from './config.js'

let client
let starting
const advertisingDenied = {
  ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
}
export async function startAnalytics(isStillAllowed, page, referrer) {
  if (!await isSupported() || !isStillAllowed()) return null
  if (!client) {
    starting ??= (async () => {
      if (!isStillAllowed()) return null
      setConsent({ ...advertisingDenied, analytics_storage: 'granted' })
      setDefaultEventParameters({ ...page, page_referrer: referrer })
      client = initializeAnalytics(getFirebaseApp(), { config: {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        cookie_path: '/', cookie_expires: 60 * 60 * 24 * 90, cookie_update: false,
        page_location: page.page_location, page_title: page.page_title, page_referrer: referrer,
        // Do not associate the anonymous browser with an authenticated account.
        user_id: null,
        campaign_id: '', campaign_name: '', campaign_source: '',
        campaign_medium: '', campaign_term: '', campaign_content: '',
      } })
      return client
    })()
    try { await starting } catch (error) { starting = undefined; throw error }
  }
  return isStillAllowed() ? client : null
}
export function recordAnalyticsPage(page, referrer) {
  setDefaultEventParameters({ ...page, page_referrer: referrer })
  logEvent(client, 'page_view', { ...page, page_referrer: referrer })
}
