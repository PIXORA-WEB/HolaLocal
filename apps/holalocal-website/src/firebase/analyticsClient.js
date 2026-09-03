import { getAnalytics, isSupported } from 'firebase/analytics'
import { getFirebaseApp } from './config.js'
import { shouldUseFirebaseEmulators } from './emulatorMode.js'

export async function initializeAnalytics() {
  if (import.meta.env.MODE === 'browser-test') {
    shouldUseFirebaseEmulators()
    return null
  }
  if (
    typeof window === 'undefined'
    || shouldUseFirebaseEmulators()
    || !(await isSupported())
  ) return null
  return getAnalytics(getFirebaseApp())
}
