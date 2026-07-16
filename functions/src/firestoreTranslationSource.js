import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import {
  processingTranslation,
  retryableFailureTranslation,
  shouldSkipExistingTranslation,
  terminalTranslation,
  validateTranslationEligibility,
} from './messageTranslation.js'

export function createFirestoreTranslationSource(db) {
  return {
    async claimTranslation({ conversationId, messageId, now, leaseUntil, attemptId }) {
      const conversationRef = db.doc(`conversations/${conversationId}`)
      const messageRef = conversationRef.collection('messages').doc(messageId)

      return db.runTransaction(async (transaction) => {
        const [messageSnapshot, conversationSnapshot] = await Promise.all([
          transaction.get(messageRef),
          transaction.get(conversationRef),
        ])

        if (!messageSnapshot.exists || !conversationSnapshot.exists) {
          return { claimed: false, status: 'ignored', reason: 'missing_document' }
        }

        const message = messageSnapshot.data()
        const conversation = conversationSnapshot.data()
        const businessSnapshot = await transaction.get(db.doc(`businesses/${conversation.businessId}`))
        if (!businessSnapshot.exists) {
          transaction.update(messageRef, {
            translation: terminalTranslation({
              status: 'not_required',
              targetLanguage: null,
              sourceLanguage: null,
              reason: 'invalid_conversation',
              now: toTimestamp(now),
            }),
          })
          return { claimed: false, status: 'not_required', reason: 'invalid_conversation' }
        }

        const business = businessSnapshot.data()
        const recipientId = resolveRecipientIdFromConversation(conversation, message?.senderId)
        const recipientSnapshot = recipientId
          ? await transaction.get(db.doc(`users/${recipientId}`))
          : null
        const recipient = recipientSnapshot?.exists ? recipientSnapshot.data() : null
        const eligibility = validateTranslationEligibility({
          message,
          conversation,
          business,
          recipient,
        })
        if (!eligibility.eligible) {
          transaction.update(messageRef, {
            translation: terminalTranslation({
              status: 'not_required',
              targetLanguage: null,
              sourceLanguage: null,
              reason: eligibility.terminalReason,
              now: toTimestamp(now),
            }),
          })
          return { claimed: false, status: 'not_required', reason: eligibility.terminalReason }
        }

        const existing = shouldSkipExistingTranslation(message.translation, now)
        if (existing.skip) {
          return { claimed: false, status: 'skipped', reason: existing.reason }
        }

        transaction.update(messageRef, {
          translation: processingTranslation({
            targetLanguage: eligibility.targetLanguage,
            attemptId,
            now: toTimestamp(now),
            leaseUntil: toTimestamp(leaseUntil),
          }),
        })

        return {
          claimed: true,
          status: 'claimed',
          message,
          targetLanguage: eligibility.targetLanguage,
          sourceLanguageHint: eligibility.sourceLanguageHint,
        }
      })
    },

    async finishTranslation({ conversationId, messageId, attemptId, translation }) {
      const messageRef = db.doc(`conversations/${conversationId}/messages/${messageId}`)
      return db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(messageRef)
        if (!snapshot.exists) return { written: false, reason: 'missing_document' }
        if (snapshot.data().translation?.attemptId !== attemptId) {
          return { written: false, reason: 'stale_attempt' }
        }
        transaction.update(messageRef, { translation })
        return { written: true }
      })
    },

    async releaseTranslation({ conversationId, messageId, attemptId, now, reason }) {
      const messageRef = db.doc(`conversations/${conversationId}/messages/${messageId}`)
      return db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(messageRef)
        if (!snapshot.exists) return { written: false, reason: 'missing_document' }
        const translation = snapshot.data().translation
        if (translation?.attemptId !== attemptId) {
          return { written: false, reason: 'stale_attempt' }
        }
        transaction.update(messageRef, {
          translation: retryableFailureTranslation({
            targetLanguage: translation.targetLanguage,
            attemptId,
            now: toTimestamp(now),
            reason,
          }),
        })
        return { written: true }
      })
    },
  }
}

function resolveRecipientIdFromConversation(conversation, senderId) {
  if (!Array.isArray(conversation?.participantIds) || conversation.participantIds.length !== 2) return null
  if (!conversation.participantIds.includes(senderId)) return null
  return conversation.participantIds.find((participantId) => participantId !== senderId) ?? null
}

function toTimestamp(value) {
  if (value instanceof Timestamp) return value
  if (value instanceof Date) return Timestamp.fromDate(value)
  if (typeof value?.toDate === 'function') return Timestamp.fromDate(value.toDate())
  return FieldValue.serverTimestamp()
}
