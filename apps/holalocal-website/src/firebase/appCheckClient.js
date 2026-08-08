import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import { shouldUseFirebaseEmulators } from './emulatorMode.js'

const initializationResults = new WeakMap()
const INITIALIZATION_WARNING = 'Firebase App Check could not be initialized; Firebase requests will continue without App Check while enforcement is disabled.'

function warnSafely(logger) {
  try {
    logger?.warn?.(INITIALIZATION_WARNING)
  } catch {
    // Logging must never turn optional App Check monitoring into an application failure.
  }
}

function debugTokenValue(value) {
  if (value === true || value === 'true') return true
  if (typeof value !== 'string') return null
  const token = value.trim()
  return token || null
}

export function initializeWebsiteAppCheck(app, {
  environment = import.meta.env,
  globalObject = globalThis,
  isFirebaseEmulatorMode = shouldUseFirebaseEmulators,
  sdk = { initializeAppCheck, ReCaptchaEnterpriseProvider },
  logger = console,
} = {}) {
  if (environment.VITE_FIREBASE_APPCHECK_ENABLED !== 'true') return null
  if (!globalObject || typeof globalObject.document !== 'object') return null
  if (initializationResults.has(app)) return initializationResults.get(app)

  // Record the attempt before touching provider code so every Firebase App is
  // attempted at most once, including failed or intentionally skipped attempts.
  initializationResults.set(app, null)

  try {
    if (isFirebaseEmulatorMode()) return null

    const siteKey = environment.VITE_FIREBASE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY?.trim()
    if (!siteKey) {
      warnSafely(logger)
      return null
    }

    if (environment.DEV === true && environment.PROD === false) {
      const debugToken = debugTokenValue(environment.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN)
      if (debugToken !== null) globalObject.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken
    }

    const appCheck = sdk.initializeAppCheck(app, {
      provider: new sdk.ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    })
    initializationResults.set(app, appCheck)
    return appCheck
  } catch {
    warnSafely(logger)
    return null
  }
}
