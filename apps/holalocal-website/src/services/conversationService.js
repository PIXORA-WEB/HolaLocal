import {
  collection,
  doc,
  FieldPath,
  getDoc,
  getDocs,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import {
  buildConversationId,
  conversationInboxQueryFilters,
  CONVERSATION_SCHEMA_VERSION,
  CONVERSATION_STATUS_ACTIVE,
  existingConversationQueryFilters,
  getConversationActivityTime,
  hasOwnerOnlyConversationParticipants,
  isConversationHiddenForUser,
  MAX_MESSAGE_LENGTH,
} from '@holalocal/firebase-contract'
import { sendMessageCallable } from '../firebase/functionsClient.js'
import { db } from '../firebase/firestoreClient.js'
import { createApplicationError } from '../utils/frontendErrors.js'
import { getPublicBusinessById } from './businessService.js'

const MAX_MESSAGES = 100

function conversationDocument(conversationId) {
  if (!conversationId) throw new Error('A conversation ID is required.')
  return doc(db, 'conversations', conversationId)
}

function messageCollection(conversationId) {
  return collection(conversationDocument(conversationId), 'messages')
}

function participantState() {
  return {
    lastReadAt: null,
    archivedAt: null,
    mutedUntil: null,
    deletedAt: null,
  }
}

function isCompatibleConversation(snapshot, customerId, businessId) {
  const conversation = snapshot.data()
  return conversation.customerId === customerId
    && conversation.businessId === businessId
    && conversation.status === CONVERSATION_STATUS_ACTIVE
}

function isRestorableForUser(snapshot, userId) {
  const currentState = snapshot.data().participantState?.[userId]
  return Boolean(currentState?.deletedAt || currentState?.archivedAt)
}

function buildInitialConversation(customerId, business) {
  const participantIds = [customerId, business.ownerId]
  const participantStates = Object.fromEntries(
    participantIds.map((participantId) => [participantId, participantState()]),
  )

  return {
    businessId: business.businessId,
    customerId,
    participantIds,
    participantState: participantStates,
    schemaVersion: CONVERSATION_SCHEMA_VERSION,
    lastMessage: null,
    lastMessageAt: null,
    status: CONVERSATION_STATUS_ACTIVE,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
}

async function findExistingConversation(customerId, businessId) {
  const snapshot = await getDocs(query(
    collection(db, 'conversations'),
    ...existingConversationQueryFilters(customerId, businessId).map((constraint) => where(...constraint)),
  ))

  return snapshot.docs.filter((conversation) => (
    isCompatibleConversation(conversation, customerId, businessId)
  ))
}

export async function getOrCreateConversationForBusiness(customerId, business) {
  if (!customerId) throw new Error('You must be logged in to message a business.')
  if (!business?.businessId || !business.ownerId) {
    throw new Error('This business cannot receive messages yet.')
  }
  if (business.status !== CONVERSATION_STATUS_ACTIVE) {
    throw new Error('This business is not currently available for messages.')
  }
  if (business.ownerId === customerId) {
    throw new Error('You cannot start a customer conversation with your own business.')
  }

  const canonicalConversationId = buildConversationId(customerId, business.businessId)
  const existingConversations = await findExistingConversation(customerId, business.businessId)

  if (existingConversations.length > 1) {
    throw new Error('Multiple matching conversations need manual review before messaging can continue.')
  }

  if (existingConversations.length === 1) {
    const [existingConversation] = existingConversations
    if (isRestorableForUser(existingConversation, customerId)) {
      await restoreConversationForUser(existingConversation.id, customerId)
    }
    return existingConversation.id
  }

  await runTransaction(db, async (transaction) => {
    const reference = conversationDocument(canonicalConversationId)
    const snapshot = await transaction.get(reference)
    if (snapshot.exists()) {
      if (!isCompatibleConversation(snapshot, customerId, business.businessId)) {
        throw new Error('The existing conversation identity does not match this business.')
      }
      return
    }

    transaction.set(reference, buildInitialConversation(customerId, business))
  })

  return canonicalConversationId
}

export const findOrCreateConversation = getOrCreateConversationForBusiness

function conversationFromSnapshot(snapshot) {
  return { conversationId: snapshot.id, ...snapshot.data() }
}

function visibleConversationsForUser(conversations, userId) {
  return conversations
    .filter((conversation) => (
      conversation.status !== 'blocked' &&
      !isConversationHiddenForUser(conversation, userId)
    ))
    .sort((first, second) => (
      getConversationActivityTime(second) - getConversationActivityTime(first)
    ))
}

function isOwnerOnlyConversationForBusiness(conversation, business) {
  return Boolean(business?.ownerId)
    && hasOwnerOnlyConversationParticipants(conversation, business.ownerId)
}

function conversationsForUserQuery(userId) {
  return query(
    collection(db, 'conversations'),
    ...conversationInboxQueryFilters(userId).map((constraint) => where(...constraint)),
  )
}

export async function getConversationsForUser(userId) {
  if (!userId) return []

  const snapshot = await getDocs(conversationsForUserQuery(userId))

  return visibleConversationsForUser(snapshot.docs.map(conversationFromSnapshot), userId)
}

export function subscribeToConversationsForUser(userId, onConversations, onError) {
  if (!userId) return () => undefined

  return onSnapshot(
    conversationsForUserQuery(userId),
    (snapshot) => onConversations(visibleConversationsForUser(
      snapshot.docs.map(conversationFromSnapshot),
      userId,
    )),
    onError,
  )
}

export async function getConversationForUser(conversationId, userId) {
  const snapshot = await getDoc(conversationDocument(conversationId))

  if (!snapshot.exists()) throw createApplicationError('conversation-not-found')

  const conversation = snapshot.data()
  if (!conversation.participantIds?.includes(userId)) {
    throw createApplicationError('conversation-access-denied')
  }
  const business = await getPublicBusinessById(conversation.businessId)
  if (!isOwnerOnlyConversationForBusiness(conversation, business)) {
    throw createApplicationError('conversation-access-denied')
  }

  return { conversationId: snapshot.id, ...conversation }
}

export async function hideConversationForUser(conversationId, userId) {
  const conversationRef = conversationDocument(conversationId)
  const snapshot = await getDoc(conversationRef)
  if (!snapshot.exists()) throw createApplicationError('conversation-not-found')
  if (!snapshot.data().participantIds?.includes(userId)) {
    throw createApplicationError('conversation-access-denied')
  }

  await updateDoc(
    conversationRef,
    new FieldPath('participantState', userId, 'deletedAt'),
    serverTimestamp(),
    'updatedAt',
    serverTimestamp(),
  )
}

export async function restoreConversationForUser(conversationId, userId) {
  await updateDoc(
    conversationDocument(conversationId),
    new FieldPath('participantState', userId, 'deletedAt'),
    null,
    new FieldPath('participantState', userId, 'archivedAt'),
    null,
    'updatedAt',
    serverTimestamp(),
  )
}

export async function markConversationReadForUser(conversationId, userId) {
  if (!conversationId || !userId) return
  await updateDoc(
    conversationDocument(conversationId),
    new FieldPath('participantState', userId, 'lastReadAt'),
    serverTimestamp(),
    'updatedAt',
    serverTimestamp(),
  )
}

export function subscribeToMessages(conversationId, onMessages, onError) {
  const messagesQuery = query(
    messageCollection(conversationId),
    orderBy('createdAt', 'asc'),
    limitToLast(MAX_MESSAGES),
  )

  return onSnapshot(
    messagesQuery,
    (snapshot) => onMessages(
      snapshot.docs.map((message) => ({ messageId: message.id, ...message.data() })),
    ),
    onError,
  )
}

export function createMessageRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`
}

export async function sendTextMessage(conversationId, senderId, text, requestId = createMessageRequestId()) {
  if (!senderId) throw createApplicationError('auth-required')
  const normalizedText = String(text ?? '').trim()
  if (!normalizedText) throw createApplicationError('message-text-required')
  if (normalizedText.length > MAX_MESSAGE_LENGTH) {
    throw createApplicationError('message-text-too-long')
  }

  const result = await sendMessageCallable({
    conversationId,
    requestId,
    text: normalizedText,
  })
  return result.data?.messageId
}
