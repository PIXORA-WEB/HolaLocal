import translate from '@google-cloud/translate'
import {
  isSupportedTranslationLanguage,
  normalizeLanguage,
} from '@holalocal/firebase-contract'

const { TranslationServiceClient } = translate.v3

export const GOOGLE_TRANSLATION_LOCATION = 'global'
export const GOOGLE_TRANSLATION_MIME_TYPE = 'text/plain'

export const GOOGLE_TRANSLATION_EU_ENDPOINT = 'translate-eu.googleapis.com'
export const GOOGLE_TRANSLATION_EU_LOCATION = 'europe-west1'
const sharedClients = new Map()

export function createGoogleCloudTranslator({
  projectId,
  location = GOOGLE_TRANSLATION_LOCATION,
  client = null,
  apiEndpoint = 'translate.googleapis.com',
  requestTimeoutMs = null,
} = {}) {
  const safeProjectId = normalizeProjectId(projectId)
  if (!safeProjectId || isDemoProjectId(safeProjectId)) {
    throw createProviderError({
      category: 'terminal_provider_configuration',
      safeReason: 'provider_unavailable',
      retryable: false,
    })
  }

  if (!['translate.googleapis.com', GOOGLE_TRANSLATION_EU_ENDPOINT].includes(apiEndpoint)
    || (apiEndpoint === GOOGLE_TRANSLATION_EU_ENDPOINT && location !== GOOGLE_TRANSLATION_EU_LOCATION)) {
    throw createProviderError({ category: 'terminal_provider_configuration', safeReason: 'provider_unavailable', retryable: false })
  }
  const translationClient = client ?? getSharedClient(apiEndpoint)

  return {
    async translateText({
      text,
      targetLanguage,
      sourceLanguageHint = null,
    } = {}) {
      const trimmed = typeof text === 'string' ? text.trim() : ''
      const target = normalizeSupportedLanguage(targetLanguage)
      if (!trimmed || !target) {
        throw createProviderError({
          category: 'terminal_invalid_request',
          safeReason: 'provider_rejected',
          retryable: false,
        })
      }

      const source = normalizeSupportedLanguage(sourceLanguageHint)
      const request = {
        parent: `projects/${safeProjectId}/locations/${location}`,
        contents: [text],
        mimeType: GOOGLE_TRANSLATION_MIME_TYPE,
        targetLanguageCode: target,
      }
      if (apiEndpoint === GOOGLE_TRANSLATION_EU_ENDPOINT) request.model = `${request.parent}/models/general/base`
      if (source) request.sourceLanguageCode = source

      let response
      try {
        ;[response] = await translationClient.translateText(request, requestTimeoutMs == null ? undefined : { timeout: requestTimeoutMs, retry: null })
      } catch (error) {
        throw mapGoogleCloudTranslationError(error)
      }

      const translation = response?.translations?.[0]
      const translatedText = typeof translation?.translatedText === 'string'
        ? translation.translatedText.trim()
        : ''
      if (!translatedText) {
        throw createProviderError({
          category: 'terminal_invalid_request',
          safeReason: 'provider_rejected',
          retryable: false,
        })
      }

      const detected = normalizeSupportedLanguage(translation.detectedLanguageCode)
      return {
        translatedText,
        sourceLanguage: detected ?? source ?? null,
        targetLanguage: target,
      }
    },
  }
}

export function mapGoogleCloudTranslationError(error = {}) {
  const code = Number(error.code)
  if ([4, 10, 13, 14].includes(code)) {
    return createProviderError({
      category: code === 4 ? 'retryable_timeout' : 'retryable_service_unavailable',
      safeReason: 'provider_unavailable',
      retryable: true,
    })
  }

  if (code === 8) {
    return createProviderError({
      category: 'retryable_quota',
      safeReason: 'provider_unavailable',
      retryable: true,
    })
  }

  if (code === 3) {
    return createProviderError({
      category: 'terminal_invalid_request',
      safeReason: 'provider_rejected',
      retryable: false,
    })
  }

  if ([5, 7, 16].includes(code)) {
    return createProviderError({
      category: 'terminal_provider_configuration',
      safeReason: 'provider_unavailable',
      retryable: false,
    })
  }

  return createProviderError({
    category: 'retryable_service_unavailable',
    safeReason: 'provider_unavailable',
    retryable: true,
  })
}

function getSharedClient(apiEndpoint) {
  if (!sharedClients.has(apiEndpoint)) sharedClients.set(apiEndpoint, new TranslationServiceClient({ apiEndpoint }))
  return sharedClients.get(apiEndpoint)
}

function normalizeSupportedLanguage(value) {
  const code = normalizeLanguage(value).value?.id ?? null
  return code && isSupportedTranslationLanguage(code) ? code : null
}

function normalizeProjectId(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function isDemoProjectId(projectId) {
  return projectId === 'demo' || projectId.startsWith('demo-')
}

function createProviderError({ category, safeReason, retryable }) {
  const error = new Error('Translation provider failed safely.')
  error.safeCategory = category
  error.safeReason = safeReason
  error.retryable = retryable
  return error
}
