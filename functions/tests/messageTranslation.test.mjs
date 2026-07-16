import test from 'node:test'
import assert from 'node:assert/strict'
import {
  processMessageTranslation,
  processingTranslation,
  retryableFailureTranslation,
  terminalTranslation,
} from '../src/messageTranslation.js'
import { createMockTranslator } from '../src/providers/mockTranslator.js'

const baseTime = new Date('2026-07-12T12:00:00.000Z')

function validState(overrides = {}) {
  return {
    users: {
      customer: { uid: 'customer', roles: ['customer'], accountStatus: 'active', preferredLocale: 'es' },
      owner: { uid: 'owner', roles: ['business'], accountStatus: 'active', preferredLocale: 'en' },
    },
    businesses: {
      business: { ownerId: 'owner', status: 'active' },
    },
    conversations: {
      conversation: {
        businessId: 'business',
        customerId: 'customer',
        participantIds: ['customer', 'owner'],
        status: 'active',
      },
    },
    messages: {
      'conversation/message': {
        senderId: 'customer',
        type: 'text',
        text: 'Hola',
        attachment: null,
        moderationStatus: 'visible',
        editedAt: null,
        deletedAt: null,
        createdAt: baseTime,
      },
    },
    ...overrides,
  }
}

function createFakeSource(state = validState()) {
  const calls = { claims: 0, finishes: 0, releases: 0 }
  return {
    calls,
    state,
    async claimTranslation({ conversationId, messageId, now, leaseUntil, attemptId }) {
      calls.claims += 1
      const key = `${conversationId}/${messageId}`
      const message = state.messages[key]
      const conversation = state.conversations[conversationId]
      if (!message || !conversation) return { claimed: false, status: 'ignored', reason: 'missing_document' }
      const business = state.businesses[conversation.businessId]
      const recipientId = conversation.participantIds?.find((participantId) => participantId !== message.senderId)
      const recipient = state.users[recipientId]

      const existing = message.translation
      if (['completed', 'not_required', 'failed'].includes(existing?.status)) {
        return { claimed: false, status: 'skipped', reason: 'terminal' }
      }
      if (existing?.status === 'processing' && existing.processingLeaseUntil > now) {
        return { claimed: false, status: 'skipped', reason: 'leased' }
      }

      if (!business || conversation.status !== 'active' || business.ownerId !== 'owner') {
        message.translation = terminalTranslation({
          status: 'not_required',
          sourceLanguage: null,
          targetLanguage: null,
          reason: 'invalid_conversation',
          now,
        })
        return { claimed: false, status: 'not_required', reason: 'invalid_conversation' }
      }
      if (!recipient) {
        message.translation = terminalTranslation({
          status: 'not_required',
          sourceLanguage: null,
          targetLanguage: null,
          reason: 'missing_recipient',
          now,
        })
        return { claimed: false, status: 'not_required', reason: 'missing_recipient' }
      }

      const targetLanguage = recipient.preferredLocale
      if (!targetLanguage) {
        message.translation = terminalTranslation({
          status: 'not_required',
          sourceLanguage: null,
          targetLanguage: null,
          reason: 'missing_target_language',
          now,
        })
        return { claimed: false, status: 'not_required', reason: 'missing_target_language' }
      }

      message.translation = processingTranslation({ targetLanguage, attemptId, now, leaseUntil })
      return { claimed: true, status: 'claimed', message: { ...message }, targetLanguage, sourceLanguageHint: null }
    },
    async finishTranslation({ conversationId, messageId, attemptId, translation }) {
      calls.finishes += 1
      const message = state.messages[`${conversationId}/${messageId}`]
      if (message.translation?.attemptId !== attemptId) return { written: false, reason: 'stale_attempt' }
      message.translation = translation
      return { written: true }
    },
    async releaseTranslation({ conversationId, messageId, attemptId, now, reason }) {
      calls.releases += 1
      const message = state.messages[`${conversationId}/${messageId}`]
      if (message.translation?.attemptId !== attemptId) return { written: false, reason: 'stale_attempt' }
      message.translation = retryableFailureTranslation({
        targetLanguage: message.translation.targetLanguage,
        attemptId,
        now,
        reason,
      })
      return { written: true }
    },
  }
}

test('valid text message is translated asynchronously without overwriting original text', async () => {
  const state = validState()
  state.users.owner.preferredLocale = 'es'
  const source = createFakeSource(state)
  const result = await processMessageTranslation({
    conversationId: 'conversation',
    messageId: 'message',
    source,
    translator: createMockTranslator({ detectedSourceLanguage: 'en' }),
    now: baseTime,
    attemptId: 'attempt-1',
  })

  const message = source.state.messages['conversation/message']
  assert.equal(result.status, 'completed')
  assert.equal(message.text, 'Hola')
  assert.equal(message.translation.status, 'completed')
  assert.equal(message.translation.sourceLanguage, 'en')
  assert.equal(message.translation.targetLanguage, 'es')
  assert.equal(message.translation.translatedText, '[es] Hola')
})

test('same source and target language becomes not required', async () => {
  const source = createFakeSource()
  await processMessageTranslation({
    conversationId: 'conversation',
    messageId: 'message',
    source,
    translator: createMockTranslator({ detectedSourceLanguage: 'en' }),
    now: baseTime,
    attemptId: 'same-language',
  })

  assert.equal(source.state.messages['conversation/message'].translation.status, 'not_required')
  assert.equal(source.state.messages['conversation/message'].translation.reason, 'same_language')
})

test('missing target language becomes not required', async () => {
  const state = validState()
  delete state.users.owner.preferredLocale
  const source = createFakeSource(state)

  const result = await processMessageTranslation({
    conversationId: 'conversation',
    messageId: 'message',
    source,
    translator: createMockTranslator(),
    now: baseTime,
  })

  assert.equal(result.status, 'not_required')
  assert.equal(state.messages['conversation/message'].translation.reason, 'missing_target_language')
})

test('provider failure leaves original text and stores only safe reason', async () => {
  const state = validState()
  state.users.owner.preferredLocale = 'es'
  const source = createFakeSource(state)
  const result = await processMessageTranslation({
    conversationId: 'conversation',
    messageId: 'message',
    source,
    translator: createMockTranslator({ fail: true }),
    now: baseTime,
    attemptId: 'failure',
  })

  const message = state.messages['conversation/message']
  assert.equal(result.status, 'failed')
  assert.equal(message.text, 'Hola')
  assert.equal(message.translation.status, 'failed')
  assert.equal(message.translation.reason, 'provider_unavailable')
  assert.equal(JSON.stringify(message.translation).includes('private upstream'), false)
})

test('duplicate invocation skips completed and active leases', async () => {
  const state = validState()
  state.messages['conversation/message'].translation = terminalTranslation({
    status: 'completed',
    sourceLanguage: 'es',
    targetLanguage: 'en',
    translatedText: 'Hello',
    reason: null,
    now: baseTime,
  })
  const source = createFakeSource(state)
  const result = await processMessageTranslation({
    conversationId: 'conversation',
    messageId: 'message',
    source,
    translator: createMockTranslator(),
    now: baseTime,
  })

  assert.equal(result.status, 'skipped')
  assert.equal(source.calls.finishes, 0)

  state.messages['conversation/message'].translation = processingTranslation({
    targetLanguage: 'en',
    attemptId: 'other-attempt',
    now: baseTime,
    leaseUntil: new Date(baseTime.getTime() + 60_000),
  })
  const leased = await processMessageTranslation({
    conversationId: 'conversation',
    messageId: 'message',
    source,
    translator: createMockTranslator(),
    now: baseTime,
  })
  assert.equal(leased.reason, 'leased')
})

test('expired lease can be reclaimed and stale attempt cannot overwrite newer claim', async () => {
  const state = validState()
  state.users.owner.preferredLocale = 'es'
  state.messages['conversation/message'].translation = processingTranslation({
    targetLanguage: 'es',
    attemptId: 'old-attempt',
    now: new Date(baseTime.getTime() - 600_000),
    leaseUntil: new Date(baseTime.getTime() - 300_000),
  })
  const source = createFakeSource(state)
  await processMessageTranslation({
    conversationId: 'conversation',
    messageId: 'message',
    source,
    translator: createMockTranslator({ detectedSourceLanguage: 'en' }),
    now: baseTime,
    attemptId: 'new-attempt',
  })

  assert.equal(state.messages['conversation/message'].translation.status, 'completed')
  assert.equal(state.messages['conversation/message'].translation.translatedText, '[es] Hola')

  const stale = await source.finishTranslation({
    conversationId: 'conversation',
    messageId: 'message',
    attemptId: 'old-attempt',
    translation: terminalTranslation({
      status: 'completed',
      sourceLanguage: 'en',
      targetLanguage: 'es',
      translatedText: 'stale',
      reason: null,
      now: baseTime,
    }),
  })
  assert.equal(stale.written, false)
  assert.equal(state.messages['conversation/message'].translation.translatedText, '[es] Hola')
})

test('retryable failure can be retried after release without looping terminal failures', async () => {
  const state = validState()
  state.users.owner.preferredLocale = 'es'
  const source = createFakeSource(state)
  const retryableTranslator = {
    async translateText() {
      const error = new Error('temporary')
      error.retryable = true
      error.safeReason = 'provider_unavailable'
      throw error
    },
  }
  const first = await processMessageTranslation({
    conversationId: 'conversation',
    messageId: 'message',
    source,
    translator: retryableTranslator,
    now: baseTime,
    attemptId: 'retryable',
  })
  assert.equal(first.status, 'retryable_failed')

  const second = await processMessageTranslation({
    conversationId: 'conversation',
    messageId: 'message',
    source,
    translator: createMockTranslator({ detectedSourceLanguage: 'en' }),
    now: new Date(baseTime.getTime() + 1),
    attemptId: 'retry-success',
  })
  assert.equal(second.status, 'completed')

  const third = await processMessageTranslation({
    conversationId: 'conversation',
    messageId: 'message',
    source,
    translator: createMockTranslator({ detectedSourceLanguage: 'en' }),
    now: new Date(baseTime.getTime() + 2),
    attemptId: 'should-skip',
  })
  assert.equal(third.status, 'skipped')
})
