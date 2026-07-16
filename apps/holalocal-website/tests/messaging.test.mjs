import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { shouldAdvanceConversationPreview } from '@holalocal/firebase-contract'

const serviceUrl = new URL('../src/services/conversationService.js', import.meta.url)
const messagesPageUrl = new URL('../src/pages/MessagesPage.jsx', import.meta.url)
const routesUrl = new URL('../src/routes/AppRoutes.jsx', import.meta.url)
const servicesPageUrl = new URL('../src/pages/ServicesPage.jsx', import.meta.url)
const detailPanelUrl = new URL('../src/components/common/BusinessDetailPanel.jsx', import.meta.url)
const siteHeaderUrl = new URL('../src/components/layout/SiteHeader.jsx', import.meta.url)
const unreadHookUrl = new URL('../src/hooks/useUnreadMessageCount.js', import.meta.url)
const rulesUrl = new URL('../../../firestore.rules', import.meta.url)

test('message sending uses callable idempotency instead of direct client writes', async () => {
  const source = await readFile(serviceUrl, 'utf8')

  assert.match(source, /sendMessageCallable/)
  assert.match(source, /createMessageRequestId/)
  assert.match(source, /requestId/)
  assert.doesNotMatch(source, /Timestamp\.now\(\)/)
  assert.doesNotMatch(source, /transaction\.set\(messageRef/)
  assert.doesNotMatch(source, /preview: normalizedText/)
  assert.doesNotMatch(source, /writeBatch/)
  assert.doesNotMatch(source, /translatedText/)
  assert.doesNotMatch(source, /translation:/)
  assert.doesNotMatch(source, /preview: normalizedText\.slice/)
  assert.doesNotMatch(source, /participantRestorationFields/)
  assert.doesNotMatch(source, /contact\./)
})

test('conversation preview helper rejects older sends that finish after newer sends', () => {
  const older = new Date('2026-07-14T10:00:00.000Z')
  const newer = new Date('2026-07-14T10:00:00.050Z')

  assert.equal(shouldAdvanceConversationPreview(null, older), true)
  assert.equal(shouldAdvanceConversationPreview(older, newer), true)
  assert.equal(shouldAdvanceConversationPreview(newer, older), false)
  assert.equal(shouldAdvanceConversationPreview(newer, newer), true)
})

test('messaging rules reject direct preview regression and unauthorized preview spoofing', async () => {
  const rules = await readFile(rulesUrl, 'utf8')

  assert.match(rules, /match \/messages\/\{messageId\}/)
  assert.match(rules, /allow create: if false/)
  assert.match(rules, /function validMessageCreatedAt\(data\)/)
  assert.match(rules, /data\.createdAt <= request\.time/)
  assert.match(rules, /data\.createdAt >= request\.time - duration\.value\(5, 'm'\)/)
  assert.match(rules, /request\.resource\.data\.lastMessageAt == getAfter\(previewMessagePath\(\)\)\.data\.createdAt/)
  assert.match(rules, /resource\.data\.lastMessageAt == null \|\| request\.resource\.data\.lastMessageAt >= resource\.data\.lastMessageAt/)
  assert.match(rules, /request\.resource\.data\.lastMessage\.preview == getAfter\(previewMessagePath\(\)\)\.data\.text/)
  assert.match(rules, /request\.resource\.data\.lastMessage\.senderId == getAfter\(previewMessagePath\(\)\)\.data\.senderId/)
})

test('messages page preserves send, error feedback and disabled states', async () => {
  const source = await readFile(messagesPageUrl, 'utf8')

  assert.match(source, /pendingSendRef/)
  assert.match(source, /createMessageRequestId\(\)/)
  assert.match(source, /sendTextMessage\(conversationId, user\.uid, normalizedText, pendingSend\.requestId\)/)
  assert.match(source, /subscribeToConversationsForUser/)
  assert.match(source, /markConversationReadForUser\(conversationId, user\.uid\)/)
  assert.match(source, /isConversationUnreadForUser\(currentConversation, user\.uid\)/)
  assert.match(source, /setError\(sendError\.message \|\| t\('messages\.errors\.send'\)\)/)
  assert.match(source, /disabled=\{sending \|\| !messageText\.trim\(\)\}/)
  assert.match(source, /onSubmit=\{handleSend\}/)
  assert.match(source, /subscribeToMessages/)
})

test('messages page renders backend translation metadata without hiding original text', async () => {
  const source = await readFile(messagesPageUrl, 'utf8')

  assert.match(source, /normalizeMessageTranslation\(message\.translation\)/)
  assert.match(source, /shouldShowTranslatedMessage\(message, user\.uid\)/)
  assert.match(source, /selectMessageDisplayText\(message, user\.uid, showOriginal\)/)
  assert.match(source, /messages\.translation\.completed/)
  assert.match(source, /messages\.translation\.viewOriginal/)
  assert.match(source, /messages\.translation\.viewTranslation/)
  assert.match(source, /messages\.translation\.processing/)
  assert.match(source, /messages\.translation\.failed/)
  assert.match(source, /visibleText/)
})

test('header and inbox derive unread state from the shared helper', async () => {
  const [messagesPage, siteHeader, unreadHook] = await Promise.all([
    readFile(messagesPageUrl, 'utf8'),
    readFile(siteHeaderUrl, 'utf8'),
    readFile(unreadHookUrl, 'utf8'),
  ])

  assert.match(messagesPage, /isUnread \? 'is-unread' : ''/)
  assert.match(messagesPage, /messages\.unreadConversation/)
  assert.match(messagesPage, /formatMessageTime\(item\.lastMessageAt \?\? item\.createdAt\)/)
  assert.match(siteHeader, /useUnreadMessageCount\(user\?\.uid\)/)
  assert.match(siteHeader, /message-unread-badge/)
  assert.match(siteHeader, /unreadMessageCount > 99 \? '99\+' : unreadMessageCount/)
  assert.match(unreadHook, /subscribeToConversationsForUser/)
  assert.match(unreadHook, /isConversationUnreadForUser\(conversation, userId\)/)
  assert.match(unreadHook, /if \(!userId\)/)
})

test('website messaging filters conversations to customer plus exact business owner', async () => {
  const [service, messagesPage] = await Promise.all([
    readFile(serviceUrl, 'utf8'),
    readFile(messagesPageUrl, 'utf8'),
  ])

  assert.match(service, /hasOwnerOnlyConversationParticipants/)
  assert.match(service, /isOwnerOnlyConversationForBusiness\(conversation, business\)/)
  assert.match(messagesPage, /hasOwnerOnlyConversationParticipants\(conversation, conversation\.business\?\.ownerId\)/)
  assert.doesNotMatch(service, /managerIds.*participantIds/)
})

test('message routes and business-profile CTA remain wired to existing flows', async () => {
  const [routes, servicesPage, detailPanel] = await Promise.all([
    readFile(routesUrl, 'utf8'),
    readFile(servicesPageUrl, 'utf8'),
    readFile(detailPanelUrl, 'utf8'),
  ])

  assert.match(routes, /path="messages"/)
  assert.match(routes, /path="messages\/:conversationId"/)
  assert.match(servicesPage, /getOrCreateConversationForBusiness\(user\.uid, selectedBusiness\)/)
  assert.match(servicesPage, /navigate\(`\/messages\/\$\{conversationId\}`\)/)
  assert.match(servicesPage, /setAuthPromptReason\('message'\)/)
  assert.match(detailPanel, /Message business/)
  assert.match(detailPanel, /onClick=\{onMessage\}/)
})

test('conversation creation uses a deterministic transaction-safe identity', async () => {
  const source = await readFile(serviceUrl, 'utf8')

  assert.match(source, /runTransaction/)
  assert.match(source, /buildConversationId\(customerId, business\.businessId\)/)
  assert.match(source, /transaction\.get\(reference\)/)
  assert.match(source, /transaction\.set\(reference, buildInitialConversation\(customerId, business\)\)/)
  assert.match(source, /Multiple matching conversations need manual review/)
  assert.match(source, /export const findOrCreateConversation = getOrCreateConversationForBusiness/)
  assert.doesNotMatch(source, /addDoc/)
})

test('remove and restore operations only target participant state', async () => {
  const source = await readFile(serviceUrl, 'utf8')

  assert.match(source, /hideConversationForUser/)
  assert.match(source, /restoreConversationForUser/)
  assert.match(source, /markConversationReadForUser/)
  assert.match(source, /new FieldPath\('participantState', userId, 'deletedAt'\)/)
  assert.match(source, /new FieldPath\('participantState', userId, 'archivedAt'\)/)
  assert.match(source, /new FieldPath\('participantState', userId, 'lastReadAt'\)/)
  assert.doesNotMatch(source, /deleteDoc/)
})

test('mobile messaging remains placeholder-only and cannot create conversations', async () => {
  const mobileMessagesUrl = new URL('../../holalocal-app/src/pages/customer/MessagesPage.jsx', import.meta.url)
  const source = await readFile(mobileMessagesUrl, 'utf8')

  assert.match(source, /PlaceholderPage/)
  assert.doesNotMatch(source, /conversationService/)
  assert.doesNotMatch(source, /addDoc|setDoc|writeBatch|runTransaction|lastReadAt/)
})
