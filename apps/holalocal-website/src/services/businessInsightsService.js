import { getOwnerBusinessInsightsCallable, recordBusinessInsightCallable } from '../firebase/functionsClient.js'
import { createBusinessInsightsTracker } from './businessInsightsTracking.js'

const tracker = createBusinessInsightsTracker({
  callable: recordBusinessInsightCallable,
  cryptoApi: (() => { try { return globalThis.crypto } catch { return null } })(),
  storage: (() => { try { return globalThis.sessionStorage } catch { return null } })(),
})
const insightRequests = new Map()

export function recordPublicProfileView(businessId) {
  tracker.recordProfileView(businessId)
}

export function recordPublicContactAction(businessId, contactAction) {
  tracker.recordContactAction(businessId, contactAction)
}

export async function getOwnerBusinessInsights(businessId, dateRange = null) {
  const payload = { businessId, ...(dateRange ?? {}) }
  const requestKey = JSON.stringify(payload)
  if (insightRequests.has(requestKey)) return insightRequests.get(requestKey)
  const request = getOwnerBusinessInsightsCallable(payload)
    .then((result) => result.data)
    .finally(() => insightRequests.delete(requestKey))
  insightRequests.set(requestKey, request)
  return request
}
