export const CONVERSATION_ID_SEPARATOR = '__'
export const CONVERSATION_SCHEMA_VERSION = 1
export const CONVERSATION_STATUS_ACTIVE = 'active'
export const CONVERSATION_STATUS_PARTICIPANT_DELETED = 'participant_deleted'
export const CONVERSATION_TOMBSTONE_TYPE_DELETED_USER = 'deleted_user'
export const MAX_MESSAGE_LENGTH = 4000
export const MESSAGE_TRANSLATION_STATUSES = Object.freeze([
  'processing', 'completed', 'not_required', 'failed',
])
export const MESSAGE_TRANSLATION_TERMINAL_STATUSES = Object.freeze([
  'completed', 'not_required', 'failed',
])
export const MESSAGE_TRANSLATION_REASONS = Object.freeze([
  'missing_target_language',
  'unsupported_target_language',
  'same_language',
  'malformed_message',
  'invalid_conversation',
  'missing_recipient',
  'recipient_unavailable',
  'provider_unavailable',
  'provider_rejected',
])

export function buildLegacyConversationId(customerId, businessId) {
  if (!isValidConversationIdPart(customerId) || !isValidConversationIdPart(businessId)) {
    throw new Error('A valid customer ID and business ID are required.')
  }
  return `${customerId}${CONVERSATION_ID_SEPARATOR}${businessId}`
}

// Compatibility alias for clients that still create the legacy document path directly.
export function buildConversationId(customerId, businessId) {
  return buildLegacyConversationId(customerId, businessId)
}

export function conversationMatchesPair(conversation, customerId, businessId) {
  return Boolean(conversation)
    && isValidConversationIdPart(customerId)
    && isValidConversationIdPart(businessId)
    && conversation.customerId === customerId
    && conversation.businessId === businessId
}

export function conversationInboxQueryFilters(userId) {
  if (!isValidConversationIdPart(userId)) {
    throw new Error('A valid user ID is required.')
  }
  return [
    ['participantIds', 'array-contains', userId],
    ['status', 'in', [CONVERSATION_STATUS_ACTIVE, CONVERSATION_STATUS_PARTICIPANT_DELETED]],
    ['schemaVersion', '==', CONVERSATION_SCHEMA_VERSION],
  ]
}

export function deletedUserTombstoneFor(conversation, participantId) {
  if (!conversation || !isValidConversationIdPart(participantId)) return null
  const tombstone = conversation.participantTombstones?.[participantId]
  if (!tombstone || typeof tombstone !== 'object' || Array.isArray(tombstone)) return null
  if (Object.keys(tombstone).sort().join(',') !== 'deletedAt,type') return null
  if (tombstone.type !== CONVERSATION_TOMBSTONE_TYPE_DELETED_USER) return null
  if (!isFirestoreTimestampLike(tombstone.deletedAt)) return null
  return tombstone
}

export function isParticipantDeletedConversation(conversation) {
  return Boolean(
    conversation
    && conversation.status === CONVERSATION_STATUS_PARTICIPANT_DELETED
    && Array.isArray(conversation.participantIds)
    && conversation.participantIds.length === 2
    && typeof conversation.customerId === 'string'
    && conversation.participantIds.includes(conversation.customerId)
    && deletedUserTombstoneFor(conversation, conversation.customerId),
  )
}

export function isConversationSendable(conversation) {
  return conversation?.status === CONVERSATION_STATUS_ACTIVE
}

export function existingConversationQueryFilters(customerId, businessId) {
  if (!isValidConversationIdPart(customerId) || !isValidConversationIdPart(businessId)) {
    throw new Error('A valid customer ID and business ID are required.')
  }
  return [
    ['customerId', '==', customerId],
    ['businessId', '==', businessId],
    ['status', '==', CONVERSATION_STATUS_ACTIVE],
    ['schemaVersion', '==', CONVERSATION_SCHEMA_VERSION],
  ]
}

export function isConversationIdFor(conversationId, customerId, businessId) {
  if (!isValidConversationIdPart(conversationId)) return false
  return conversationId === buildConversationId(customerId, businessId)
}

export function isConversationHiddenForUser(conversation, userId) {
  if (!conversation || !userId) return true
  return Boolean(conversation.participantState?.[userId]?.deletedAt)
}

export function hasOwnerOnlyConversationParticipants(conversation, ownerId) {
  if (!conversation || !ownerId) return false
  const { customerId, participantIds } = conversation
  return typeof customerId === 'string'
    && customerId.length > 0
    && customerId !== ownerId
    && Array.isArray(participantIds)
    && participantIds.length === 2
    && participantIds.includes(customerId)
    && participantIds.includes(ownerId)
}

export function isConversationUnreadForUser(conversation, userId) {
  if (!conversation || !userId || isConversationHiddenForUser(conversation, userId)) return false
  const lastMessage = conversation.lastMessage
  if (!lastMessage || lastMessage.senderId === userId) return false

  const lastMessageAt = timestampToMillis(conversation.lastMessageAt ?? lastMessage.createdAt)
  if (!lastMessageAt) return false

  const lastReadAt = timestampToMillis(conversation.participantState?.[userId]?.lastReadAt)
  return !lastReadAt || lastMessageAt > lastReadAt
}

export function getConversationActivityTime(conversation) {
  return timestampToMillis(conversation?.lastMessageAt)
    ?? timestampToMillis(conversation?.createdAt)
    ?? 0
}

export function shouldAdvanceConversationPreview(currentLastMessageAt, nextMessageCreatedAt) {
  const currentMillis = timestampToMillis(currentLastMessageAt)
  const nextMillis = timestampToMillis(nextMessageCreatedAt)
  if (!nextMillis) return false
  return !currentMillis || nextMillis >= currentMillis
}

export function isSupportedTranslationLanguage(value, supportedCodes = null) {
  const codes = supportedCodes ?? [
    'en', 'es', 'fr', 'de', 'nl', 'pt', 'pl', 'ro', 'cs', 'sk', 'hu', 'uk', 'it',
    'sv', 'da', 'fi', 'no',
  ]
  return typeof value === 'string' && codes.includes(value)
}

export function isTerminalTranslationStatus(status) {
  return MESSAGE_TRANSLATION_TERMINAL_STATUSES.includes(status)
}

export function normalizeMessageTranslation(translation) {
  if (!translation || typeof translation !== 'object') {
    return {
      status: null,
      sourceLanguage: null,
      targetLanguage: null,
      translatedText: null,
      reason: null,
      processingStartedAt: null,
      processingLeaseUntil: null,
      attemptId: null,
      updatedAt: null,
      valid: false,
    }
  }

  const status = MESSAGE_TRANSLATION_STATUSES.includes(translation.status)
    ? translation.status
    : null
  const completed = status === 'completed'
  return {
    status,
    sourceLanguage: isSupportedTranslationLanguage(translation.sourceLanguage)
      ? translation.sourceLanguage
      : null,
    targetLanguage: isSupportedTranslationLanguage(translation.targetLanguage)
      ? translation.targetLanguage
      : null,
    translatedText: completed && typeof translation.translatedText === 'string'
      ? translation.translatedText
      : null,
    reason: MESSAGE_TRANSLATION_REASONS.includes(translation.reason)
      ? translation.reason
      : null,
    processingStartedAt: translation.processingStartedAt ?? null,
    processingLeaseUntil: translation.processingLeaseUntil ?? null,
    attemptId: typeof translation.attemptId === 'string' ? translation.attemptId : null,
    updatedAt: translation.updatedAt ?? null,
    valid: Boolean(status),
  }
}

export function shouldShowTranslatedMessage(message, currentUserId) {
  if (!message || message.senderId === currentUserId) return false
  const translation = normalizeMessageTranslation(message.translation)
  return translation.status === 'completed' && Boolean(translation.translatedText)
}

export function selectMessageDisplayText(message, currentUserId, showOriginal = false) {
  if (!message) return ''
  if (!showOriginal && shouldShowTranslatedMessage(message, currentUserId)) {
    return normalizeMessageTranslation(message.translation).translatedText
  }
  return typeof message.text === 'string' ? message.text : ''
}

function isValidConversationIdPart(value) {
  return typeof value === 'string' && value.trim() === value && value.length > 0 && !value.includes('/')
}

function timestampToMillis(value) {
  if (!value) return null
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.toDate === 'function') return value.toDate().getTime()
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return null
}

function isFirestoreTimestampLike(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const { seconds, nanoseconds } = value
  if (!Number.isInteger(seconds) || !Number.isInteger(nanoseconds)) return false
  if (nanoseconds < 0 || nanoseconds > 999999999 || typeof value.toMillis !== 'function') return false
  try {
    const millis = value.toMillis()
    return Number.isFinite(millis)
      && Math.abs(millis - (seconds * 1000 + nanoseconds / 1e6)) < 0.000001
  } catch {
    return false
  }
}
