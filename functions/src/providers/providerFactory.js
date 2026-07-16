import { createDisabledTranslator } from './disabledTranslator.js'
import { createGoogleCloudTranslator } from './googleCloudTranslator.js'
import { createMockTranslator } from './mockTranslator.js'

export const TRANSLATION_PROVIDER_CONFIG = 'MESSAGE_TRANSLATION_PROVIDER'
export const TRANSLATION_PROVIDER_DISABLED = 'disabled'
export const TRANSLATION_PROVIDER_MOCK = 'mock'
export const TRANSLATION_PROVIDER_GOOGLE_CLOUD = 'google_cloud'

export function createTranslationProvider({
  providerName = TRANSLATION_PROVIDER_DISABLED,
  projectId = null,
  env = process.env,
  googleClient = null,
} = {}) {
  const provider = normalizeProviderName(providerName)

  if (provider === TRANSLATION_PROVIDER_MOCK) {
    return isEmulatorOrTest(env)
      ? createMockTranslator()
      : createDisabledTranslator()
  }

  if (provider === TRANSLATION_PROVIDER_GOOGLE_CLOUD) {
    if (isDemoProjectId(projectId)) return createDisabledTranslator()
    return createGoogleCloudTranslator({ projectId, client: googleClient })
  }

  return createDisabledTranslator()
}

export function normalizeProviderName(value) {
  return [
    TRANSLATION_PROVIDER_DISABLED,
    TRANSLATION_PROVIDER_MOCK,
    TRANSLATION_PROVIDER_GOOGLE_CLOUD,
  ].includes(value)
    ? value
    : TRANSLATION_PROVIDER_DISABLED
}

export function resolveRuntimeProjectId(env = process.env) {
  return env.GCLOUD_PROJECT || env.GCP_PROJECT || env.GOOGLE_CLOUD_PROJECT || null
}

export function isEmulatorOrTest(env = process.env) {
  return env.FUNCTIONS_EMULATOR === 'true'
    || Boolean(env.FIREBASE_EMULATOR_HUB)
    || env.NODE_ENV === 'test'
}

function isDemoProjectId(projectId) {
  return typeof projectId !== 'string'
    || projectId.length === 0
    || projectId === 'demo'
    || projectId.startsWith('demo-')
}
