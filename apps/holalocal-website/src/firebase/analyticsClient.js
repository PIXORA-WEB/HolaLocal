import { getAnalytics, isSupported } from 'firebase/analytics'
import { getFirebaseApp } from './config.js'

export async function initializeAnalytics() {
  if (typeof window === 'undefined' || !(await isSupported())) return null
  return getAnalytics(getFirebaseApp())
}
