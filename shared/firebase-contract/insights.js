export const BUSINESS_INSIGHTS_SCHEMA_VERSION = 1
export const BUSINESS_INSIGHTS_DAYS = 30
export const BUSINESS_INSIGHTS_MAX_RANGE_DAYS = 366
export const BUSINESS_INSIGHT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
export const BUSINESS_INSIGHT_EVENTS = Object.freeze(['profile_view', 'contact_action'])
export const BUSINESS_CONTACT_ACTIONS = Object.freeze(['holalocal', 'phone', 'email', 'whatsapp', 'website'])
export const BUSINESS_INSIGHT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,80}$/

export function utcDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new TypeError('A valid date is required.')
  return date.toISOString().slice(0, 10)
}

export function recentUtcDateKeys(end = new Date(), count = BUSINESS_INSIGHTS_DAYS) {
  const safeCount = Math.min(Math.max(Number(count) || 1, 1), BUSINESS_INSIGHTS_MAX_RANGE_DAYS)
  const cursor = new Date(end)
  cursor.setUTCHours(0, 0, 0, 0)
  return Array.from({ length: safeCount }, (_, index) => {
    const date = new Date(cursor)
    date.setUTCDate(cursor.getUTCDate() - (safeCount - index - 1))
    return utcDateKey(date)
  })
}

export function parseBusinessInsightDate(value) {
  if (typeof value !== 'string' || !BUSINESS_INSIGHT_DATE_PATTERN.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    ? date
    : null
}

export function inclusiveUtcDateKeys(startDate, endDate) {
  const start = parseBusinessInsightDate(startDate)
  const end = parseBusinessInsightDate(endDate)
  if (!start || !end || start > end) return []
  const numberOfDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
  if (numberOfDays > BUSINESS_INSIGHTS_MAX_RANGE_DAYS) return []
  return Array.from({ length: numberOfDays }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    return utcDateKey(date)
  })
}

export function isBusinessInsightEvent(value) {
  return BUSINESS_INSIGHT_EVENTS.includes(value)
}

export function isBusinessContactAction(value) {
  return BUSINESS_CONTACT_ACTIONS.includes(value)
}
