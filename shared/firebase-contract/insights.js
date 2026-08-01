export const BUSINESS_INSIGHTS_SCHEMA_VERSION = 1
export const BUSINESS_INSIGHTS_DAYS = 30
export const BUSINESS_INSIGHT_EVENTS = Object.freeze(['profile_view', 'contact_action'])
export const BUSINESS_CONTACT_ACTIONS = Object.freeze(['holalocal', 'phone', 'email', 'whatsapp', 'website'])
export const BUSINESS_INSIGHT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,80}$/

export function utcDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new TypeError('A valid date is required.')
  return date.toISOString().slice(0, 10)
}

export function recentUtcDateKeys(end = new Date(), count = BUSINESS_INSIGHTS_DAYS) {
  const safeCount = Math.min(Math.max(Number(count) || 1, 1), BUSINESS_INSIGHTS_DAYS)
  const cursor = new Date(end)
  cursor.setUTCHours(0, 0, 0, 0)
  return Array.from({ length: safeCount }, (_, index) => {
    const date = new Date(cursor)
    date.setUTCDate(cursor.getUTCDate() - (safeCount - index - 1))
    return utcDateKey(date)
  })
}

export function isBusinessInsightEvent(value) {
  return BUSINESS_INSIGHT_EVENTS.includes(value)
}

export function isBusinessContactAction(value) {
  return BUSINESS_CONTACT_ACTIONS.includes(value)
}
