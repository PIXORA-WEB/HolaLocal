import { getOwnerBusinessInsightsCallable, recordBusinessInsightCallable } from '../firebase/functionsClient.js'
import { createBusinessInsightsTracker } from './businessInsightsTracking.js'

const tracker = createBusinessInsightsTracker({
  callable: recordBusinessInsightCallable,
  cryptoApi: (() => { try { return globalThis.crypto } catch { return null } })(),
  storage: (() => { try { return globalThis.sessionStorage } catch { return null } })(),
})

export function recordPublicProfileView(businessId) {
  tracker.recordProfileView(businessId)
}

export function recordPublicContactAction(businessId, contactAction) {
  tracker.recordContactAction(businessId, contactAction)
}

export async function getOwnerBusinessInsights(businessId) {
  const result = await getOwnerBusinessInsightsCallable({ businessId })
  return result.data
}
