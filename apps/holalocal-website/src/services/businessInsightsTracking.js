import { BUSINESS_INSIGHT_TOKEN_PATTERN } from '@holalocal/firebase-contract'

const SESSION_PREFIX = 'holalocal:insights:view:'

function browserCrypto() {
  try {
    return globalThis.crypto
  } catch {
    return null
  }
}

function browserSessionStorage() {
  try {
    return globalThis.sessionStorage
  } catch {
    return null
  }
}

export function secureRandomToken(cryptoApi = browserCrypto()) {
  try {
    if (!cryptoApi || typeof cryptoApi.getRandomValues !== 'function') return null
    const bytes = new Uint8Array(18)
    cryptoApi.getRandomValues(bytes)
    const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
    return BUSINESS_INSIGHT_TOKEN_PATTERN.test(token) ? token : null
  } catch {
    return null
  }
}

export function profileViewToken(businessId, {
  cryptoApi = browserCrypto(),
  storage = browserSessionStorage(),
} = {}) {
  const key = `${SESSION_PREFIX}${businessId}`
  try {
    const existing = storage?.getItem(key)
    if (typeof existing === 'string' && BUSINESS_INSIGHT_TOKEN_PATTERN.test(existing)) return existing
  } catch {
    // Storage access is optional; secure token generation can still proceed.
  }

  const token = secureRandomToken(cryptoApi)
  if (!token) return null
  try {
    storage?.setItem(key, token)
  } catch {
    // A write failure only disables reuse for this browser session.
  }
  return token
}

export function createBusinessInsightsTracker({ callable, cryptoApi, storage }) {
  function bestEffort(payload) {
    try {
      void Promise.resolve(callable(payload)).catch(() => undefined)
    } catch {
      // Analytics must never interrupt the originating product action.
    }
  }

  return {
    recordProfileView(businessId) {
      if (!businessId) return
      const eventToken = profileViewToken(businessId, { cryptoApi, storage })
      if (!eventToken) return
      bestEffort({ businessId, eventType: 'profile_view', eventToken })
    },
    recordContactAction(businessId, contactAction) {
      if (!businessId || !contactAction) return
      const eventToken = secureRandomToken(cryptoApi)
      if (!eventToken) return
      bestEffort({ businessId, eventType: 'contact_action', contactAction, eventToken })
    },
  }
}
