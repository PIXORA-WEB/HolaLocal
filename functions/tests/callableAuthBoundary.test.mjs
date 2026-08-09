import test from 'node:test'
import assert from 'node:assert/strict'
import {
  handleAcceptLegalConsent,
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
    () => handleAcceptLegalConsent({ data: { acceptTerms: true, acceptPrivacy: true } }, db),
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

test('legal consent handler rejects client-controlled identity version timestamp and profile fields', async () => {
  const db = forbiddenDb()
  for (const unexpected of [
    { uid: 'another-user' },
    { termsVersion: '999' },
    { privacyVersion: '999' },
    { termsAcceptedAt: 'client-time' },
    { role: 'admin' },
  ]) {
    await assert.rejects(
      () => handleAcceptLegalConsent({
        auth: { uid: 'user-1', token: { email: 'user@example.test', email_verified: true } },
        data: { acceptTerms: true, acceptPrivacy: true, ...unexpected },
      }, db),
      (error) => error.code === 'invalid-argument' && error.message === 'unexpected-request-field',
    )
  }
})

test('legal consent handler requires verified email before Firestore access', async () => {
  for (const token of [{ email_verified: false }, {}, { email_verified: 'true' }]) {
    await assert.rejects(
      () => handleAcceptLegalConsent({
        auth: { uid: 'user-1', token },
        data: { acceptTerms: true, acceptPrivacy: true },
      }, forbiddenDb()),
      (error) => error.code === 'failed-precondition' && error.message === 'email-verification-required',
    )
  }
})

test('legal consent handler accepts only the exact acknowledgement payload', async () => {
  const malformed = [null, undefined, [], 'yes', 1, true, false, {},
    { acceptTerms: true }, { acceptPrivacy: true },
    { acceptTerms: false, acceptPrivacy: true },
    { acceptTerms: true, acceptPrivacy: false },
    { acceptTerms: 1, acceptPrivacy: true },
    { acceptTerms: true, acceptPrivacy: 'true' },
    { acceptTerms: {}, acceptPrivacy: true },
    { acceptTerms: true, acceptPrivacy: true, nested: {} },
  ]
  for (const data of malformed) {
    await assert.rejects(
      () => handleAcceptLegalConsent({
        auth: { uid: 'user-1', token: { email_verified: true } }, data,
      }, forbiddenDb()),
      (error) => error.code === 'invalid-argument',
    )
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
