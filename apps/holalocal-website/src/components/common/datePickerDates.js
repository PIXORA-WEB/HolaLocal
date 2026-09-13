import { parseBusinessInsightDate, utcDateKey } from '@holalocal/firebase-contract'

export function formatPickerDate(value, locale) {
  const date = parseBusinessInsightDate(value)
  return date ? new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC', numberingSystem: 'latn' }).format(date) : value
}

export function parsePickerDate(value, locale) {
  if (parseBusinessInsightDate(value)) return value
  const parts = new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC', numberingSystem: 'latn' }).formatToParts(new Date('2001-11-22T00:00:00Z'))
  const keys = []
  const pattern = parts.map(({ type, value: text }) => {
    if (['year', 'month', 'day'].includes(type)) { keys.push(type); return type === 'year' ? '(\\d{4})' : '(\\d{1,2})' }
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')
  }).join('')
  const match = value.trim().match(new RegExp(`^${pattern}$`))
  if (!match) return null
  const data = Object.fromEntries(keys.map((key, index) => [key, match[index + 1]]))
  const iso = `${data.year}-${data.month.padStart(2, '0')}-${data.day.padStart(2, '0')}`
  return parseBusinessInsightDate(iso) ? iso : null
}

export function movePickerDate(value, days = 0, months = 0) {
  const date = parseBusinessInsightDate(value)
  if (!date) return value
  if (months) {
    const day = date.getUTCDate()
    date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + months)
    const end = new Date(date); end.setUTCMonth(end.getUTCMonth() + 1); end.setUTCDate(0)
    date.setUTCDate(Math.min(day, end.getUTCDate()))
  }
  date.setUTCDate(date.getUTCDate() + days)
  return date.getUTCFullYear() >= 100 && date.getUTCFullYear() <= 9998 ? utcDateKey(date) : value
}

export function pickerWeekStart(locale) {
  const language = new Intl.Locale(locale)
  return (language.getWeekInfo?.().firstDay ?? language.weekInfo?.firstDay ?? 1) % 7
}

export function pickerDays(cursor, locale) {
  const first = `${cursor.slice(0, 7)}-01`
  const weekday = parseBusinessInsightDate(first).getUTCDay()
  const start = movePickerDate(first, -((weekday - pickerWeekStart(locale) + 7) % 7))
  return Array.from({ length: 42 }, (_, index) => movePickerDate(start, index))
}
