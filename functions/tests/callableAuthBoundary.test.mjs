import test from 'node:test'
import assert from 'node:assert/strict'
import {
  handleEnsureOwnerBusiness,
  handleAssignBusinessSubscriptionPlan,
  handleGetOwnerSubscriptionStatus,
  handleGetPublicBusiness,
  handleGetConversationBusinessContext,
  handleModerateBusiness,
  handleSendMessage,
  handleOpenBusinessConversation,
  handleUpdateAccountRole,
} from '../src/index.js'

function codeFrom(error) {
  return error?.code
}

function forbiddenDb() {
  return {
    doc() {
      throw new Error('Firestore doc() must not be called before authentication and authorization checks.')
    },
    collection() {
      throw new Error('Firestore collection() must not be called before authentication and authorization checks.')
    },
    runTransaction() {
      throw new Error('Firestore transaction must not be called before authentication and authorization checks.')
    },
  }
}

test('unauthenticated callable handlers reject before Firestore access', async () => {
  const db = forbiddenDb()
  const cases = [
    () => handleUpdateAccountRole({ data: { accountType: 'customer' } }, db),
    () => handleEnsureOwnerBusiness({ data: {} }, db),
    () => handleSendMessage({
      data: { conversationId: 'conversation-1', requestId: 'request-123', text: 'Hello' },
    }, db),
    () => handleOpenBusinessConversation({ data: { businessId: 'business-1' } }, db),
    () => handleGetConversationBusinessContext({ data: { conversationId: 'conversation-1' } }, db),
    () => handleModerateBusiness({
      data: { businessId: 'business-1', operation: 'publish' },
    }, db),
    () => handleAssignBusinessSubscriptionPlan({ data: {} }, db),
  ]

  for (const run of cases) {
    await assert.rejects(run, (error) => codeFrom(error) === 'unauthenticated')
  }
})

test('public detail and owner subscription handlers reject malformed or expanded payloads', async () => {
  const db = forbiddenDb()
  for (const data of [null, [], { businessId: 'business-1', unexpected: true }]) {
    await assert.rejects(
      () => handleGetPublicBusiness({ data }, db),
      (error) => codeFrom(error) === 'invalid-argument',
    )
    await assert.rejects(
      () => handleGetOwnerSubscriptionStatus({ auth: { uid: 'owner-1', token: {} }, data }, db),
      (error) => codeFrom(error) === 'invalid-argument',
    )
  }
})

test('owner subscription handler still authenticates before payload or Firestore handling', async () => {
  await assert.rejects(
    () => handleGetOwnerSubscriptionStatus({ data: { businessId: 'business-1' } }, forbiddenDb()),
    (error) => codeFrom(error) === 'unauthenticated',
  )
})

test('conversation handlers authenticate before payload validation and reject expanded payloads', async () => {
  const db = forbiddenDb()
  await assert.rejects(
    () => handleOpenBusinessConversation({ data: { businessId: 'business-1' } }, db),
    (error) => codeFrom(error) === 'unauthenticated',
  )
  await assert.rejects(
    () => handleGetConversationBusinessContext({ data: { conversationId: 'conversation-1' } }, db),
    (error) => codeFrom(error) === 'unauthenticated',
  )
  await assert.rejects(
    () => handleOpenBusinessConversation({
      auth: { uid: 'customer', token: {} },
      data: { businessId: 'business-1', ownerId: 'must-not-be-accepted' },
    }, db),
    (error) => codeFrom(error) === 'invalid-argument',
  )
  await assert.rejects(
    () => handleGetConversationBusinessContext({
      auth: { uid: 'customer', token: {} },
      data: { conversationId: 'conversation-1', businessId: 'unexpected' },
    }, db),
    (error) => codeFrom(error) === 'invalid-argument',
  )
})

test('callable handlers reject required authorization failures before Firestore access where possible', async () => {
  const db = forbiddenDb()
  await assert.rejects(() => handleUpdateAccountRole({
    auth: { uid: 'user-1', token: { email_verified: false } },
    data: { accountType: 'customer' },
  }, db), (error) => codeFrom(error) === 'failed-precondition')

  await assert.rejects(() => handleEnsureOwnerBusiness({
    auth: { uid: 'owner-1', token: { email_verified: false } },
    data: {},
  }, db), (error) => codeFrom(error) === 'failed-precondition')

  await assert.rejects(() => handleModerateBusiness({
    auth: { uid: 'user-1', token: {} },
    data: { businessId: 'business-1', operation: 'publish' },
  }, db), (error) => codeFrom(error) === 'permission-denied')

  await assert.rejects(() => handleAssignBusinessSubscriptionPlan({
    auth: { uid: 'moderator-1', token: { moderator: true } },
    data: {
      businessId: 'business-1', planId: 'pro', reason: 'A valid reason.',
      requestId: 'assignment_request_auth', expectedAssignmentVersion: 0,
    },
  }, db), (error) => codeFrom(error) === 'permission-denied')
})
