export function createDisabledTranslator() {
  return {
    async translateText() {
      const error = new Error('Translation provider is not configured.')
      error.retryable = false
      error.safeReason = 'provider_unavailable'
      throw error
    },
  }
}
