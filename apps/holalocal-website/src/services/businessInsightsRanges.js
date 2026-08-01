import {
  BUSINESS_INSIGHTS_MAX_RANGE_DAYS,
  inclusiveUtcDateKeys,
  parseBusinessInsightDate,
  recentUtcDateKeys,
  utcDateKey,
} from '@holalocal/firebase-contract'

export const INSIGHT_RANGE_PRESETS = Object.freeze(['last_7_days', 'last_30_days', 'last_90_days', 'custom'])

export function currentUtcDate() {
  return utcDateKey(new Date())
}

export function presetDateRequest(preset, today = currentUtcDate()) {
  const count = { last_7_days: 7, last_30_days: 30, last_90_days: 90 }[preset]
  if (!count || !parseBusinessInsightDate(today)) return null
  return { startDate: recentUtcDateKeys(parseBusinessInsightDate(today), count)[0], endDate: today }
}

export function validateCustomInsightRange(startDate, endDate, today = currentUtcDate()) {
  const start = parseBusinessInsightDate(startDate)
  const end = parseBusinessInsightDate(endDate)
  const maximum = parseBusinessInsightDate(today)
  if (!startDate || !endDate) return { valid: false, reason: 'required' }
  if (!start || !end) return { valid: false, reason: 'invalid' }
  if (start > end) return { valid: false, reason: 'order' }
  if (end > maximum) return { valid: false, reason: 'future' }
  const dates = inclusiveUtcDateKeys(startDate, endDate)
  if (dates.length === 0 || dates.length > BUSINESS_INSIGHTS_MAX_RANGE_DAYS) return { valid: false, reason: 'tooLong' }
  return { valid: true, startDate, endDate, numberOfDays: dates.length }
}

export function localeDate(apiDate, locale) {
  const date = parseBusinessInsightDate(apiDate)
  return date ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(date) : apiDate
}

export function activityChartConfiguration(dayCount) {
  const count = Math.max(0, Number(dayCount) || 0)
  if (count <= 30) return { density: 'spacious', labelEvery: 1 }
  if (count <= 90) return { density: 'compact', labelEvery: 10 }
  return { density: 'dense', labelEvery: 0 }
}

export function showActivityDayLabel(index, dayCount) {
  const { labelEvery } = activityChartConfiguration(dayCount)
  if (labelEvery === 0) return false
  return labelEvery === 1 || index === 0 || index === dayCount - 1 || (index + 1) % labelEvery === 0
}
