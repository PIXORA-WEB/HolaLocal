import { normalizeLanguage, isSupportedTranslationLanguage, normalizeMessageTranslation } from '@holalocal/firebase-contract'

export function translationLanguage(value) {
  const language = normalizeLanguage(value).value?.id
  return isSupportedTranslationLanguage(language) ? language : null
}

export function recipientTranslationLanguage(profile) {
  return translationLanguage(profile?.preferredLocale) ?? translationLanguage(profile?.preferredLanguage)
}

export function translationLeaseExpiry(value) {
  try {
    const time = value instanceof Date ? value.getTime() : value?.toMillis?.()
    return Number.isFinite(time) ? time : null
  } catch {
    return null
  }
}

export function messageTranslationPresentation(message, viewerId, targetLanguage, showOriginal = false, now = Date.now()) {
  const original = typeof message?.text === 'string' ? message.text : ''
  const fallback = { text: original, canToggle: false, status: null, expiresAt: null }
  if (!message || message.senderId === viewerId || message.deletedAt || message.moderationStatus !== 'visible') return fallback
  const translation = normalizeMessageTranslation(message.translation)
  const target = translationLanguage(targetLanguage)
  if (!target || translationLanguage(translation.targetLanguage) !== target) return fallback
  if (translationLanguage(translation.sourceLanguage) === target || translation.status === 'not_required') return fallback
  if (translation.status === 'completed' && typeof translation.translatedText === 'string' && translation.translatedText.trim()) {
    return { ...fallback, text: showOriginal ? original : translation.translatedText, canToggle: true, status: 'completed' }
  }
  if (translation.status === 'processing') {
    const expiresAt = translationLeaseExpiry(translation.processingLeaseUntil)
    return { ...fallback, status: expiresAt !== null && expiresAt > now ? 'processing' : 'failed', expiresAt }
  }
  return { ...fallback, status: translation.status === 'failed' ? 'failed' : null }
}
