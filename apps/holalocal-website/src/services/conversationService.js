import {
  addDoc,
  collection,
  doc,
  FieldPath,
  getDoc,
  getDocs,
  limit,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/firestoreClient.js'

const MAX_CONVERSATIONS = 50
const MAX_MESSAGES = 100
const MAX_MESSAGE_LENGTH = 4000

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

export async function findOrCreateConversation(customerId, business) {
  if (!customerId) throw new Error('You must be logged in to message a business.')
  if (!business?.businessId || !business.ownerId) {
    throw new Error('This business cannot receive messages yet.')
  }
  if (business.ownerId === customerId) {
    throw new Error('You cannot start a customer conversation with your own business.')
  }

  // This bounded ownership query avoids requiring a new composite index. A future
  // trusted backend transaction can provide stronger uniqueness guarantees.
  const existingSnapshot = await getDocs(query(
    collection(db, 'conversations'),
    where('customerId', '==', customerId),
    limit(MAX_CONVERSATIONS),
  ))
  const existingConversation = existingSnapshot.docs.find((snapshot) => {
    const conversation = snapshot.data()
    return conversation.businessId === business.businessId && conversation.status === 'active'
  })

  if (existingConversation) {
    const currentState = existingConversation.data().participantState?.[customerId]
    if (currentState?.deletedAt || currentState?.archivedAt) {
      await restoreConversationForUser(existingConversation.id, customerId)
    }
    return existingConversation.id
  }

  const participantIds = [...new Set([customerId, business.ownerId])]
  const participantStates = Object.fromEntries(
    participantIds.map((participantId) => [participantId, participantState()]),
  )
  const reference = await addDoc(collection(db, 'conversations'), {
    businessId: business.businessId,
    customerId,
    participantIds,
    participantState: participantStates,
    lastMessage: null,
    lastMessageAt: null,
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return reference.id
}

export async function getConversationsForUser(userId) {
  if (!userId) return []

  const snapshot = await getDocs(query(
    collection(db, 'conversations'),
    where('participantIds', 'array-contains', userId),
    limit(MAX_CONVERSATIONS),
  ))

  return snapshot.docs
    .map((conversation) => ({ conversationId: conversation.id, ...conversation.data() }))
    .filter((conversation) => (
      conversation.status !== 'blocked' &&
      !conversation.participantState?.[userId]?.deletedAt
    ))
    .sort((first, second) => {
      const firstTime = first.lastMessageAt?.toMillis?.() ?? first.createdAt?.toMillis?.() ?? 0
      const secondTime = second.lastMessageAt?.toMillis?.() ?? second.createdAt?.toMillis?.() ?? 0
      return secondTime - firstTime
    })
}

export async function getConversationForUser(conversationId, userId) {
  const snapshot = await getDoc(conversationDocument(conversationId))

  if (!snapshot.exists()) throw new Error('Conversation not found.')

  const conversation = snapshot.data()
  if (!conversation.participantIds?.includes(userId)) {
    throw new Error('You do not have access to this conversation.')
  }

  return { conversationId: snapshot.id, ...conversation }
}

export async function hideConversationForUser(conversationId, userId) {
  const conversationRef = conversationDocument(conversationId)
  const snapshot = await getDoc(conversationRef)
  if (!snapshot.exists()) throw new Error('Conversation not found.')
  if (!snapshot.data().participantIds?.includes(userId)) {
    throw new Error('You do not have access to this conversation.')
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

export async function sendTextMessage(conversationId, senderId, text) {
  const normalizedText = String(text ?? '').trim()
  if (!normalizedText) throw new Error('Enter a message before sending.')
  if (normalizedText.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Messages must be ${MAX_MESSAGE_LENGTH.toLocaleString()} characters or fewer.`)
  }

  const conversationRef = conversationDocument(conversationId)
  const conversationSnapshot = await getDoc(conversationRef)
  if (!conversationSnapshot.exists()) throw new Error('Conversation not found.')

  const conversation = conversationSnapshot.data()
  if (!conversation.participantIds?.includes(senderId)) {
    throw new Error('You do not have access to this conversation.')
  }
  if (conversation.status !== 'active') {
    throw new Error('This conversation is not currently active.')
  }

  const messageRef = doc(messageCollection(conversationId))
  const batch = writeBatch(db)
  const participantRestorationFields = conversation.participantIds.flatMap((participantId) => [
    new FieldPath('participantState', participantId, 'deletedAt'),
    null,
    new FieldPath('participantState', participantId, 'archivedAt'),
    null,
  ])
  // Translation metadata is intentionally omitted until the shared app schema,
  // security rules, consent flow, and translation provider are implemented.
  batch.set(messageRef, {
    senderId,
    type: 'text',
    text: normalizedText,
    attachment: null,
    moderationStatus: 'visible',
    editedAt: null,
    deletedAt: null,
    createdAt: serverTimestamp(),
  })
  // New activity restores the bounded thread for both participants so a reply
  // is not silently missed. Messages and moderation history remain untouched.
  batch.update(
    conversationRef,
    'lastMessage',
    {
      messageId: messageRef.id,
      senderId,
      type: 'text',
      preview: normalizedText.slice(0, 160),
      createdAt: serverTimestamp(),
    },
    'lastMessageAt',
    serverTimestamp(),
    ...participantRestorationFields,
    'updatedAt',
    serverTimestamp(),
  )

  await batch.commit()
  return messageRef.id
}
