import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { conversationParticipantPresentation } from '../src/utils/conversationPresentation.js'

function timestamp() {
  return { seconds: 1700000000, nanoseconds: 0, toMillis: () => 1700000000000 }
}

function terminalConversation(overrides = {}) {
  return {
    customerId: 'customer',
    participantIds: ['customer', 'owner'],
    status: 'participant_deleted',
    participantTombstones: {
      customer: { type: 'deleted_user', deletedAt: timestamp() },
    },
    ...overrides,
  }
}

test('surviving business participant receives a neutral deleted-user presentation', () => {
  assert.deepEqual(
    conversationParticipantPresentation(terminalConversation(), 'owner', { deletedUser: 'Deleted user' }),
    { deleted: true, label: 'Deleted user', avatarUrl: null },
  )
  assert.equal(conversationParticipantPresentation(terminalConversation(), 'customer').deleted, false)
  assert.equal(conversationParticipantPresentation(terminalConversation(), 'different-uid').deleted, false)
})

test('malformed or PII-bearing tombstones cannot activate deleted-user presentation', () => {
  for (const participantTombstones of [
    { customer: { type: 'deleted_user', deletedAt: timestamp(), name: 'Stale name' } },
    { customer: { type: 'deleted_user', deletedAt: new Date() } },
    { customer: { type: 'other', deletedAt: timestamp() } },
    { other: { type: 'deleted_user', deletedAt: timestamp() } },
  ]) {
    assert.equal(conversationParticipantPresentation(
      terminalConversation({ participantTombstones }), 'owner', { deletedUser: 'Deleted user' },
    ).deleted, false)
  }
})

test('message page keeps history but suppresses terminal composer and stale participant media', async () => {
  const source = await readFile(new URL('../src/pages/MessagesPage.jsx', import.meta.url), 'utf8')
  assert.match(source, /isParticipantDeletedConversation\(conversation\)/)
  assert.match(source, /business\.canSendMessages && !participantDeleted/)
  assert.match(source, /participantDeleted \? t\('messages\.participantDeletedNotice'\)/)
  assert.match(source, /participantPresentation\.deleted \? null : business\.logoUrl/)
  assert.match(source, /participantPresentation\.deleted \? participantPresentation\.label/)
})

test('all supported locales provide terminal conversation copy', async () => {
  const { conversationTerminalTranslations } = await import('../src/i18n/conversationTerminalTranslations.js')
  assert.equal(Object.keys(conversationTerminalTranslations).length, 17)
  for (const [locale, resource] of Object.entries(conversationTerminalTranslations)) {
    assert.equal(typeof resource.messages.deletedUser, 'string', locale)
    assert.ok(resource.messages.deletedUser.trim(), locale)
    assert.equal(typeof resource.messages.participantDeletedNotice, 'string', locale)
    assert.ok(resource.messages.participantDeletedNotice.trim(), locale)
  }
})
