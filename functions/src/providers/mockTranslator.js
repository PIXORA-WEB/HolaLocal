import { normalizeLanguage } from '@holalocal/firebase-contract'

export function createMockTranslator({ fail = false, detectedSourceLanguage = 'en' } = {}) {
  return {
    async translateText({ text, targetLanguage }) {
      if (fail) {
        const error = new Error('Mock translation provider failed with a private upstream message.')
        error.retryable = false
        error.safeReason = 'provider_unavailable'
        throw error
      }

      const source = normalizeLanguage(detectedSourceLanguage).value?.id ?? null
      return {
        translatedText: `[${targetLanguage}] ${text}`,
        sourceLanguage: source,
      }
    },
  }
}
