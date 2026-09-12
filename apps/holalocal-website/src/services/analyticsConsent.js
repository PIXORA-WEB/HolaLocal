// A device-local preference, independent of account consent and business counters.
export const ANALYTICS_CHOICE_KEY = 'holalocal.analyticsChoice.v1'
const listeners = new Set()
let memoryChoice
export function getAnalyticsChoice() {
  if (memoryChoice !== undefined) return memoryChoice
  try {
    const value = localStorage.getItem(ANALYTICS_CHOICE_KEY)
    return value === 'accepted' || value === 'rejected' ? value : null
  } catch { return null }
}
export function setAnalyticsChoice(choice) {
  if (!['accepted', 'rejected'].includes(choice)) throw new Error('Invalid analytics choice')
  memoryChoice = choice
  try { localStorage.setItem(ANALYTICS_CHOICE_KEY, choice) } catch { /* tab-only choice */ }
  listeners.forEach(listener => listener())
}
export function subscribeAnalyticsChoice(listener) {
  listeners.add(listener)
  const changed = (event) => {
    if (event.key === ANALYTICS_CHOICE_KEY || event.key === null) {
      memoryChoice = undefined
      listener()
    }
  }
  window.addEventListener('storage', changed)
  return () => { listeners.delete(listener); window.removeEventListener('storage', changed) }
}
export function openAnalyticsSettings() { window.dispatchEvent(new Event('holalocal:privacy-settings')) }
