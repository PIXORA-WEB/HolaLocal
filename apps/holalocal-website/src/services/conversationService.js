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
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import {
  conversationInboxQueryFilters,
  getConversationActivityTime,
  isConversationHiddenForUser,
  MAX_MESSAGE_LENGTH,
} from '@holalocal/firebase-contract'
import {
  getConversationBusinessContextCallable,
  openBusinessConversationCallable,
  sendMessageCallable,
} from '../firebase/functionsClient.js'
import { db } from '../firebase/firestoreClient.js'
import { createApplicationError } from '../utils/frontendErrors.js'
import { resolveBusinessMediaPresentation } from './businessMediaPresentation.js'

const MAX_MESSAGES = 100

function conversationDocument(conversationId) {
  if (!conversationId) throw new Error('A conversation ID is required.')
  return doc(db, 'conversations', conversationId)
}

function messageCollection(conversationId) {
  return collection(conversationDocument(conversationId), 'messages')
}

export async function getOrCreateConversationForBusiness(customerId, businessId) {
  if (!customerId) throw new Error('You must be logged in to message a business.')
  if (!businessId) throw new Error('This business cannot receive messages yet.')
  const result = await openBusinessConversationCallable({ businessId })
  return result.data?.conversationId
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
  return { conversationId: snapshot.id, ...conversation }
}

export async function getParticipantBusinessContext(conversationId) {
  const result = await getConversationBusinessContextCallable({ conversationId })
  const context = result.data?.businessContext ?? null
  return context?.businessId
    ? resolveBusinessMediaPresentation(context.businessId, context)
    : context
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
