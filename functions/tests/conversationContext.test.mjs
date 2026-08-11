import test from 'node:test'
import assert from 'node:assert/strict'
import { Timestamp } from 'firebase-admin/firestore'
import { FakeFirestore } from './fakeFirestore.mjs'
import {
  buildCollisionSafeConversationId,
  getConversationBusinessContext,
  openBusinessConversation,
} from '../src/conversationContext.js'

function codeFrom(error) {
  return error?.code
}

function activeUser() {
  return { accountStatus: 'active', deletionRequestedAt: null }
}

function eligibleBusiness(overrides = {}) {
  return {
    ownerId: 'owner',
    managerIds: ['owner'],
    name: 'Safe Business',
    description: 'A complete public description.',
    status: 'active',
    publishedAt: new Date('2026-08-01T00:00:00.000Z'),
    deletedAt: null,
    deletionRequestedAt: null,
    primaryCategoryId: 'cleaning',
    categoryIds: ['cleaning'],
    serviceAreas: ['marbella'],
    languages: ['en'],
    primaryLanguage: 'en',
    location: { locality: 'Marbella', region: 'Málaga', countryCode: 'ES' },
    contact: {
      phone: '', phoneVisible: false, email: '', emailVisible: false,
      whatsappNumber: '', whatsappVisible: false, website: '', websiteVisible: false,
      preferredContactMethod: 'holalocal', allowCallbackRequests: false,
    },
    logoStoragePath: 'businesses/business-1/logos/logo',
    privateNote: 'never return',
    subscription: { planId: 'private-plan' },
    ...overrides,
  }
}

function conversation(overrides = {}) {
  return {
    businessId: 'business-1',
    customerId: 'customer',
    participantIds: ['customer', 'owner'],
    participantState: {
      customer: { lastReadAt: null, archivedAt: null, mutedUntil: null, deletedAt: null },
      owner: { lastReadAt: null, archivedAt: null, mutedUntil: null, deletedAt: null },
    },
    schemaVersion: 1,
    lastMessage: null,
    lastMessageAt: null,
    status: 'active',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  }
}

function contextDb({ business = eligibleBusiness(), storedConversation = conversation() } = {}) {
  const seed = {
    'users/customer': activeUser(),
    'users/owner': activeUser(),
    'users/other': activeUser(),
  }
  if (business !== null) seed['businesses/business-1'] = business
  if (storedConversation !== null) seed['conversations/customer__business-1'] = storedConversation
  return new FakeFirestore(seed)
}

test('openBusinessConversation creates the canonical conversation with a minimal snapshot', async () => {
  const db = contextDb({ storedConversation: null })
  const now = new Date('2026-08-08T10:00:00.000Z')
  const result = await openBusinessConversation({
    uid: 'customer', businessId: 'business-1', db, now: () => now,
  })

  assert.equal(result.conversationId, 'customer__business-1')
  assert.deepEqual(Object.keys(result.businessContext).sort(), [
    'availability', 'businessId', 'canSendMessages', 'logoStoragePath', 'logoUrl', 'name',
    'primaryLanguage', 'profileAvailable',
  ])
  assert.equal('ownerId' in result.businessContext, false)
  const stored = db.data('conversations/customer__business-1')
  assert.deepEqual(stored.businessSnapshot, {
    name: 'Safe Business',
    logoUrl: null,
    logoStoragePath: 'businesses/business-1/logos/logo',
    primaryLanguage: 'en',
  })
  assert.deepEqual(Object.keys(stored.businessSnapshot).sort(), ['logoStoragePath', 'logoUrl', 'name', 'primaryLanguage'])
  assert.equal(JSON.stringify(result).includes('privateNote'), false)
  assert.equal(JSON.stringify(result).includes('subscription'), false)
})

test('openBusinessConversation reuses and restores the deterministic existing conversation', async () => {
  const db = contextDb({
    storedConversation: conversation({
      participantState: {
        customer: { lastReadAt: null, archivedAt: new Date(), mutedUntil: null, deletedAt: new Date() },
        owner: { lastReadAt: null, archivedAt: null, mutedUntil: null, deletedAt: null },
      },
    }),
  })
  const result = await openBusinessConversation({ uid: 'customer', businessId: 'business-1', db })
  assert.equal(result.conversationId, 'customer__business-1')
  assert.equal(db.data('conversations/customer__business-1').participantState.customer.archivedAt, null)
  assert.equal(db.data('conversations/customer__business-1').participantState.customer.deletedAt, null)
})

test('terminal deleted-participant conversation cannot be reopened or duplicated', async () => {
  const deletedAt = Timestamp.fromMillis(1700000000000)
  const db = contextDb()
  Object.assign(db.store.get('conversations/customer__business-1'), {
    status: 'participant_deleted',
    participantTombstones: { customer: { type: 'deleted_user', deletedAt } },
  })
  const beforeWrites = db.writePaths.length
  await assert.rejects(
    () => openBusinessConversation({ uid: 'customer', businessId: 'business-1', db }),
    (error) => error.code === 'failed-precondition'
      && error.message === 'conversation-participant-deleted',
  )
  assert.equal(db.data('conversations/customer__business-1').status, 'participant_deleted')
  assert.equal(db.data('conversations/customer__business-1').participantTombstones.customer.type, 'deleted_user')
  assert.equal(db.data(buildCollisionSafeConversationId('customer', 'business-1')), undefined)
  assert.equal(db.writePaths.length, beforeWrites)
})

test('terminal context remains available to the surviving owner without a customer profile', async () => {
  const deletedAt = Timestamp.fromMillis(1700000000000)
  const db = contextDb()
  Object.assign(db.store.get('conversations/customer__business-1'), {
    status: 'participant_deleted',
    participantTombstones: { customer: { type: 'deleted_user', deletedAt } },
  })
  db.store.delete('users/customer')
  const result = await getConversationBusinessContext({
    uid: 'owner', conversationId: 'customer__business-1', db,
  })
  assert.equal(result.businessContext.canSendMessages, false)
  assert.equal(result.businessContext.name, 'Safe Business')
  assert.equal(JSON.stringify(result).includes('customer'), false)
})

test('collision-safe IDs are stable unambiguous and support Unicode and legacy delimiters', () => {
  const first = buildCollisionSafeConversationId('a__b', 'c')
  const second = buildCollisionSafeConversationId('a', 'b__c')
  assert.match(first, /^v2_[A-Za-z0-9_-]{43}$/)
  assert.notEqual(first, second)
  assert.equal(first, buildCollisionSafeConversationId('a__b', 'c'))
  assert.match(buildCollisionSafeConversationId('cústømér__一', 'negócio__二'), /^v2_[A-Za-z0-9_-]{43}$/)
})

test('openBusinessConversation resolves legacy collisions and always reuses an existing v2', async () => {
  const customerId = 'a'
  const businessId = 'b__c'
  const legacyId = 'a__b__c'
  const v2Id = buildCollisionSafeConversationId(customerId, businessId)
  const db = new FakeFirestore({
    [`users/${customerId}`]: activeUser(),
    [`businesses/${businessId}`]: eligibleBusiness(),
    [`conversations/${legacyId}`]: conversation({ customerId: 'a__b', businessId: 'c' }),
  })

  const created = await openBusinessConversation({ uid: customerId, businessId, db })
  assert.equal(created.conversationId, v2Id)
  assert.equal(db.data(`conversations/${v2Id}`).customerId, customerId)
  assert.equal(db.data(`conversations/${v2Id}`).businessId, businessId)

  db.store.delete(`conversations/${legacyId}`)
  const reused = await openBusinessConversation({ uid: customerId, businessId, db })
  assert.equal(reused.conversationId, v2Id)
  assert.equal(db.data(`conversations/${legacyId}`), undefined)
})

test('openBusinessConversation fails closed for conflicting or duplicate v2 integrity state', async () => {
  const v2Id = buildCollisionSafeConversationId('customer', 'business-1')
  const wrongV2 = contextDb({ storedConversation: null })
  wrongV2.store.set(`conversations/${v2Id}`, conversation({ businessId: 'different-business' }))
  await assert.rejects(
    () => openBusinessConversation({ uid: 'customer', businessId: 'business-1', db: wrongV2 }),
    (error) => codeFrom(error) === 'internal' && error.message === 'conversation-id-integrity-error',
  )

  const duplicate = contextDb()
  duplicate.store.set(`conversations/${v2Id}`, conversation())
  await assert.rejects(
    () => openBusinessConversation({ uid: 'customer', businessId: 'business-1', db: duplicate }),
    (error) => codeFrom(error) === 'failed-precondition'
      && error.message === 'conversation-duplicate-integrity-error',
  )
})

test('openBusinessConversation rejects anonymous invalid self and inactive-account requests', async () => {
  await assert.rejects(
    () => openBusinessConversation({ uid: '', businessId: 'business-1', db: contextDb() }),
    (error) => codeFrom(error) === 'unauthenticated',
  )
  await assert.rejects(
    () => openBusinessConversation({ uid: 'customer', businessId: '../bad', db: contextDb() }),
    (error) => codeFrom(error) === 'invalid-argument',
  )
  await assert.rejects(
    () => openBusinessConversation({
      uid: 'owner', businessId: 'business-1', db: new FakeFirestore({
        'users/owner': activeUser(), 'businesses/business-1': eligibleBusiness(),
      }),
    }),
    (error) => codeFrom(error) === 'failed-precondition',
  )
  const inactive = contextDb({ storedConversation: null })
  inactive.store.set('users/customer', { accountStatus: 'suspended' })
  await assert.rejects(
    () => openBusinessConversation({ uid: 'customer', businessId: 'business-1', db: inactive }),
    (error) => codeFrom(error) === 'failed-precondition',
  )
})

test('openBusinessConversation rejects every non-active lifecycle for a new conversation', async () => {
  for (const status of ['draft', 'pending_review', 'rejected', 'suspended', 'archived', 'deleted']) {
    const db = contextDb({ business: eligibleBusiness({ status }), storedConversation: null })
    await assert.rejects(
      () => openBusinessConversation({ uid: 'customer', businessId: 'business-1', db }),
      (error) => codeFrom(error) === 'failed-precondition',
      status,
    )
    assert.equal(db.data('conversations/customer__business-1'), undefined)
  }
})

test('participant context supports published and non-public lifecycle states without private fields', async () => {
  for (const status of ['active', 'pending_review', 'rejected', 'suspended', 'archived', 'deleted']) {
    const business = eligibleBusiness({
      status,
      ...(status === 'active' ? {} : { publishedAt: null }),
    })
    const result = await getConversationBusinessContext({
      uid: 'customer', conversationId: 'customer__business-1', db: contextDb({ business }),
    })
    assert.equal(result.businessContext.name, 'Safe Business')
    assert.equal(result.businessContext.canSendMessages, status === 'active')
    assert.equal(result.businessContext.profileAvailable, status === 'active')
    assert.equal('ownerId' in result.businessContext, false)
    assert.equal(JSON.stringify(result).includes('private-plan'), false)
  }

  const nonPublicActive = eligibleBusiness({ publishedAt: null })
  const result = await getConversationBusinessContext({
    uid: 'owner', conversationId: 'customer__business-1', db: contextDb({ business: nonPublicActive }),
  })
  assert.equal(result.businessContext.canSendMessages, true)
  assert.equal(result.businessContext.profileAvailable, false)
  assert.equal(result.businessContext.availability, 'profile_unavailable')
})

test('participant context denies anonymous nonparticipants malformed relationships and owner mismatch', async () => {
  await assert.rejects(
    () => getConversationBusinessContext({ uid: '', conversationId: 'customer__business-1', db: contextDb() }),
    (error) => codeFrom(error) === 'unauthenticated',
  )
  let unrelatedError
  await assert.rejects(
    () => getConversationBusinessContext({ uid: 'other', conversationId: 'customer__business-1', db: contextDb() }),
    (error) => {
      unrelatedError = error
      return codeFrom(error) === 'not-found' && error.message === 'conversation-not-found'
    },
  )
  await assert.rejects(
    () => getConversationBusinessContext({ uid: 'customer', conversationId: '../bad', db: contextDb() }),
    (error) => codeFrom(error) === 'invalid-argument',
  )
  await assert.rejects(
    () => getConversationBusinessContext({
      uid: 'customer', conversationId: 'customer__business-1',
      db: contextDb({ storedConversation: conversation({ participantIds: ['customer', 'other'] }) }),
    }),
    (error) => codeFrom(error) === 'failed-precondition',
  )
  await assert.rejects(
    () => getConversationBusinessContext({
      uid: 'customer', conversationId: 'customer__business-1',
      db: contextDb({ business: eligibleBusiness({ ownerId: 'different-owner' }) }),
    }),
    (error) => codeFrom(error) === 'failed-precondition',
  )

  let missingError
  await assert.rejects(
    () => getConversationBusinessContext({
      uid: 'other', conversationId: 'missing-conversation', db: contextDb(),
    }),
    (error) => {
      missingError = error
      return codeFrom(error) === 'not-found' && error.message === 'conversation-not-found'
    },
  )
  assert.deepEqual(
    { code: unrelatedError.code, message: unrelatedError.message, details: unrelatedError.details },
    { code: missingError.code, message: missingError.message, details: missingError.details },
  )
})

test('participant context handles missing conversations and snapshot/no-snapshot business fallbacks', async () => {
  await assert.rejects(
    () => getConversationBusinessContext({
      uid: 'customer', conversationId: 'customer__business-1',
      db: contextDb({ storedConversation: null }),
    }),
    (error) => codeFrom(error) === 'not-found',
  )

  const withSnapshot = await getConversationBusinessContext({
    uid: 'customer', conversationId: 'customer__business-1',
    db: contextDb({
      business: null,
      storedConversation: conversation({
        businessSnapshot: { name: 'Former Business', logoUrl: null, primaryLanguage: 'es' },
      }),
    }),
  })
  assert.equal(withSnapshot.businessContext.name, 'Former Business')
  assert.equal(withSnapshot.businessContext.canSendMessages, false)

  const unsafeSnapshot = await getConversationBusinessContext({
    uid: 'customer', conversationId: 'customer__business-1',
    db: contextDb({
      business: null,
      storedConversation: conversation({
        businessSnapshot: {
          name: 'Former Business',
          logoUrl: 'https://evil.example/logo.jpg',
          logoStoragePath: 'businesses/other/logos/logo',
          primaryLanguage: 'es',
        },
      }),
    }),
  })
  assert.equal(unsafeSnapshot.businessContext.logoUrl, null)
  assert.equal(unsafeSnapshot.businessContext.logoStoragePath, null)

  const withoutSnapshot = await getConversationBusinessContext({
    uid: 'customer', conversationId: 'customer__business-1',
    db: contextDb({ business: null }),
  })
  assert.equal(withoutSnapshot.businessContext.name, 'Business unavailable')
  assert.equal(withoutSnapshot.businessContext.availability, 'conversation_closed')
})
