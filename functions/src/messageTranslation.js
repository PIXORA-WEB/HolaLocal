import {
  CONVERSATION_STATUS_ACTIVE,
  hasOwnerOnlyConversationParticipants,
  isSupportedTranslationLanguage,
  isTerminalTranslationStatus,
  MESSAGE_TRANSLATION_REASONS,
  normalizeLanguage,
  normalizeMessageTranslation,
} from '@holalocal/firebase-contract'

export const TRANSLATION_LEASE_MS = 5 * 60 * 1000

export function createAttemptId({ conversationId, messageId, now }) {
  const millis = timestampToMillis(now) ?? Date.now()
  return `${conversationId}:${messageId}:${millis}`
}

export function resolveRecipientId(conversation, senderId) {
  if (!Array.isArray(conversation?.participantIds) || conversation.participantIds.length !== 2) return null
  if (!conversation.participantIds.includes(senderId)) return null
  return conversation.participantIds.find((participantId) => participantId !== senderId) ?? null
}

export function resolveTargetLanguage(user) {
  if (!user || ['suspended', 'deleted', 'deletion_pending'].includes(user.accountStatus)) {
    return { language: null, reason: 'recipient_unavailable' }
  }

  const canonical = normalizeLanguage(user.preferredLocale).value?.id
  if (canonical && isSupportedTranslationLanguage(canonical)) {
    return { language: canonical, reason: null }
  }

  const legacy = normalizeLanguage(user.preferredLanguage).value?.id
  if (legacy && isSupportedTranslationLanguage(legacy)) {
    return { language: legacy, reason: null }
  }

  return { language: null, reason: 'missing_target_language' }
}

export function isValidTextMessage(message, senderId = null) {
  if (!message || message.type !== 'text') return false
  if (senderId && message.senderId !== senderId) return false
  return typeof message.senderId === 'string'
    && typeof message.text === 'string'
    && message.text.trim().length > 0
    && message.attachment === null
    && message.moderationStatus === 'visible'
    && message.deletedAt === null
}

export function validateTranslationEligibility({ message, conversation, business, recipient }) {
  if (!isValidTextMessage(message)) {
    return { eligible: false, terminalReason: 'malformed_message' }
  }

  if (!conversation || conversation.status !== CONVERSATION_STATUS_ACTIVE) {
    return { eligible: false, terminalReason: 'invalid_conversation' }
  }

  if (!business?.ownerId || !hasOwnerOnlyConversationParticipants(conversation, business.ownerId)) {
    return { eligible: false, terminalReason: 'invalid_conversation' }
  }

  const recipientId = resolveRecipientId(conversation, message.senderId)
  if (!recipientId || !recipient) {
    return { eligible: false, terminalReason: 'missing_recipient' }
  }

  const target = resolveTargetLanguage(recipient)
  if (!target.language) {
    return { eligible: false, terminalReason: target.reason }
  }

  return {
    eligible: true,
    recipientId,
    targetLanguage: target.language,
    sourceLanguageHint: normalizeLanguage(message.senderPreferredLocale).value?.id ?? null,
  }
}

export function shouldSkipExistingTranslation(translation, now) {
  const normalized = normalizeMessageTranslation(translation)
  if (isTerminalTranslationStatus(normalized.status)) {
    return { skip: true, reason: 'terminal' }
  }

  if (normalized.status === 'processing') {
    const leaseUntil = timestampToMillis(normalized.processingLeaseUntil)
    if (leaseUntil && leaseUntil > timestampToMillis(now)) {
      return { skip: true, reason: 'leased' }
    }
  }

  return { skip: false, reason: null }
}

export async function processMessageTranslation({
  conversationId,
  messageId,
  source,
  translator,
  now = new Date(),
  leaseMs = TRANSLATION_LEASE_MS,
  attemptId = createAttemptId({ conversationId, messageId, now }),
} = {}) {
  if (!conversationId || !messageId) {
    return { status: 'ignored', reason: 'missing_message_reference' }
  }

  const claimed = await source.claimTranslation({
    conversationId,
    messageId,
    now,
    leaseUntil: addMillis(now, leaseMs),
    attemptId,
  })

  if (!claimed.claimed) return claimed

  const { message, targetLanguage, sourceLanguageHint } = claimed

  try {
    const result = await translator.translateText({
      text: message.text,
      targetLanguage,
      sourceLanguageHint,
      requestId: attemptId,
    })

    const sourceLanguage = normalizeLanguage(result.sourceLanguage).value?.id ?? null
    if (sourceLanguage && sourceLanguage === targetLanguage) {
      await source.finishTranslation({
        conversationId,
        messageId,
        attemptId,
        now,
        translation: terminalTranslation({
          status: 'not_required',
          sourceLanguage,
          targetLanguage,
          reason: 'same_language',
          now,
        }),
      })
      return { status: 'not_required', reason: 'same_language' }
    }

    await source.finishTranslation({
      conversationId,
      messageId,
      attemptId,
      now,
      translation: terminalTranslation({
        status: 'completed',
        sourceLanguage,
        targetLanguage,
        translatedText: result.translatedText,
        reason: null,
        now,
      }),
    })
    return { status: 'completed' }
  } catch (error) {
    const reason = safeFailureReason(error.safeReason)
    if (error.retryable) {
      await source.releaseTranslation({
        conversationId,
        messageId,
        attemptId,
        now,
        reason,
      })
      return { status: 'retryable_failed', reason }
    }

    await source.finishTranslation({
      conversationId,
      messageId,
      attemptId,
      now,
      translation: terminalTranslation({
        status: 'failed',
        sourceLanguage: null,
        targetLanguage,
        translatedText: null,
        reason,
        now,
      }),
    })
    return { status: 'failed', reason }
  }
}

export function processingTranslation({ targetLanguage, attemptId, now, leaseUntil }) {
  return {
    status: 'processing',
    sourceLanguage: null,
    targetLanguage,
    translatedText: null,
    reason: null,
    processingStartedAt: now,
    processingLeaseUntil: leaseUntil,
    attemptId,
    updatedAt: now,
  }
}

export function terminalTranslation({
  status,
  sourceLanguage,
  targetLanguage,
  translatedText = null,
  reason,
  now,
}) {
  return {
    status,
    sourceLanguage: sourceLanguage ?? null,
    targetLanguage: targetLanguage ?? null,
    translatedText: status === 'completed' ? String(translatedText ?? '') : null,
    reason: reason ?? null,
    processingStartedAt: null,
    processingLeaseUntil: null,
    attemptId: null,
    updatedAt: now,
  }
}

export function retryableFailureTranslation({ targetLanguage, attemptId, now, reason }) {
  return {
    status: 'processing',
    sourceLanguage: null,
    targetLanguage: targetLanguage ?? null,
    translatedText: null,
    reason,
    processingStartedAt: null,
    processingLeaseUntil: now,
    attemptId,
    updatedAt: now,
  }
}

function safeFailureReason(reason) {
  return MESSAGE_TRANSLATION_REASONS.includes(reason) ? reason : 'provider_unavailable'
}

function addMillis(date, millis) {
  return new Date(timestampToMillis(date) + millis)
}

function timestampToMillis(value) {
  if (!value) return Date.now()
  if (value instanceof Date) return value.getTime()
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.toDate === 'function') return value.toDate().getTime()
  if (typeof value === 'number') return value
  return Date.now()
}
