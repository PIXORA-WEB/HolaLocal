import { Timestamp } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import {
  CONVERSATION_STATUS_ACTIVE,
  MAX_MESSAGE_LENGTH,
  shouldAdvanceConversationPreview,
} from '@holalocal/firebase-contract'
import { assertActiveAccountSnapshot, assertBusinessAllowsMessages } from './conversationContext.js'

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/

function requireValidUid(uid) {
  if (typeof uid !== 'string' || !uid.trim() || uid.includes('/')) {
    throw new HttpsError('unauthenticated', 'auth-required')
  }
  return uid.trim()
}

function assertStringId(value, code, message) {
  if (typeof value !== 'string' || !value.trim() || value.includes('/')) {
    throw new HttpsError(code, message)
  }
  return value.trim()
}

function normalizeText(text) {
  const normalized = String(text ?? '').trim()
  if (!normalized) throw new HttpsError('invalid-argument', 'message-text-required')
  if (normalized.length > MAX_MESSAGE_LENGTH) {
    throw new HttpsError('invalid-argument', 'message-text-too-long')
  }
  return normalized
}

function validateRequestId(requestId) {
  const normalized = assertStringId(requestId, 'invalid-argument', 'invalid-message-request-id')
  if (!REQUEST_ID_PATTERN.test(normalized)) {
    throw new HttpsError('invalid-argument', 'invalid-message-request-id')
  }
  return normalized
}

export function buildIdempotentMessageId(senderId, requestId) {
  return `${senderId}_${validateRequestId(requestId)}`
}

function assertConversationAccess({ conversation, business, uid }) {
  if (!Array.isArray(conversation.participantIds) || !conversation.participantIds.includes(uid)) {
    throw new HttpsError('permission-denied', 'conversation-access-denied')
  }
  if (conversation.status !== CONVERSATION_STATUS_ACTIVE) {
    throw new HttpsError('failed-precondition', 'conversation-not-active')
  }
  if (business?.ownerId !== conversation.participantIds.find((participantId) => participantId !== conversation.customerId)) {
    throw new HttpsError('failed-precondition', 'conversation-business-owner-mismatch')
  }
  if (uid !== conversation.customerId && uid !== business.ownerId) {
    throw new HttpsError('permission-denied', 'conversation-access-denied')
  }
  if (Array.isArray(business.managerIds) && uid !== business.ownerId && business.managerIds.includes(uid)) {
    throw new HttpsError('permission-denied', 'manager-messaging-not-supported')
  }
}

function sameLogicalMessage(existing, uid, text, requestId) {
  return existing.senderId === uid
    && existing.type === 'text'
    && existing.text === text
    && existing.requestId === requestId
    && existing.attachment == null
    && existing.moderationStatus === 'visible'
    && existing.editedAt == null
    && existing.deletedAt == null
}

function messagePreview(messageId, senderId, text, createdAt) {
  return {
    messageId,
    senderId,
    type: 'text',
    preview: text,
    createdAt,
  }
}

export async function sendConversationMessage({
  uid,
  conversationId,
  requestId,
  text,
  db,
  now = () => Timestamp.now(),
}) {
  const safeUid = requireValidUid(uid)
  const safeConversationId = assertStringId(conversationId, 'invalid-argument', 'invalid-conversation-id')
  const safeRequestId = validateRequestId(requestId)
  const normalizedText = normalizeText(text)
  const messageId = buildIdempotentMessageId(safeUid, safeRequestId)
  const conversationRef = db.doc(`conversations/${safeConversationId}`)
  const messageRef = conversationRef.collection('messages').doc(messageId)
  const userRef = db.doc(`users/${safeUid}`)

  let result
  await db.runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef)
    assertActiveAccountSnapshot(userSnapshot)
    const conversationSnapshot = await transaction.get(conversationRef)
    if (!conversationSnapshot.exists) throw new HttpsError('not-found', 'conversation-not-found')
    const conversation = conversationSnapshot.data()

    const businessSnapshot = await transaction.get(db.doc(`businesses/${conversation.businessId}`))
    if (!businessSnapshot.exists) throw new HttpsError('failed-precondition', 'conversation-business-not-found')
    const business = businessSnapshot.data()
    assertConversationAccess({ conversation, business, uid: safeUid })

    const existingMessageSnapshot = await transaction.get(messageRef)
    if (existingMessageSnapshot.exists) {
      const existingMessage = existingMessageSnapshot.data()
      if (!sameLogicalMessage(existingMessage, safeUid, normalizedText, safeRequestId)) {
        throw new HttpsError('already-exists', 'message-request-id-conflict')
      }
      if (shouldAdvanceConversationPreview(conversation.lastMessageAt, existingMessage.createdAt)) {
        transaction.update(conversationRef, {
          lastMessage: messagePreview(messageId, safeUid, normalizedText, existingMessage.createdAt),
          lastMessageAt: existingMessage.createdAt,
          updatedAt: now(),
        })
      }
      result = { ok: true, messageId, idempotent: true }
      return
    }

    assertBusinessAllowsMessages(business)

    const createdAt = now()
    const message = {
      senderId: safeUid,
      requestId: safeRequestId,
      type: 'text',
      text: normalizedText,
      attachment: null,
      moderationStatus: 'visible',
      editedAt: null,
      deletedAt: null,
      createdAt,
    }

    transaction.set(messageRef, message)
    if (shouldAdvanceConversationPreview(conversation.lastMessageAt, createdAt)) {
      transaction.update(conversationRef, {
        lastMessage: messagePreview(messageId, safeUid, normalizedText, createdAt),
        lastMessageAt: createdAt,
        updatedAt: createdAt,
      })
    }
    result = { ok: true, messageId, idempotent: false }
  })

  return result
}
