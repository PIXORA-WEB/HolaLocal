import test from 'node:test'
import assert from 'node:assert/strict'
import {
  handleEnsureOwnerBusiness,
  handleModerateBusiness,
  handleSendMessage,
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
    () => handleModerateBusiness({
      data: { businessId: 'business-1', operation: 'publish' },
    }, db),
  ]

  for (const run of cases) {
    await assert.rejects(run, (error) => codeFrom(error) === 'unauthenticated')
  }
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
})
