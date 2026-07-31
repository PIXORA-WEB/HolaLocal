import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { shouldAdvanceConversationPreview } from '@holalocal/firebase-contract'
import {
  classifyFrontendError,
  createApplicationError,
} from '../src/utils/frontendErrors.js'
import {
  conversationViewReducer,
  createInboxViewState,
  createConversationViewState,
  enrichConversationSummaries,
  inboxViewReducer,
  messageSenderIdentity,
  pendingSendForDraft,
  selectInboxView,
  selectConversationView,
} from '../src/utils/messageConversationState.js'
import { universalOperationalTranslations } from '../src/i18n/locales/universalOperationalTranslations.js'

const serviceUrl = new URL('../src/services/conversationService.js', import.meta.url)
const messagesPageUrl = new URL('../src/pages/MessagesPage.jsx', import.meta.url)
const messageStateUrl = new URL('../src/utils/messageConversationState.js', import.meta.url)
const routesUrl = new URL('../src/routes/AppRoutes.jsx', import.meta.url)
const servicesPageUrl = new URL('../src/pages/ServicesPage.jsx', import.meta.url)
const detailPanelUrl = new URL('../src/components/common/BusinessDetailPanel.jsx', import.meta.url)
const siteHeaderUrl = new URL('../src/components/layout/SiteHeader.jsx', import.meta.url)
const unreadHookUrl = new URL('../src/hooks/useUnreadMessageCount.js', import.meta.url)
const rulesUrl = new URL('../../../firestore.rules', import.meta.url)
const indexesUrl = new URL('../../../firestore.indexes.json', import.meta.url)

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

  assert.match(source, /pendingSendForDraft/)
  assert.match(source, /pendingSendForDraft\([\s\S]*createMessageRequestId,/)
  assert.match(source, /sendTextMessage\(conversationId, user\.uid, normalizedText, pendingSend\.requestId\)/)
  assert.match(source, /subscribeToConversationsForUser/)
  assert.match(source, /markConversationReadForUser\(conversationId, user\.uid\)/)
  assert.match(source, /isConversationUnreadForUser\(currentConversation, user\.uid\)/)
  assert.match(source, /classifyFrontendError\(sendError, \{ fallbackType: 'MESSAGE_SEND_FAILED' \}\)/)
  assert.match(source, /message=\{t\(error\.translationKey\)\}/)
  assert.doesNotMatch(source, /(?:error|Error)\.message/)
  assert.match(source, /disabled=\{sending \|\| !messageText\.trim\(\)\}/)
  assert.match(source, /onSubmit=\{handleSend\}/)
  assert.match(source, /subscribeToMessages/)
  assert.match(source, /dispatchConversation\(\{ type: 'sendSucceeded', conversationId, operationId \}\)/)
  assert.match(source, /catch \(sendError\) \{\s*dispatchConversation\(/)
})

test('conversation view state is isolated by routed conversation before effects run', () => {
  let state = createConversationViewState('conversation-a')
  state = conversationViewReducer(state, {
    type: 'metadataLoaded',
    business: { name: 'Business A' },
    conversation: { conversationId: 'conversation-a' },
    conversationId: 'conversation-a',
  })
  state = conversationViewReducer(state, {
    type: 'messagesLoaded',
    conversationId: 'conversation-a',
    messages: [{ messageId: 'message-a', text: 'Private A message' }],
  })
  state = conversationViewReducer(state, {
    type: 'draftChanged',
    conversationId: 'conversation-a',
    draft: 'Draft for A',
  })

  const conversationBView = selectConversationView(state, 'conversation-b')
  assert.equal(conversationBView.conversationId, 'conversation-b')
  assert.equal(conversationBView.draft, '')
  assert.deepEqual(conversationBView.messages, [])
  assert.equal(conversationBView.business, null)
  assert.equal(conversationBView.loadStatus, 'loading')
})

test('inbox loading, loaded-empty, loaded-data, and failed states are mutually exclusive', () => {
  let state = createInboxViewState('customer')
  assert.equal(state.status, 'loading')
  assert.deepEqual(state.items, [])
  assert.equal(state.error, null)

  state = inboxViewReducer(state, {
    type: 'loadFailed',
    error: { type: 'MESSAGE_LOAD_FAILED' },
    userId: 'customer',
  })
  assert.equal(state.status, 'failed')
  assert.deepEqual(state.items, [])
  assert.equal(state.error.type, 'MESSAGE_LOAD_FAILED')

  state = inboxViewReducer(state, {
    type: 'loadSucceeded',
    items: [],
    userId: 'customer',
  })
  assert.equal(state.status, 'ready')
  assert.deepEqual(state.items, [])
  assert.equal(state.error, null)

  state = inboxViewReducer(state, {
    type: 'loadSucceeded',
    items: [{ conversationId: 'conversation-a' }],
    userId: 'customer',
  })
  assert.equal(state.status, 'ready')
  assert.equal(state.items.length, 1)
  assert.equal(state.error, null)

  const otherAccountView = selectInboxView(state, 'owner')
  assert.equal(otherAccountView.status, 'loading')
  assert.deepEqual(otherAccountView.items, [])
  assert.equal(otherAccountView.error, null)
})

test('message listener failure is terminal and cannot render successful-empty history', () => {
  let state = createConversationViewState('conversation-a')
  state = conversationViewReducer(state, {
    type: 'metadataLoaded',
    business: { ownerId: 'owner' },
    conversation: { conversationId: 'conversation-a' },
    conversationId: 'conversation-a',
  })
  state = conversationViewReducer(state, {
    type: 'messagesFailed',
    conversationId: 'conversation-a',
    error: { type: 'MESSAGE_LOAD_FAILED' },
  })

  assert.equal(state.loadStatus, 'messages-failed')
  assert.deepEqual(state.messages, [])
  assert.equal(state.error.type, 'MESSAGE_LOAD_FAILED')
})

test('conversation enrichment omits unavailable entries without discarding valid conversations', async () => {
  const conversations = [
    {
      businessId: 'available-business',
      conversationId: 'conversation-a',
      customerId: 'customer-a',
      participantIds: ['customer-a', 'owner-a'],
    },
    {
      businessId: 'missing-business',
      conversationId: 'conversation-b',
      customerId: 'customer-b',
      participantIds: ['customer-b', 'owner-b'],
    },
    {
      businessId: 'private-business',
      conversationId: 'conversation-c',
      customerId: 'customer-c',
      participantIds: ['customer-c', 'owner-c'],
    },
    {
      businessId: 'network-business',
      conversationId: 'conversation-d',
      customerId: 'customer-d',
      participantIds: ['customer-d', 'owner-d'],
    },
  ]
  const businesses = {
    'available-business': { name: 'Visible business', ownerId: 'owner-a' },
    'missing-business': null,
  }
  const result = await enrichConversationSummaries(conversations, async (businessId) => {
    if (businessId === 'private-business') {
      throw { code: 'firestore/permission-denied', message: 'suspended internal status' }
    }
    if (businessId === 'network-business') {
      throw { code: 'firestore/unavailable', message: 'projects/private-project' }
    }
    return businesses[businessId]
  })

  assert.deepEqual(result.map(({ conversationId }) => conversationId), ['conversation-a'])
  assert.equal(result[0].business.name, 'Visible business')
  assert.doesNotMatch(JSON.stringify(result), /suspended|private-project|missing-business/)
})

test('conversation enrichment escalates a complete infrastructure failure', async () => {
  await assert.rejects(
    () => enrichConversationSummaries([
      {
        businessId: 'network-business',
        conversationId: 'conversation-a',
        customerId: 'customer',
        participantIds: ['customer', 'owner'],
      },
    ], async () => {
      throw { code: 'firestore/unavailable', message: 'technical endpoint' }
    }),
    (error) => error.code === 'firestore/unavailable',
  )
})

test('message sender identity distinguishes the current user from the other participant', () => {
  assert.equal(messageSenderIdentity('customer', 'customer', 'You', 'Local business'), 'You')
  assert.equal(messageSenderIdentity('owner', 'customer', 'You', 'Local business'), 'Local business')
})

test('new conversation metadata cannot expose old messages before its first snapshot', () => {
  let state = createConversationViewState('conversation-a')
  state = conversationViewReducer(state, {
    type: 'messagesLoaded',
    conversationId: 'conversation-a',
    messages: [{ messageId: 'message-a', text: 'Private A message' }],
  })
  state = conversationViewReducer(state, {
    type: 'loadStarted',
    conversationId: 'conversation-b',
  })
  state = conversationViewReducer(state, {
    type: 'metadataLoaded',
    business: { name: 'Business B' },
    conversation: { conversationId: 'conversation-b' },
    conversationId: 'conversation-b',
  })

  assert.equal(state.loadStatus, 'messages-loading')
  assert.deepEqual(state.messages, [])

  const beforeStaleSnapshot = state
  state = conversationViewReducer(state, {
    type: 'messagesLoaded',
    conversationId: 'conversation-a',
    messages: [{ messageId: 'late-message-a', text: 'Late private A message' }],
  })
  assert.deepEqual(state, beforeStaleSnapshot)

  state = conversationViewReducer(state, {
    type: 'messagesLoaded',
    conversationId: 'conversation-b',
    messages: [{ messageId: 'message-b', text: 'Message for B' }],
  })
  assert.equal(state.loadStatus, 'ready')
  assert.deepEqual(state.messages.map(({ messageId }) => messageId), ['message-b'])
})

test('late send success and failure cannot mutate a newer conversation operation', () => {
  let state = createConversationViewState('conversation-a')
  state = conversationViewReducer(state, {
    type: 'sendStarted',
    conversationId: 'conversation-a',
    operationId: 1,
    pendingSend: { requestId: 'request-a', text: 'Draft A' },
  })
  state = conversationViewReducer(state, {
    type: 'loadStarted',
    conversationId: 'conversation-b',
  })
  state = conversationViewReducer(state, {
    type: 'draftChanged',
    conversationId: 'conversation-b',
    draft: 'Draft B',
  })
  state = conversationViewReducer(state, {
    type: 'sendStarted',
    conversationId: 'conversation-b',
    operationId: 2,
    pendingSend: { requestId: 'request-b', text: 'Draft B' },
  })

  const beforeLateCompletion = state
  state = conversationViewReducer(state, {
    type: 'sendSucceeded',
    conversationId: 'conversation-a',
    operationId: 1,
  })
  state = conversationViewReducer(state, {
    type: 'sendFailed',
    conversationId: 'conversation-a',
    operationId: 1,
    error: { type: 'MESSAGE_SEND_FAILED' },
  })
  state = conversationViewReducer(state, {
    type: 'sendFinished',
    conversationId: 'conversation-a',
    operationId: 1,
  })

  assert.deepEqual(state, beforeLateCompletion)
  assert.equal(state.draft, 'Draft B')
  assert.equal(state.sending, true)
  assert.equal(state.sendOperationId, 2)
  assert.equal(state.pendingSend.requestId, 'request-b')
  assert.equal(state.error, null)
})

test('same-conversation retry retains its request ID until success', () => {
  let requestSequence = 0
  const createRequestId = () => `request-${requestSequence += 1}`
  let state = createConversationViewState('conversation-a')
  const firstAttempt = pendingSendForDraft(state, 'Hello', createRequestId)
  state = conversationViewReducer(state, {
    type: 'sendStarted',
    conversationId: 'conversation-a',
    operationId: 1,
    pendingSend: firstAttempt,
  })
  state = conversationViewReducer(state, {
    type: 'sendFailed',
    conversationId: 'conversation-a',
    operationId: 1,
    error: { type: 'NETWORK_UNAVAILABLE' },
  })
  state = conversationViewReducer(state, {
    type: 'sendFinished',
    conversationId: 'conversation-a',
    operationId: 1,
  })

  const retry = pendingSendForDraft(state, 'Hello', createRequestId)
  assert.equal(retry.requestId, firstAttempt.requestId)
  assert.equal(requestSequence, 1)
})

test('confirmed-null business ends loading while genuine read failures stay classified', async () => {
  const source = await readFile(messagesPageUrl, 'utf8')

  assert.match(source, /if \(!loadedBusiness\) \{\s*dispatchConversation\(\{\s*type: 'businessUnavailable'/s)
  assert.match(
    source,
    /conversationLoadStatus === 'unavailable' \|\|[\s\S]*conversationLoadStatus === 'failed' \|\|[\s\S]*conversationLoadStatus === 'messages-failed'/,
  )
  assert.match(source, /t\('messages\.unavailable'\)/)
  assert.match(source, /t\('messages\.unavailableDescription'\)/)
  assert.match(source, /navigate\('\/messages'\)/)
  assert.match(
    source,
    /type: 'loadFailed',[\s\S]*classifyFrontendError\(loadError, \{[\s\S]*fallbackTranslationKey: 'messages\.errors\.openConversation'/,
  )
})

test('conversation route changes retain listener cleanup and operation guards', async () => {
  const source = await readFile(messagesPageUrl, 'utf8')

  assert.match(source, /return \(\) => \{\s*active = false\s*unsubscribe\(\)/s)
  assert.match(source, /if \(active\) \{\s*dispatchConversation\(\{\s*type: 'messagesLoaded'/s)
  assert.match(source, /activeSendOperationsRef\.current\.has\(conversationId\)/)
  assert.match(source, /activeSendOperationsRef\.current\.get\(conversationId\) === operationId/)
  assert.match(source, /selectConversationView\(conversationState, conversationId\)/)
})

test('frontend error boundary classifies messaging failures without exposing technical messages', () => {
  const fallback = { fallbackType: 'MESSAGE_SEND_FAILED' }
  const fixtures = [
    [null, 'MESSAGE_SEND_FAILED'],
    ['socket exploded', 'MESSAGE_SEND_FAILED'],
    [new Error('projects/demo/databases/(default)/documents/conversations/private-id'), 'MESSAGE_SEND_FAILED'],
    [{ code: 'functions/unauthenticated', message: 'Cloud Run internal service name' }, 'AUTH_SESSION_EXPIRED'],
    [{ code: 'firestore/permission-denied', message: 'users/private-user-id' }, 'PERMISSION_DENIED'],
    [{ code: 'functions/unavailable', message: 'upstream unavailable at private host' }, 'NETWORK_UNAVAILABLE'],
    [{ code: 'storage/unknown', message: 'gs://private-bucket/users/private-id' }, 'MESSAGE_SEND_FAILED'],
    [{ details: { reason: 'conversation-not-found' } }, 'MESSAGE_NOT_FOUND'],
    [{ reason: 'conversation-access-denied' }, 'PERMISSION_DENIED'],
    [{ message: 'message-text-too-long' }, 'MESSAGE_INVALID'],
    [{ message: 'message-request-id-conflict' }, 'MESSAGE_CONFLICT'],
  ]

  for (const [error, expectedType] of fixtures) {
    const result = classifyFrontendError(error, fallback)
    assert.equal(result.type, expectedType)
    assert.deepEqual(Object.keys(result).sort(), ['recovery', 'translationKey', 'type'])
    assert.doesNotMatch(JSON.stringify(result), /private|projects\/|gs:\/\/|Cloud Run|message-text-too-long|request-id/)
  }

  const controlled = createApplicationError('conversation-access-denied')
  assert.equal(classifyFrontendError(controlled).type, 'PERMISSION_DENIED')
  const inboxPermission = classifyFrontendError(
    { code: 'firestore/permission-denied', message: 'conversations/private-id' },
    {
      fallbackType: 'MESSAGE_LOAD_FAILED',
      fallbackTranslationKey: 'messages.errors.loadConversations',
      operation: 'load-inbox',
    },
  )
  assert.deepEqual(inboxPermission, {
    recovery: 'retry',
    translationKey: 'messages.errors.loadConversations',
    type: 'MESSAGE_LOAD_FAILED',
  })
})

test('messaging classifier keys resolve in every supported locale', async () => {
  const locales = ['es', 'fr', 'de', 'nl', 'pt', 'pl', 'ro', 'cs', 'sk', 'hu', 'uk', 'it', 'sv', 'da', 'fi', 'no']
  const keys = [
    'sessionExpired',
    'permissionDenied',
    'networkUnavailable',
    'notFound',
    'invalid',
    'conflict',
  ]
  const accessibilityKeys = ['customerFallback', 'messageHistory', 'you', 'sentBy']

  for (const locale of locales) {
    for (const key of keys) {
      const value = universalOperationalTranslations[locale]?.messages?.errors?.[key]
      assert.equal(typeof value, 'string', `${locale} messages.errors.${key}`)
      assert.ok(value.trim(), `${locale} messages.errors.${key}`)
    }
    for (const key of accessibilityKeys) {
      const value = universalOperationalTranslations[locale]?.messages?.[key]
      assert.equal(typeof value, 'string', `${locale} messages.${key}`)
      assert.ok(value.trim(), `${locale} messages.${key}`)
    }
  }

  const english = JSON.parse(await readFile(new URL('../src/i18n/locales/en.json', import.meta.url), 'utf8'))
  for (const key of keys) {
    assert.ok(english.messages.errors[key]?.trim(), `en messages.errors.${key}`)
  }
  for (const key of accessibilityKeys) {
    assert.ok(english.messages[key]?.trim(), `en messages.${key}`)
  }
})

test('messaging failure integration preserves retries, drafts, listeners, and removal state', async () => {
  const source = await readFile(messagesPageUrl, 'utf8')

  assert.equal((source.match(/classifyFrontendError\(/g) ?? []).length, 6)
  assert.match(source, /fallbackTranslationKey: 'messages\.errors\.loadConversations'/)
  assert.match(source, /fallbackTranslationKey: 'messages\.errors\.loadMessages'/)
  assert.match(source, /fallbackTranslationKey: 'messages\.errors\.openConversation'/)
  assert.match(source, /fallbackType: 'CONVERSATION_REMOVE_FAILED'/)
  assert.match(source, /return \(\) => \{\s*active = false\s*unsubscribe\(\)/s)
  assert.match(source, /type: 'itemRemoved',[\s\S]*navigate\('\/messages'/)
  assert.ok(
    source.indexOf("type: 'itemRemoved'") <
      source.indexOf('} catch (hideError)'),
  )
  assert.doesNotMatch(
    source.slice(source.indexOf('} catch (hideError)'), source.indexOf('} finally {', source.indexOf('} catch (hideError)'))),
    /type: 'itemRemoved'|navigate\(/,
  )
})

test('message history exposes sender identity through scoped log semantics', async () => {
  const source = await readFile(messagesPageUrl, 'utf8')

  assert.match(source, /role="log"/)
  assert.match(source, /aria-relevant="additions"/)
  assert.match(source, /aria-atomic="false"/)
  assert.match(source, /t\('messages\.messageHistory'\)/)
  assert.match(source, /messageSenderIdentity\(/)
  assert.match(source, /t\('messages\.sentBy', \{ name: senderName \}\)/)
  assert.match(source, /<li className=\{isOwn \? 'message-bubble is-own'/)
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
  const [service, stateHelper] = await Promise.all([
    readFile(serviceUrl, 'utf8'),
    readFile(messageStateUrl, 'utf8'),
  ])

  assert.match(service, /hasOwnerOnlyConversationParticipants/)
  assert.match(service, /isOwnerOnlyConversationForBusiness\(conversation, business\)/)
  assert.match(stateHelper, /hasOwnerOnlyConversationParticipants\(conversation, business\.ownerId\)/)
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
  assert.match(detailPanel, /t\('publicBusinessDetail\.messageBusiness'\)/)
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

test('production conversation queries use the trusted schema and matching indexes', async () => {
  const [service, rules, indexesText] = await Promise.all([
    readFile(serviceUrl, 'utf8'),
    readFile(rulesUrl, 'utf8'),
    readFile(indexesUrl, 'utf8'),
  ])
  const indexes = JSON.parse(indexesText).indexes

  assert.match(service, /conversationInboxQueryFilters\(userId\)/)
  assert.match(service, /existingConversationQueryFilters\(customerId, businessId\)/)
  assert.match(service, /schemaVersion: CONVERSATION_SCHEMA_VERSION/)
  assert.match(rules, /allow get: if hasActiveAccount\(\)/)
  assert.match(rules, /allow list: if hasActiveAccount\(\)/)
  assert.match(rules, /resource\.data\.schemaVersion == 1/)

  const conversationIndexes = indexes.filter(({ collectionGroup }) => collectionGroup === 'conversations')
  assert.equal(conversationIndexes.length, 2)
  assert.ok(conversationIndexes.some(({ fields }) => (
    fields.some(({ fieldPath, arrayConfig }) => fieldPath === 'participantIds' && arrayConfig === 'CONTAINS') &&
    fields.some(({ fieldPath }) => fieldPath === 'schemaVersion') &&
    fields.some(({ fieldPath }) => fieldPath === 'status')
  )))
  assert.ok(conversationIndexes.some(({ fields }) => (
    ['businessId', 'customerId', 'schemaVersion', 'status']
      .every((field) => fields.some(({ fieldPath }) => fieldPath === field))
  )))
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
