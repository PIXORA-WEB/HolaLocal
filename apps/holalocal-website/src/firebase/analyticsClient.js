import { getAnalytics, isSupported } from 'firebase/analytics'
import { app } from './config.js'

export async function initializeAnalytics() {
  if (typeof window === 'undefined' || !(await isSupported())) return null
  return getAnalytics(app)
}
