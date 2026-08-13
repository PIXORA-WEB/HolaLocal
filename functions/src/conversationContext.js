import { createHash } from 'node:crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import {
  buildConversationId,
  CONVERSATION_SCHEMA_VERSION,
  CONVERSATION_STATUS_ACTIVE,
  CONVERSATION_STATUS_PARTICIPANT_DELETED,
  hasOwnerOnlyConversationParticipants,
  isParticipantDeletedConversation,
  isCanonicalBusinessLogoPath,
  isPublicBusinessEligible,
  parseLegacyFirebaseBusinessMediaUrl,
} from '@holalocal/firebase-contract'
import { projectSafeBusinessMedia } from './businessMediaProjection.js'

const MAX_ID_LENGTH = 128
const GENERIC_BUSINESS_NAME = 'Business unavailable'
const CONVERSATION_V2_DOMAIN = Buffer.from('holalocal:conversation:v2\0', 'utf8')

function requireId(value, message) {
  if (
    typeof value !== 'string'
    || !value.trim()
    || value !== value.trim()
    || value.includes('/')
    || value.length > MAX_ID_LENGTH
  ) {
    throw new HttpsError('invalid-argument', message)
  }
  return value
}

function requireUid(value) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.includes('/')) {
    throw new HttpsError('unauthenticated', 'auth-required')
  }
  return value
}

function requireActiveAccount(snapshot) {
  if (
    !snapshot.exists
    || snapshot.data()?.accountStatus !== 'active'
    || snapshot.data()?.deletionRequestedAt != null
  ) {
    throw new HttpsError('failed-precondition', 'account-not-active')
  }
}

function displayText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function snapshotFromBusiness(businessId, business) {
  const media = projectSafeBusinessMedia(businessId, business)
  return {
    name: displayText(business?.name) ?? GENERIC_BUSINESS_NAME,
    logoUrl: media.logoUrl,
    logoStoragePath: media.logoStoragePath,
    primaryLanguage: displayText(business?.primaryLanguage),
  }
}

function safeStoredSnapshot(conversation, businessId) {
  const snapshot = conversation?.businessSnapshot
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null
  return {
    name: displayText(snapshot.name) ?? GENERIC_BUSINESS_NAME,
    logoUrl: parseLegacyFirebaseBusinessMediaUrl(snapshot.logoUrl, businessId)?.kind === 'logo'
      ? snapshot.logoUrl
      : null,
    logoStoragePath: isCanonicalBusinessLogoPath(snapshot.logoStoragePath, businessId)
      ? snapshot.logoStoragePath
      : null,
    primaryLanguage: displayText(snapshot.primaryLanguage),
  }
}

function participantBusinessOwnerId(conversation) {
  if (
    typeof conversation?.customerId !== 'string'
    || !Array.isArray(conversation?.participantIds)
    || conversation.participantIds.length !== 2
    || !conversation.participantIds.includes(conversation.customerId)
  ) return null
  return conversation.participantIds.find((participantId) => participantId !== conversation.customerId) ?? null
}

function conversationMatchesPair(conversation, customerId, businessId) {
  return conversation?.customerId === customerId && conversation?.businessId === businessId
}

function lengthPrefixedUtf8(value) {
  const bytes = Buffer.from(value, 'utf8')
  const length = Buffer.allocUnsafe(4)
  length.writeUInt32BE(bytes.length)
  return [length, bytes]
}

export function buildCollisionSafeConversationId(customerId, businessId) {
  const safeCustomerId = requireUid(customerId)
  const safeBusinessId = requireId(businessId, 'invalid-business-id')
  const canonicalBytes = Buffer.concat([
    CONVERSATION_V2_DOMAIN,
    ...lengthPrefixedUtf8(safeCustomerId),
    ...lengthPrefixedUtf8(safeBusinessId),
  ])
  const digest = createHash('sha256').update(canonicalBytes).digest('base64url')
  return `v2_${digest}`
}

function assertParticipantConversation(conversation, uid) {
  const ownerId = participantBusinessOwnerId(conversation)
  if (
    ![CONVERSATION_STATUS_ACTIVE, CONVERSATION_STATUS_PARTICIPANT_DELETED].includes(conversation?.status)
    || !ownerId
    || !conversation.participantIds.includes(uid)
    || (conversation.status === CONVERSATION_STATUS_PARTICIPANT_DELETED
      && !isParticipantDeletedConversation(conversation))
  ) {
    throw new HttpsError('failed-precondition', 'conversation-participant-integrity-error')
  }
  return ownerId
}

export function projectConversationBusinessContext({ businessId, business, conversation }) {
  const storedSnapshot = safeStoredSnapshot(conversation, businessId)
  const display = business ? snapshotFromBusiness(businessId, business) : storedSnapshot ?? {
    name: GENERIC_BUSINESS_NAME,
    logoUrl: null,
    logoStoragePath: null,
    primaryLanguage: null,
  }
  const canSendMessages = business?.status === CONVERSATION_STATUS_ACTIVE
    && conversation?.status !== CONVERSATION_STATUS_PARTICIPANT_DELETED
  const profileAvailable = Boolean(business && isPublicBusinessEligible(business))

  return {
    businessId,
    name: display.name,
    logoUrl: display.logoUrl,
    logoStoragePath: display.logoStoragePath,
    primaryLanguage: display.primaryLanguage,
    profileAvailable,
    canSendMessages,
    availability: profileAvailable
      ? 'available'
      : canSendMessages ? 'profile_unavailable' : 'conversation_closed',
  }
}

function participantState() {
  return {
    lastReadAt: null,
    archivedAt: null,
    mutedUntil: null,
    deletedAt: null,
  }
}

function buildConversation({ businessId, business, customerId, now }) {
  const participantIds = [customerId, business.ownerId]
  return {
    businessId,
    businessSnapshot: snapshotFromBusiness(businessId, business),
    customerId,
    participantIds,
    participantState: Object.fromEntries(participantIds.map((uid) => [uid, participantState()])),
    schemaVersion: CONVERSATION_SCHEMA_VERSION,
    lastMessage: null,
    lastMessageAt: null,
    status: CONVERSATION_STATUS_ACTIVE,
    createdAt: now,
    updatedAt: now,
  }
}

export async function openBusinessConversation({ uid, businessId, db, now = () => Timestamp.now() }) {
  const safeUid = requireUid(uid)
  const safeBusinessId = requireId(businessId, 'invalid-business-id')
  const userRef = db.doc(`users/${safeUid}`)
  const businessRef = db.doc(`businesses/${safeBusinessId}`)
  let result

  await db.runTransaction(async (transaction) => {
    const [userSnapshot, businessSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(businessRef),
    ])
    requireActiveAccount(userSnapshot)
    if (!businessSnapshot.exists || !isPublicBusinessEligible(businessSnapshot.data())) {
      throw new HttpsError('failed-precondition', 'business-not-available-for-conversation')
    }

    const business = businessSnapshot.data()
    const ownerId = requireId(business.ownerId, 'invalid-business-owner')
    if (ownerId === safeUid) throw new HttpsError('failed-precondition', 'self-conversation-not-allowed')

    const legacyId = buildConversationId(safeUid, safeBusinessId)
    const v2Id = buildCollisionSafeConversationId(safeUid, safeBusinessId)
    const legacyRef = db.doc(`conversations/${legacyId}`)
    const v2Ref = db.doc(`conversations/${v2Id}`)
    const [legacySnapshot, v2Snapshot] = await Promise.all([
      transaction.get(legacyRef),
      transaction.get(v2Ref),
    ])
    const legacyMatches = legacySnapshot.exists
      && conversationMatchesPair(legacySnapshot.data(), safeUid, safeBusinessId)
    const v2Matches = v2Snapshot.exists
      && conversationMatchesPair(v2Snapshot.data(), safeUid, safeBusinessId)

    if (v2Snapshot.exists && !v2Matches) {
      throw new HttpsError('internal', 'conversation-id-integrity-error')
    }
    if (legacyMatches && v2Matches) {
      throw new HttpsError('failed-precondition', 'conversation-duplicate-integrity-error')
    }

    const conversationSnapshot = v2Matches ? v2Snapshot : legacyMatches ? legacySnapshot : null
    const conversationId = v2Matches ? v2Id : legacyMatches ? legacyId
      : legacySnapshot.exists ? v2Id : legacyId
    const conversationRef = conversationId === v2Id ? v2Ref : legacyRef
    const context = projectConversationBusinessContext({
      businessId: safeBusinessId,
      business,
      conversation: conversationSnapshot?.data() ?? null,
    })

    if (conversationSnapshot) {
      const conversation = conversationSnapshot.data()
      if (isParticipantDeletedConversation(conversation)) {
        throw new HttpsError('failed-precondition', 'conversation-participant-deleted')
      }
      if (!hasOwnerOnlyConversationParticipants(conversation, ownerId)
        || conversation.customerId !== safeUid
        || conversation.businessId !== safeBusinessId
        || conversation.status !== CONVERSATION_STATUS_ACTIVE) {
        throw new HttpsError('failed-precondition', 'conversation-identity-mismatch')
      }
      const ownState = conversation.participantState?.[safeUid]
      if (ownState?.deletedAt != null || ownState?.archivedAt != null) {
        transaction.update(conversationRef, {
          participantState: {
            ...conversation.participantState,
            [safeUid]: { ...ownState, deletedAt: null, archivedAt: null },
          },
          updatedAt: now(),
        })
      }
      result = { conversationId, businessContext: context }
      return
    }

    const createdAt = now()
    transaction.set(conversationRef, buildConversation({
      businessId: safeBusinessId,
      business,
      customerId: safeUid,
      now: createdAt,
    }))
    result = { conversationId, businessContext: context }
  })

  return result
}

export async function getConversationBusinessContext({ uid, conversationId, db }) {
  const safeUid = requireUid(uid)
  const safeConversationId = requireId(conversationId, 'invalid-conversation-id')
  const userSnapshot = await db.doc(`users/${safeUid}`).get()
  requireActiveAccount(userSnapshot)

  const conversationSnapshot = await db.doc(`conversations/${safeConversationId}`).get()
  if (!conversationSnapshot.exists) throw new HttpsError('not-found', 'conversation-not-found')
  const conversation = conversationSnapshot.data()
  if (!Array.isArray(conversation?.participantIds) || !conversation.participantIds.includes(safeUid)) {
    throw new HttpsError('not-found', 'conversation-not-found')
  }
  const ownerId = assertParticipantConversation(conversation, safeUid)
  const businessId = requireId(conversation.businessId, 'invalid-conversation-business-id')
  const businessSnapshot = await db.doc(`businesses/${businessId}`).get()
  const business = businessSnapshot.exists ? businessSnapshot.data() : null
  if (business && business.ownerId !== ownerId) {
    throw new HttpsError('failed-precondition', 'conversation-business-owner-mismatch')
  }

  return {
    businessContext: projectConversationBusinessContext({ businessId, business, conversation }),
  }
}

export function assertBusinessAllowsMessages(business) {
  if (business?.status !== CONVERSATION_STATUS_ACTIVE) {
    throw new HttpsError('failed-precondition', 'business-messaging-unavailable')
  }
}

export function assertActiveAccountSnapshot(snapshot) {
  requireActiveAccount(snapshot)
}
