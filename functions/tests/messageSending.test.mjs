import test from 'node:test'
import assert from 'node:assert/strict'
import { FakeFirestore } from './fakeFirestore.mjs'
import { buildIdempotentMessageId, sendConversationMessage } from '../src/messageSending.js'

function codeFrom(error) {
  return error?.code
}

function dbWithConversation(overrides = {}) {
  return new FakeFirestore({
    'businesses/business-1': {
      ownerId: 'owner',
      managerIds: ['owner', 'manager'],
      status: 'active',
    },
    'conversations/customer__business-1': {
      businessId: 'business-1',
      customerId: 'customer',
      participantIds: ['customer', 'owner'],
      participantState: {
        customer: { lastReadAt: null, archivedAt: null, mutedUntil: null, deletedAt: null },
        owner: { lastReadAt: null, archivedAt: null, mutedUntil: null, deletedAt: null },
      },
      lastMessage: null,
      lastMessageAt: null,
      status: 'active',
      createdAt: new Date('2026-07-14T10:00:00.000Z'),
      updatedAt: new Date('2026-07-14T10:00:00.000Z'),
      ...overrides,
    },
  })
}

test('sendMessage uses stable sender-owned message IDs for idempotent retries', async () => {
  const db = dbWithConversation()
  const now = () => new Date('2026-07-14T10:01:00.000Z')
  const first = await sendConversationMessage({
    uid: 'customer',
    conversationId: 'customer__business-1',
    requestId: 'request-123',
    text: 'Hello owner',
    db,
    now,
  })
  const retry = await sendConversationMessage({
    uid: 'customer',
    conversationId: 'customer__business-1',
    requestId: 'request-123',
    text: 'Hello owner',
    db,
    now,
  })

  const messageId = buildIdempotentMessageId('customer', 'request-123')
  assert.equal(first.messageId, messageId)
  assert.equal(retry.messageId, messageId)
  assert.equal(retry.idempotent, true)
  assert.equal(db.data(`conversations/customer__business-1/messages/${messageId}`).text, 'Hello owner')
  assert.equal(db.data('conversations/customer__business-1').lastMessage.messageId, messageId)
})

test('sendMessage rejects request ID reuse with different content', async () => {
  const db = dbWithConversation()
  await sendConversationMessage({
    uid: 'customer',
    conversationId: 'customer__business-1',
    requestId: 'request-123',
    text: 'Original',
    db,
    now: () => new Date('2026-07-14T10:01:00.000Z'),
  })

  await assert.rejects(() => sendConversationMessage({
    uid: 'customer',
    conversationId: 'customer__business-1',
    requestId: 'request-123',
    text: 'Changed',
    db,
    now: () => new Date('2026-07-14T10:02:00.000Z'),
  }), (error) => codeFrom(error) === 'already-exists')
})

test('sendMessage keeps the newest authoritative server-ordered preview', async () => {
  const db = dbWithConversation()
  await sendConversationMessage({
    uid: 'customer',
    conversationId: 'customer__business-1',
    requestId: 'newer-123',
    text: 'Newer',
    db,
    now: () => new Date('2026-07-14T10:02:00.000Z'),
  })
  await sendConversationMessage({
    uid: 'owner',
    conversationId: 'customer__business-1',
    requestId: 'older-123',
    text: 'Older completion',
    db,
    now: () => new Date('2026-07-14T10:01:00.000Z'),
  })

  const conversation = db.data('conversations/customer__business-1')
  assert.equal(conversation.lastMessage.preview, 'Newer')
  assert.equal(conversation.lastMessage.senderId, 'customer')
  assert.equal(conversation.lastMessageAt.getTime(), new Date('2026-07-14T10:02:00.000Z').getTime())
})

test('sendMessage rejects unauthenticated unauthorized blank oversized and malformed sends', async () => {
  const db = dbWithConversation()
  await assert.rejects(() => sendConversationMessage({
    uid: '',
    conversationId: 'customer__business-1',
    requestId: 'request-123',
    text: 'Hello',
    db,
  }), (error) => codeFrom(error) === 'unauthenticated')
  await assert.rejects(() => sendConversationMessage({
    uid: 'unrelated',
    conversationId: 'customer__business-1',
    requestId: 'request-123',
    text: 'Hello',
    db,
  }), (error) => codeFrom(error) === 'permission-denied')
  await assert.rejects(() => sendConversationMessage({
    uid: 'customer',
    conversationId: 'customer__business-1',
    requestId: 'request-123',
    text: ' ',
    db,
  }), (error) => codeFrom(error) === 'invalid-argument')
  await assert.rejects(() => sendConversationMessage({
    uid: 'customer',
    conversationId: 'customer__business-1',
    requestId: 'request-123',
    text: 'x'.repeat(4001),
    db,
  }), (error) => codeFrom(error) === 'invalid-argument')
  await assert.rejects(() => sendConversationMessage({
    uid: 'customer',
    conversationId: 'customer__business-1',
    requestId: '../bad',
    text: 'Hello',
    db,
  }), (error) => codeFrom(error) === 'invalid-argument')
})
