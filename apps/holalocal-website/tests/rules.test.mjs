import { after, before, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import {
  collection, deleteDoc, doc, documentId, FieldPath, getCountFromServer, getDoc, getDocs,
  limit, orderBy, query, serverTimestamp, setDoc, Timestamp, updateDoc, where,
  writeBatch,
} from 'firebase/firestore'
import { deleteObject, getBytes, listAll, ref, uploadBytes } from 'firebase/storage'
import {
  buildConversationId,
  conversationInboxQueryFilters,
  CONVERSATION_SCHEMA_VERSION,
  existingConversationQueryFilters,
} from '@holalocal/firebase-contract'
import { buildRegistrationProfile } from '../../holalocal-app/src/services/userPayloads.js'
import { buildCanonicalBusinessUpdate } from '../../holalocal-app/src/services/businessPayloads.js'

const projectId = 'demo-holalocal-rules'
const activeContact = {
  phone: '', phoneVisible: false, email: '', emailVisible: false,
  whatsappNumber: '', whatsappVisible: false, website: '', websiteVisible: false,
  preferredContactMethod: 'holalocal', allowCallbackRequests: false,
}
const users = {
  customer: user('customer', { roles: ['customer'] }),
  both: user('both', {
    roles: ['customer', 'business'],
    accountType: 'both',
    onboardingCompleted: true,
    profileCompleted: true,
  }),
  owner: user('owner', { roles: ['business'], accountType: 'business', onboardingCompleted: true, profileCompleted: true }),
  manager: user('manager', { roles: ['business'], accountType: 'business', onboardingCompleted: true, profileCompleted: true }),
  'other-owner': user('other-owner', { roles: ['business'], accountType: 'business', onboardingCompleted: true, profileCompleted: true }),
  unrelated: user('unrelated', { roles: ['customer'] }),
  suspended: user('suspended', { roles: ['customer'], accountStatus: 'suspended' }),
  deleted: user('deleted', { roles: ['customer'], accountStatus: 'deleted' }),
  'deletion-pending': user('deletion-pending', { deletionRequestedAt: serverTimestamp() }),
  moderator: user('moderator'),
  admin: user('admin'),
}
let environment

function user(uid, overrides = {}) {
  return {
    uid,
    email: `${uid}@example.invalid`,
    displayName: uid,
    displayNameNormalized: uid,
    firstName: uid,
    lastName: 'User',
    photoURL: null,
    profilePhoto: null,
    preferredLocale: 'en',
    accountType: 'customer',
    roles: ['customer'],
    city: 'Marbella',
    country: 'Spain',
    accountStatus: 'active',
    profileCompleted: false,
    onboardingCompleted: false,
    businessProfileRequired: false,
    businessProfileCompleted: false,
    businessId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
    termsAccepted: true,
    termsAcceptedAt: serverTimestamp(),
    termsVersion: '1.0',
    privacyAccepted: true,
    privacyAcceptedAt: serverTimestamp(),
    privacyVersion: '1.0',
    deletionRequestedAt: null,
    deletionScheduledFor: null,
    anonymizedAt: null,
    ...overrides,
  }
}

function business(overrides = {}) {
  return {
    ownerId: 'owner',
    managerIds: ['owner', 'manager'],
    name: 'Active business',
    nameNormalized: 'active business',
    slug: 'active-business',
    tagline: 'Trusted local help',
    description: 'A complete public business profile.',
    primaryCategoryId: 'Cleaning',
    categoryIds: ['Cleaning'],
    serviceAreas: ['marbella'],
    serviceRadiusKm: 20,
    location: { locality: 'Marbella', region: 'Málaga', countryCode: 'ES' },
    contact: activeContact,
    languages: ['en', 'es'],
    primaryLanguage: 'en',
    profilePhoto: null,
    galleryImageURLs: [],
    galleryImages: [],
    galleryCount: 0,
    ratingAverage: 0,
    ratingCount: 0,
    status: 'active',
    verificationStatus: 'unverified',
    verifiedAt: null,
    subscription: { tier: 'free', status: 'none', provider: null, currentPeriodEnd: null },
    profileCompleted: false,
    publishedAt: serverTimestamp(),
    submittedAt: serverTimestamp(),
    deletionRequestedAt: null,
    deletedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  }
}

async function seed() {
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore()
    await Promise.all(Object.entries(users).map(([id, user]) => setDoc(doc(database, 'users', id), user)))
    await setDoc(doc(database, 'accountDeletionRequests', 'deletion-pending'), {
      uid: 'deletion-pending', state: 'requested', requestedAt: serverTimestamp(),
      requestedBy: 'deletion-pending', cancelledAt: null, updatedAt: serverTimestamp(),
      requestVersion: 1,
    })
    await setDoc(doc(database, 'businesses', 'active-business'), business({
      logoStoragePath: 'businesses/active-business/logos/logo',
      galleryStoragePaths: ['businesses/active-business/photos/0'],
    }))
    await setDoc(doc(database, 'businesses', 'draft-business'), business({
      managerIds: ['owner'],
      status: 'draft',
      name: 'Draft business',
      nameNormalized: 'draft business',
      slug: 'draft-business',
      publishedAt: null,
      submittedAt: null,
    }))
    for (const status of ['pending_review', 'rejected', 'suspended', 'archived', 'deleted']) {
      await setDoc(doc(database, 'businesses', `${status}-business`), business({
        managerIds: ['owner'],
        status,
        name: `${status} business`,
        nameNormalized: `${status} business`,
        slug: `${status}-business`,
        publishedAt: null,
        submittedAt: status === 'pending_review' ? serverTimestamp() : null,
      }))
    }
    await setDoc(doc(database, 'businesses', 'active-with-deletedAt-business'), business({
      managerIds: ['owner'],
      name: 'Deleted active business',
      deletedAt: serverTimestamp(),
    }))
    await setDoc(doc(database, 'businesses', 'active-with-deletion-request-business'), business({
      managerIds: ['owner'],
      name: 'Deletion requested active business',
      deletionRequestedAt: serverTimestamp(),
    }))
    await setDoc(doc(database, 'businesses', 'incomplete-active-business'), business({
      managerIds: ['owner'],
      name: 'Incomplete active business',
      description: '',
    }))
    await setDoc(doc(database, 'businesses', 'active-without-publishedAt-business'), business({
      managerIds: ['owner'],
      name: 'Unpublished active business',
      publishedAt: null,
    }))
    await setDoc(doc(database, 'businesses', 'unsafe-active-business'), business({
      managerIds: ['owner'],
      name: 'Unsafe legacy business',
      contact: { ...activeContact, email: 'hidden@example.test', emailVisible: false },
    }))
    await setDoc(doc(database, 'businesses', 'unsafe-website-business'), business({
      managerIds: ['owner'],
      name: 'Unsafe website business',
      contact: { ...activeContact, website: 'https://example.invalid', websiteVisible: false },
    }))
    await setDoc(doc(database, 'businesses', 'owner'), {
      ownerId: 'owner', businessName: 'Legacy mobile business', mainCategory: 'Cleaning',
      isActive: true, isVerified: false, isPremium: false, subscriptionTier: 'free',
    })
    await setDoc(doc(database, 'businesses', 'manager'), business({
      ownerId: 'manager',
      managerIds: ['manager'],
      status: 'draft',
      name: 'UID canonical business',
      publishedAt: null,
      submittedAt: null,
    }))
    for (const ownerId of ['suspended', 'deleted', 'deletion-pending']) {
      await setDoc(doc(database, 'businesses', `${ownerId}-owner-business`), business({
        ownerId,
        managerIds: [ownerId],
        status: 'draft',
        name: `${ownerId} owner business`,
        publishedAt: null,
        submittedAt: null,
      }))
    }
    await setDoc(doc(database, 'businesses', 'canonical-draft-business'), business({
      managerIds: ['owner'],
      status: 'draft',
      name: 'Canonical media draft',
      publishedAt: null,
      submittedAt: null,
      logoStoragePath: 'businesses/canonical-draft-business/logos/logo',
      galleryStoragePaths: [
        'businesses/canonical-draft-business/photos/7',
        'businesses/canonical-draft-business/photos/0',
        'businesses/canonical-draft-business/photos/6',
        'businesses/canonical-draft-business/photos/1',
        'businesses/canonical-draft-business/photos/5',
        'businesses/canonical-draft-business/photos/2',
        'businesses/canonical-draft-business/photos/4',
        'businesses/canonical-draft-business/photos/3',
      ],
    }))
    await setDoc(doc(database, 'businessPrivate', 'active-business'), {
      ownerId: 'owner', managerIds: ['owner', 'manager'],
      contact: { ...activeContact, email: 'private@example.test' },
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
    await setDoc(doc(database, 'businessSubscriptions', 'active-business'), {
      schemaVersion: 1, businessId: 'active-business', planId: 'pro', planRevision: 1,
      accessStatus: 'active', assignmentSource: 'admin', assignmentVersion: 1,
      updatedBy: 'admin', assignedAt: serverTimestamp(), startsAt: serverTimestamp(),
      endsAt: null, updatedAt: serverTimestamp(),
    })
    await setDoc(doc(database, 'businessSubscriptions', 'active-business', 'assignmentEvents', 'request_123456789'), {
      requestId: 'request_123456789', adminUid: 'admin', reason: 'Private audit reason',
    })
  })
}

function conversation(overrides = {}) {
  const customerId = overrides.customerId ?? 'customer'
  const businessId = overrides.businessId ?? 'active-business'
  const ownerId = overrides.ownerId ?? 'owner'
  return {
    businessId, customerId, participantIds: [customerId, ownerId],
    participantState: {
      [customerId]: { lastReadAt: null, archivedAt: null, mutedUntil: null, deletedAt: null },
      [ownerId]: { lastReadAt: null, archivedAt: null, mutedUntil: null, deletedAt: null },
    },
    lastMessage: null, lastMessageAt: null, status: 'active',
    schemaVersion: CONVERSATION_SCHEMA_VERSION,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    ...overrides,
  }
}

function message(overrides = {}) {
  return {
    senderId: 'customer',
    type: 'text',
    text: 'Hello',
    attachment: null,
    moderationStatus: 'visible',
    editedAt: null,
    deletedAt: null,
    createdAt: serverTimestamp(),
    ...overrides,
  }
}

function freshTimestamp(offsetMillis = 0) {
  return Timestamp.fromMillis(Date.now() + offsetMillis)
}

function canonicalConversationId(customerId = 'customer', businessId = 'active-business') {
  return buildConversationId(customerId, businessId)
}

async function createConversation(id = canonicalConversationId(), payload = conversation()) {
  const database = environment.authenticatedContext('customer').firestore()
  await assertSucceeds(setDoc(doc(database, 'conversations', id), payload))
}

async function seedConversationWithoutRules(id, payload = conversation()) {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'conversations', id), payload)
  })
}

function inboxQuery(database, userId) {
  return query(
    collection(database, 'conversations'),
    ...conversationInboxQueryFilters(userId).map((constraint) => where(...constraint)),
  )
}

function existingConversationQuery(database, customerId, businessId) {
  return query(
    collection(database, 'conversations'),
    ...existingConversationQueryFilters(customerId, businessId).map((constraint) => where(...constraint)),
  )
}

async function assertQuerySucceeds(label, queryPromise) {
  try {
    return await assertSucceeds(queryPromise)
  } catch (error) {
    throw new Error(`${label}: ${error.message}`, { cause: error })
  }
}

async function atomicMessagePreviewWrite({
  conversationId = canonicalConversationId(),
  messageId = 'message',
  messageData = message(),
  lastMessage = null,
  userId = 'customer',
} = {}) {
  const database = environment.authenticatedContext(userId).firestore()
  const batch = writeBatch(database)
  batch.set(doc(database, `conversations/${conversationId}/messages`, messageId), messageData)
  batch.update(doc(database, 'conversations', conversationId), {
    lastMessage: lastMessage ?? {
      messageId,
      senderId: messageData.senderId,
      type: messageData.type,
      preview: messageData.text,
      createdAt: messageData.createdAt,
    },
    lastMessageAt: messageData.createdAt,
    updatedAt: serverTimestamp(),
  })
  return batch.commit()
}

async function seedMessageWithoutRules(conversationId, messageId, messageData = message()) {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `conversations/${conversationId}/messages`, messageId), messageData)
  })
}

async function seedStorageWithoutRules(path, data = new Uint8Array([137, 80, 78, 71]), metadata = { contentType: 'image/png' }) {
  await environment.withSecurityRulesDisabled(async (context) => {
    await uploadBytes(ref(context.storage(), path), data, metadata)
  })
}

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile('../../firestore.rules', 'utf8') },
    storage: { rules: await readFile('../../storage.rules', 'utf8') },
  })
})
beforeEach(async () => {
  await Promise.all([environment.clearFirestore(), environment.clearStorage()])
  await seed()
})
after(async () => { await environment.cleanup() })

test('reviewed transitional variant has one explicit mechanical release switch', async () => {
  const strictRules = await readFile('../../storage.rules', 'utf8')
  const transitionalRules = strictRules.replace(
    /function allowTransitionalCanonicalWrites\(\) \{\s*return false;\s*\}/,
    'function allowTransitionalCanonicalWrites() { return true; }',
  )
  assert.notEqual(transitionalRules, strictRules)
  assert.equal((strictRules.match(/allowTransitionalCanonicalWrites\(\)/g) ?? []).length, 7)
  assert.match(transitionalRules, /function allowTransitionalCanonicalWrites\(\) \{ return true; \}/)
  assert.match(transitionalRules, /match \/users\/\{userId\}\/staging\/profile\/avatar/)
  assert.match(transitionalRules, /match \/businesses\/\{businessId\}\/staging\/photos\/\{slot\}/)
  const transitional = await initializeTestEnvironment({
    projectId: `${projectId}-transitional`,
    firestore: { rules: await readFile('../../firestore.rules', 'utf8') },
    storage: { rules: transitionalRules },
  })
  try {
    // The emulator runs in single-project mode, so Storage Rules cross-service
    // Firestore lookups resolve against the configured project even while the
    // alternate project carries the transitional Storage ruleset.
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', 'transition-owner'), user('transition-owner', {
        roles: ['business'], accountType: 'business', profileCompleted: true,
      }))
      await setDoc(doc(context.firestore(), 'businesses', 'transition-business'), business({
        ownerId: 'transition-owner', managerIds: ['transition-owner'], status: 'draft',
      }))
    })
    await transitional.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', 'transition-owner'), user('transition-owner', {
        roles: ['business'], accountType: 'business', profileCompleted: true,
      }))
      await setDoc(doc(context.firestore(), 'businesses', 'transition-business'), business({
        ownerId: 'transition-owner', managerIds: ['transition-owner'], status: 'draft',
      }))
    })
    const storage = transitional.authenticatedContext('transition-owner').storage()
    await assertSucceeds(uploadBytes(ref(storage, 'businesses/transition-business/logos/logo'),
      new Uint8Array([1]), { contentType: 'image/png' }))
    await assertSucceeds(uploadBytes(ref(storage, 'businesses/transition-business/staging/logos/logo'),
      new Uint8Array([1]), { contentType: 'image/png',
        customMetadata: { holalocalUploadSession: 'request-12345678' } }))
    await assertFails(uploadBytes(ref(storage, 'businesses/transition-business/logos/logo/a'),
      new Uint8Array([1]), { contentType: 'image/png' }))
  } finally {
    await transitional.cleanup()
    const restoredStrict = await initializeTestEnvironment({
      projectId,
      storage: { rules: strictRules },
    })
    await restoredStrict.cleanup()
  }
})

describe('users and account lifecycle', () => {
  function mobilePayload(uid, overrides = {}) {
    return {
      ...buildRegistrationProfile(uid, {
        email: `${uid}@example.invalid`, preferredLocale: 'es',
        termsAccepted: true, termsVersion: '1.0',
        privacyAccepted: true, privacyVersion: '1.0',
      }, serverTimestamp),
      ...overrides,
    }
  }

  test('current mobile registration builder is accepted without leaking a password', async () => {
    const database = environment.authenticatedContext('mobile-valid').firestore()
    const reference = doc(database, 'users', 'mobile-valid')
    await assertSucceeds(setDoc(reference, mobilePayload('mobile-valid')))
    const created = (await getDoc(reference)).data()
    assert.equal(created.preferredLocale, 'es')
    assert.equal(Object.hasOwn(created, 'password'), false)
  })

  test('mobile registration rejects missing consent and incorrect policy versions', async () => {
    for (const [uid, changes] of [
      ['mobile-no-terms', { termsAccepted: false, termsAcceptedAt: null }],
      ['mobile-no-privacy', { privacyAccepted: false, privacyAcceptedAt: null }],
      ['mobile-wrong-version', { termsVersion: '0.9' }],
    ]) {
      await assertFails(setDoc(
        doc(environment.authenticatedContext(uid).firestore(), 'users', uid),
        mobilePayload(uid, changes),
      ))
    }
  })

  test('mobile registration rejects invalid roles, trusted lifecycle changes, and legacy payloads', async () => {
    await assertFails(setDoc(
      doc(environment.authenticatedContext('mobile-admin').firestore(), 'users', 'mobile-admin'),
      mobilePayload('mobile-admin', { roles: ['admin'] }),
    ))
    await assertFails(setDoc(
      doc(environment.authenticatedContext('mobile-suspended').firestore(), 'users', 'mobile-suspended'),
      mobilePayload('mobile-suspended', { accountStatus: 'suspended' }),
    ))
    await assertFails(setDoc(
      doc(environment.authenticatedContext('mobile-legacy').firestore(), 'users', 'mobile-legacy'),
      {
        uid: 'mobile-legacy', email: 'legacy@example.invalid', preferredLanguage: 'English',
        accountType: 'customer', roles: ['customer'], isVerified: false,
        isPremium: false, deletedAt: null, createdAt: serverTimestamp(),
      },
    ))
  })

  test('owner reads own profile and unrelated users cannot', async () => {
    await assertSucceeds(getDoc(doc(environment.authenticatedContext('customer').firestore(), 'users', 'customer')))
    await assertFails(getDoc(doc(environment.authenticatedContext('unrelated').firestore(), 'users', 'customer')))
    await assertFails(getDoc(doc(environment.authenticatedContext('admin', { admin: true }).firestore(), 'users', 'customer')))
  })
  test('users cannot grant themselves privileged roles', async () => {
    await assertFails(updateDoc(doc(environment.authenticatedContext('customer').firestore(), 'users', 'customer'), { roles: ['customer', 'admin'] }))
    await assertFails(updateDoc(doc(environment.authenticatedContext('customer').firestore(), 'users', 'customer'), {
      roles: ['business'],
      accountType: 'business',
      updatedAt: serverTimestamp(),
    }))
  })
  test('users cannot change their trusted business pointer', async () => {
    await assertFails(updateDoc(doc(environment.authenticatedContext('customer').firestore(), 'users', 'customer'), {
      businessId: 'active-business',
      updatedAt: serverTimestamp(),
    }))
  })
  test('deletion workflow is owner-readable and backend-write-only', async () => {
    const own = environment.authenticatedContext('deletion-pending').firestore()
    const other = environment.authenticatedContext('unrelated').firestore()
    await assertSucceeds(getDoc(doc(own, 'accountDeletionRequests', 'deletion-pending')))
    await assertFails(getDoc(doc(other, 'accountDeletionRequests', 'deletion-pending')))
    await assertFails(getDocs(collection(own, 'accountDeletionRequests')))
    await assertFails(setDoc(doc(other, 'accountDeletionRequests', 'unrelated'), {
      uid: 'unrelated', state: 'requested', requestedAt: serverTimestamp(),
    }))
    await assertFails(updateDoc(doc(own, 'accountDeletionRequests', 'deletion-pending'), { state: 'cancelled' }))
  })
  test('generic profile writes cannot fabricate or clear deletion lifecycle state', async () => {
    await assertFails(updateDoc(doc(environment.authenticatedContext('customer').firestore(), 'users', 'customer'), {
      deletionRequestedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }))
    await assertFails(updateDoc(doc(environment.authenticatedContext('customer').firestore(), 'users', 'customer'), {
      accountStatus: 'deletion_pending', updatedAt: serverTimestamp(),
    }))
    await assertFails(updateDoc(doc(environment.authenticatedContext('deletion-pending').firestore(), 'users', 'deletion-pending'), {
      deletionRequestedAt: null, updatedAt: serverTimestamp(),
    }))
  })
  test('valid customer profile update succeeds with validated completion', async () => {
    await assertSucceeds(updateDoc(doc(environment.authenticatedContext('customer').firestore(), 'users', 'customer'), {
      firstName: 'Casey',
      lastName: 'Customer',
      displayName: 'Casey Customer',
      displayNameNormalized: 'casey customer',
      preferredLocale: 'es',
      city: 'Marbella',
      country: 'Spain',
      profileCompleted: true,
      updatedAt: serverTimestamp(),
    }))
  })
  test('owner can establish only the exact minimal canonical profile-media representation', async () => {
    const reference = doc(environment.authenticatedContext('customer').firestore(), 'users', 'customer')
    await assertSucceeds(updateDoc(reference, {
      photoURL: null,
      profilePhoto: { storagePath: 'users/customer/profile/avatar' },
      updatedAt: serverTimestamp(),
    }))
    for (const profilePhoto of [
      { storagePath: 'users/unrelated/profile/avatar' },
      { storagePath: 'users/customer/profile/custom.png' },
      { storagePath: 'https://example.invalid/avatar.png' },
      { storagePath: 'users/customer/profile/avatar', originalName: 'avatar.png' },
      { storagePath: 'users/customer/profile/avatar', downloadUrl: 'https://example.invalid/avatar.png' },
    ]) {
      await assertFails(updateDoc(reference, {
        photoURL: null,
        profilePhoto,
        updatedAt: serverTimestamp(),
      }))
    }
    await assertFails(updateDoc(reference, {
      photoURL: 'https://example.invalid/avatar.png',
      profilePhoto: null,
      updatedAt: serverTimestamp(),
    }))
  })
  test('profile media may remain unchanged, be cleared, and survives ordinary profile edits', async () => {
    const legacy = {
      contentType: 'image/png',
      downloadUrl: 'https://firebasestorage.googleapis.com/legacy-token',
      originalName: 'legacy.png',
      size: 123,
      storagePath: 'users/customer/profile/legacy.png',
    }
    await environment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'users', 'customer'), {
        photoURL: legacy.downloadUrl,
        profilePhoto: legacy,
      })
    })
    const reference = doc(environment.authenticatedContext('customer').firestore(), 'users', 'customer')
    await assertSucceeds(updateDoc(reference, {
      city: 'Estepona',
      updatedAt: serverTimestamp(),
    }))
    let profile = (await getDoc(reference)).data()
    assert.deepEqual(profile.profilePhoto, legacy)
    assert.equal(profile.photoURL, legacy.downloadUrl)
    await assertFails(updateDoc(reference, {
      profilePhoto: { ...legacy, originalName: 'fabricated.png' },
      updatedAt: serverTimestamp(),
    }))
    await assertSucceeds(updateDoc(reference, {
      photoURL: null,
      profilePhoto: null,
      updatedAt: serverTimestamp(),
    }))
    profile = (await getDoc(reference)).data()
    assert.equal(profile.profilePhoto, null)
    assert.equal(profile.photoURL, null)
  })
  test('callable-created consent profile can complete normally without changing consent', async () => {
    const uid = 'consent-recovery'
    const acceptedAt = Timestamp.fromMillis(1_700_000_000_000)
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', uid), {
        uid, email: `${uid}@example.invalid`, displayName: '', displayNameNormalized: '',
        firstName: '', lastName: '', photoURL: null, profilePhoto: null,
        accountType: 'customer', roles: ['customer'], accountStatus: 'active',
        profileCompleted: false, onboardingCompleted: false,
        businessProfileRequired: false, businessProfileCompleted: false, businessId: null,
        createdAt: acceptedAt, updatedAt: acceptedAt, lastActiveAt: acceptedAt,
        deletionRequestedAt: null, deletionScheduledFor: null, anonymizedAt: null,
        termsAccepted: true, termsAcceptedAt: acceptedAt, termsVersion: '1.0',
        privacyAccepted: true, privacyAcceptedAt: acceptedAt, privacyVersion: '1.0',
      })
    })
    const reference = doc(environment.authenticatedContext(uid).firestore(), 'users', uid)
    await assertSucceeds(updateDoc(reference, {
      firstName: 'Consent', lastName: 'Recovery', displayName: 'Consent Recovery',
      displayNameNormalized: 'consent recovery', preferredLocale: 'en',
      city: 'Marbella', country: 'Spain', profileCompleted: true,
      updatedAt: serverTimestamp(),
    }))
    const completed = (await getDoc(reference)).data()
    assert.equal(completed.profileCompleted, true)
    assert.equal(completed.termsAcceptedAt.toMillis(), acceptedAt.toMillis())
    assert.equal(completed.privacyAcceptedAt.toMillis(), acceptedAt.toMillis())
    await assertFails(updateDoc(reference, {
      termsAcceptedAt: serverTimestamp(), privacyAcceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }))
  })
  test('completed users cannot clear required profile fields while retaining completion', async () => {
    await assertFails(updateDoc(doc(environment.authenticatedContext('owner').firestore(), 'users', 'owner'), {
      city: '',
      updatedAt: serverTimestamp(),
    }))
    await assertSucceeds(updateDoc(doc(environment.authenticatedContext('owner').firestore(), 'users', 'owner'), {
      city: '',
      profileCompleted: false,
      updatedAt: serverTimestamp(),
    }))
  })
  test('blocked and deletion-pending accounts cannot perform protected writes', async () => {
    for (const id of ['suspended', 'deleted', 'deletion-pending']) {
      await assertFails(setDoc(doc(environment.authenticatedContext(id).firestore(), 'reports', `report-${id}`), { reporterId: id }))
    }
  })
})

describe('business documents', () => {
  function mobileBusinessPayload(overrides = {}) {
    const built = buildCanonicalBusinessUpdate({
      name: 'Updated business', tagline: 'Synthetic tagline', description: 'Synthetic description',
      primaryCategoryId: 'Cleaning', categoryIds: ['Cleaning'],
      serviceAreas: ['marbella'], serviceRadiusKm: 20,
      location: { locality: 'Marbella', region: 'Málaga', countryCode: 'ES' },
      languages: ['en', 'es'], primaryLanguage: 'en',
      ...overrides,
    })
    assert.equal(built.valid, true)
    return { ...built.payload, updatedAt: serverTimestamp() }
  }

  test('mobile edit builder emits the exact supported canonical owner payload', () => {
    const payload = mobileBusinessPayload({
      ownerId: 'untrusted', managerIds: ['untrusted'], status: 'active',
      verificationStatus: 'verified', subscription: { status: 'active' },
      ratingAverage: 5, ratingCount: 10, galleryCount: 99,
      slug: 'forbidden', nameNormalized: 'forbidden',
      publishedAt: serverTimestamp(), verifiedAt: serverTimestamp(),
      businessName: 'Legacy name', mainCategory: 'Legacy category',
      subcategories: ['Legacy'], phone: '000000000',
      email: 'private@example.invalid', whatsapp: '111111111',
      website: 'https://example.invalid', unknown: 'ignored',
      profileCompleted: true,
    })
    assert.deepEqual(Object.keys(payload).sort(), [
      'categoryIds', 'description', 'languages', 'location', 'name', 'primaryCategoryId',
      'primaryLanguage', 'serviceAreas', 'serviceRadiusKm', 'tagline', 'updatedAt',
    ])
  })

  test('canonical mobile edit succeeds for auto-ID and UID-ID businesses', async () => {
    await assertSucceeds(updateDoc(
      doc(environment.authenticatedContext('owner').firestore(), 'businesses', 'draft-business'),
      mobileBusinessPayload(),
    ))
    await assertSucceeds(updateDoc(
      doc(environment.authenticatedContext('manager').firestore(), 'businesses', 'manager'),
      mobileBusinessPayload({ name: 'UID business updated' }),
    ))
  })

  test('legacy mobile business update payload remains rejected', async () => {
    await assertFails(updateDoc(
      doc(environment.authenticatedContext('owner').firestore(), 'businesses', 'owner'),
      { businessName: 'Changed legacy name', updatedAt: serverTimestamp() },
    ))
  })
  test('raw business documents are never public', async () => {
    await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), 'businesses', 'active-business')))
    await assertFails(getDoc(doc(environment.authenticatedContext('customer').firestore(), 'businesses', 'active-business')))
    await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), 'businesses', 'draft-business')))
    await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), 'businesses', 'unsafe-active-business')))
    await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), 'businesses', 'unsafe-website-business')))
  })
  test('private subscriptions and assignment history deny every client role', async () => {
    const contexts = [
      environment.unauthenticatedContext(),
      environment.authenticatedContext('customer'),
      environment.authenticatedContext('owner'),
      environment.authenticatedContext('manager'),
      environment.authenticatedContext('moderator', { moderator: true }),
      environment.authenticatedContext('admin', { admin: true }),
    ]
    for (const context of contexts) {
      const database = context.firestore()
      const subscription = doc(database, 'businessSubscriptions', 'active-business')
      const event = doc(database, 'businessSubscriptions', 'active-business', 'assignmentEvents', 'request_123456789')
      await assertFails(getDoc(subscription))
      await assertFails(getDoc(event))
      await assertFails(updateDoc(subscription, { planId: 'starter' }))
      await assertFails(setDoc(event, { requestId: 'different' }))
    }
  })
  test('website visibility follows the same public-contact invariant as other channels', async () => {
    const reference = doc(environment.authenticatedContext('owner').firestore(), 'businesses', 'draft-business')
    await assertSucceeds(updateDoc(reference, {
      contact: { ...activeContact, website: 'https://example.invalid', websiteVisible: true },
      updatedAt: serverTimestamp(),
    }))
    await assertFails(updateDoc(reference, {
      contact: { ...activeContact, website: 'https://example.invalid', websiteVisible: false },
      updatedAt: serverTimestamp(),
    }))
    await assertFails(updateDoc(reference, {
      contact: { ...activeContact, phone: '000000000', phoneVisible: false },
      updatedAt: serverTimestamp(),
    }))
    await assertFails(updateDoc(reference, {
      contact: { ...activeContact, email: 'hidden@example.invalid', emailVisible: false },
      updatedAt: serverTimestamp(),
    }))
    await assertFails(updateDoc(reference, {
      contact: { ...activeContact, whatsappNumber: '111111111', whatsappVisible: false },
      updatedAt: serverTimestamp(),
    }))
    await assertFails(updateDoc(
      doc(environment.authenticatedContext('owner').firestore(), 'businesses', 'unsafe-website-business'),
      { contact: { ...activeContact, website: '', websiteVisible: false }, updatedAt: serverTimestamp() },
    ))
  })
  test('owner and manager can edit editable lifecycle states while unrelated users cannot', async () => {
    await assertSucceeds(updateDoc(doc(environment.authenticatedContext('owner').firestore(), 'businesses', 'draft-business'), { tagline: 'Owner edit', updatedAt: serverTimestamp() }))
    await assertSucceeds(updateDoc(doc(environment.authenticatedContext('manager').firestore(), 'businesses', 'manager'), { tagline: 'Manager edit', updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(environment.authenticatedContext('unrelated').firestore(), 'businesses', 'active-business'), { tagline: 'No access', updatedAt: serverTimestamp() }))
  })
  test('valid server-established canonical media survives ordinary draft edits', async () => {
    const reference = doc(
      environment.authenticatedContext('owner').firestore(),
      'businesses',
      'canonical-draft-business',
    )
    await assertSucceeds(updateDoc(reference, {
      tagline: 'Canonical manifest preserved',
      updatedAt: serverTimestamp(),
    }))
    const updated = (await getDoc(reference)).data()
    assert.equal(updated.logoStoragePath, 'businesses/canonical-draft-business/logos/logo')
    assert.deepEqual(updated.galleryStoragePaths, [
      'businesses/canonical-draft-business/photos/7',
      'businesses/canonical-draft-business/photos/0',
      'businesses/canonical-draft-business/photos/6',
      'businesses/canonical-draft-business/photos/1',
      'businesses/canonical-draft-business/photos/5',
      'businesses/canonical-draft-business/photos/2',
      'businesses/canonical-draft-business/photos/4',
      'businesses/canonical-draft-business/photos/3',
    ])
  })
  test('browser clients cannot establish or mutate canonical business media manifests', async () => {
    const draft = doc(environment.authenticatedContext('owner').firestore(), 'businesses', 'draft-business')
    for (const update of [
      { logoStoragePath: 'businesses/draft-business/logos/logo' },
      { logoStoragePath: 'businesses/other-business/logos/logo' },
      { logoStoragePath: 'https://example.invalid/logo.png' },
      { galleryStoragePaths: ['businesses/draft-business/photos/0'] },
      { galleryStoragePaths: ['businesses/other-business/photos/0'] },
      { galleryStoragePaths: ['businesses/draft-business/photos/8'] },
      { galleryStoragePaths: ['businesses/draft-business/photos/0', 'businesses/draft-business/photos/0'] },
      { galleryStoragePaths: ['businesses/draft-business/photos/../logos/logo'] },
      { galleryStoragePaths: ['https://example.invalid/photo.png'] },
    ]) {
      await assertFails(updateDoc(draft, { ...update, updatedAt: serverTimestamp() }))
    }
  })
  test('malformed server-established canonical media blocks subsequent owner writes', async () => {
    const malformedCases = [
      (businessId) => ({ logoStoragePath: 'businesses/wrong/logos/logo' }),
      (businessId) => ({ logoStoragePath: `businesses/${businessId}/logos/custom.png` }),
      (businessId) => ({ galleryStoragePaths: [`businesses/${businessId}/photos/8`] }),
      (businessId) => ({ galleryStoragePaths: [
        `businesses/${businessId}/photos/0`,
        `businesses/${businessId}/photos/0`,
      ] }),
      (businessId) => ({ galleryStoragePaths: ['https://example.invalid/photo.png'] }),
    ]
    for (const [index, buildMedia] of malformedCases.entries()) {
      const businessId = `malformed-media-business-${index}`
      await environment.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'businesses', businessId), business({
          managerIds: ['owner'],
          status: 'draft',
          name: 'Malformed canonical media',
          publishedAt: null,
          submittedAt: null,
          ...buildMedia(businessId),
        }))
      })
      await assertFails(updateDoc(
        doc(environment.authenticatedContext('owner').firestore(), 'businesses', businessId),
        { tagline: 'Must remain blocked', updatedAt: serverTimestamp() },
      ))
    }
  })
  test('legacy website media fields remain writable in editable states during transition', async () => {
    const reference = doc(environment.authenticatedContext('owner').firestore(), 'businesses', 'draft-business')
    const legacyLogo = {
      contentType: 'image/png',
      downloadUrl: 'https://firebasestorage.googleapis.com/legacy-logo',
      originalName: 'legacy-logo.png',
      size: 123,
      storagePath: 'businesses/draft-business/logos/legacy-logo.png',
    }
    const legacyGallery = [{ ...legacyLogo, storagePath: 'businesses/draft-business/photos/legacy-photo.png' }]
    await assertSucceeds(updateDoc(reference, {
      profilePhoto: legacyLogo,
      galleryImages: legacyGallery,
      galleryImageURLs: [legacyGallery[0].downloadUrl],
      updatedAt: serverTimestamp(),
    }))
  })
  test('owners and managers cannot edit active suspended archived or deleted businesses', async () => {
    for (const businessId of ['active-business', 'suspended-business', 'archived-business', 'deleted-business']) {
      await assertFails(updateDoc(
        doc(environment.authenticatedContext('owner').firestore(), 'businesses', businessId),
        { tagline: 'Lifecycle edit denied', updatedAt: serverTimestamp() },
      ))
    }
  })
  test('first business creation is backend-only for owner and manager clients', async () => {
    await assertFails(setDoc(
      doc(environment.authenticatedContext('owner').firestore(), 'businesses', 'owner-new'),
      business({
        ownerId: 'owner',
        managerIds: ['owner'],
        status: 'draft',
        name: '',
        nameNormalized: '',
        slug: '',
        tagline: '',
        description: '',
        primaryCategoryId: '',
        categoryIds: [],
        serviceAreas: [],
        publishedAt: null,
        submittedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    ))
    await assertFails(setDoc(
      doc(environment.authenticatedContext('manager').firestore(), 'businesses', 'manager-owned'),
      business({
        ownerId: 'manager',
        managerIds: ['manager'],
        status: 'draft',
        publishedAt: null,
        submittedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    ))
  })
  test('owners cannot change trusted business fields', async () => {
    const reference = doc(environment.authenticatedContext('owner').firestore(), 'businesses', 'active-business')
    for (const update of [
      { ownerId: 'unrelated' }, { managerIds: ['owner'] },
      { status: 'suspended' }, { verificationStatus: 'verified' },
      { subscription: { status: 'active', tier: 'paid' } },
      { ratingAverage: 5 }, { ratingCount: 10 },
      { publishedAt: serverTimestamp() }, { verifiedAt: serverTimestamp() },
      { businessName: 'Legacy name' }, { mainCategory: 'Cleaning' },
      { subcategories: ['Cleaning'] }, { phone: '000000000' },
      { email: 'private@example.invalid' }, { whatsapp: '111111111' },
    ]) await assertFails(updateDoc(reference, update))
    await assertFails(updateDoc(
      doc(environment.authenticatedContext('manager').firestore(), 'businesses', 'manager'),
      { status: 'active' },
    ))
  })
  test('clients cannot write derived compatibility fields and the mobile builder excludes them', async () => {
    const reference = doc(environment.authenticatedContext('owner').firestore(), 'businesses', 'active-business')
    await assertFails(updateDoc(reference, { galleryCount: 99, updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(reference, { profileCompleted: true, updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(reference, { slug: 'rule-gap', nameNormalized: 'rule gap', updatedAt: serverTimestamp() }))
    const payload = mobileBusinessPayload()
    for (const field of ['galleryCount', 'profileCompleted', 'slug', 'nameNormalized']) {
      assert.equal(Object.hasOwn(payload, field), false, field)
    }
  })
  test('clients cannot inject unknown or legacy public contact fields', async () => {
    const reference = doc(environment.authenticatedContext('owner').firestore(), 'businesses', 'active-business')
    await assertFails(updateDoc(reference, { unknownFutureField: true, updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(reference, { phone: '000000000', updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(reference, { whatsappNumber: '111111111', updatedAt: serverTimestamp() }))
  })
  test('valid draft edit and submit-for-review transition succeeds', async () => {
    const reference = doc(environment.authenticatedContext('owner').firestore(), 'businesses', 'draft-business')
    await assertSucceeds(updateDoc(reference, {
      tagline: 'Ready for review',
      updatedAt: serverTimestamp(),
    }))
    await assertSucceeds(updateDoc(reference, {
      status: 'pending_review',
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }))
  })
  test('manager can submit eligible draft and rejected business can be resubmitted', async () => {
    await assertSucceeds(updateDoc(doc(environment.authenticatedContext('manager').firestore(), 'businesses', 'manager'), {
      status: 'pending_review',
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }))
    await assertSucceeds(updateDoc(doc(environment.authenticatedContext('owner').firestore(), 'businesses', 'rejected-business'), {
      tagline: 'Updated after rejection',
      updatedAt: serverTimestamp(),
    }))
    await assertSucceeds(updateDoc(doc(environment.authenticatedContext('owner').firestore(), 'businesses', 'rejected-business'), {
      status: 'pending_review',
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }))
  })
  test('invalid owner resubmission and manager self-publication fail', async () => {
    await assertFails(updateDoc(doc(environment.authenticatedContext('owner').firestore(), 'businesses', 'incomplete-active-business'), {
      status: 'pending_review',
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }))
    await assertFails(updateDoc(doc(environment.authenticatedContext('manager').firestore(), 'businesses', 'manager'), {
      status: 'active',
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }))
  })
  test('owners cannot self-publish or change moderation fields', async () => {
    const reference = doc(environment.authenticatedContext('owner').firestore(), 'businesses', 'pending_review-business')
    await assertFails(updateDoc(reference, {
      status: 'active',
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }))
    await assertFails(updateDoc(reference, {
      verificationStatus: 'verified',
      verifiedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }))
  })
  test('moderators cannot bypass the callable to publish eligible submitted businesses', async () => {
    const moderator = environment.authenticatedContext('moderator', { moderator: true }).firestore()
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', 'moderator'), user('moderator', { roles: ['customer'] }))
    })
    await assertFails(updateDoc(doc(moderator, 'businesses', 'pending_review-business'), {
      status: 'active',
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }))
    await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), 'businesses', 'pending_review-business')))
  })
  test('moderators and admins cannot bypass lifecycle, allowlists or ownership invariants', async () => {
    const moderator = environment.authenticatedContext('moderator', { moderator: true }).firestore()
    const admin = environment.authenticatedContext('admin', { admin: true }).firestore()
    await assertFails(updateDoc(doc(moderator, 'businesses', 'active-business'), {
      status: 'draft',
      updatedAt: serverTimestamp(),
    }))
    await assertFails(updateDoc(doc(moderator, 'businesses', 'deleted-business'), {
      status: 'active',
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }))
    await assertFails(updateDoc(doc(moderator, 'businesses', 'pending_review-business'), {
      status: 'active',
      unknownFutureField: true,
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }))
    await assertFails(updateDoc(doc(moderator, 'businesses', 'pending_review-business'), {
      ownerId: 'moderator',
      status: 'active',
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }))
    await assertFails(updateDoc(doc(admin, 'businesses', 'pending_review-business'), {
      status: 'active',
      businessName: 'Legacy injection',
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }))
  })
  test('all moderator lifecycle writes are restricted to trusted backend code', async () => {
    const moderator = environment.authenticatedContext('moderator', { moderator: true }).firestore()
    await assertFails(updateDoc(doc(moderator, 'businesses', 'incomplete-active-business'), {
      status: 'active',
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }))
    await assertFails(updateDoc(doc(moderator, 'businesses', 'active-without-publishedAt-business'), {
      status: 'active',
      updatedAt: serverTimestamp(),
    }))
    await assertFails(updateDoc(doc(moderator, 'businesses', 'active-business'), {
      status: 'suspended',
      updatedAt: serverTimestamp(),
    }))
    await assertFails(updateDoc(doc(moderator, 'businesses', 'suspended-business'), {
      status: 'active',
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }))
  })
  test('moderator queue and bounded count queries require trusted claims', async () => {
    const moderator = environment.authenticatedContext('moderator', { moderator: true }).firestore()
    const pendingQueue = (database) => query(
      collection(database, 'businesses'),
      where('status', '==', 'pending_review'),
      orderBy('submittedAt', 'desc'),
      orderBy(documentId(), 'desc'),
      limit(24),
    )
    const pendingCount = (database) => query(
      collection(database, 'businesses'),
      where('status', '==', 'pending_review'),
    )
    await assertSucceeds(getDocs(pendingQueue(moderator)))
    await assertSucceeds(getCountFromServer(pendingCount(moderator)))
    const owner = environment.authenticatedContext('owner').firestore()
    await assertFails(getDocs(pendingQueue(owner)))
    await assertFails(getCountFromServer(pendingCount(owner)))
  })
  test('unpublished and malformed businesses are excluded from public reads', async () => {
    const publicDatabase = environment.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(publicDatabase, 'businesses', 'draft-business')))
    await assertFails(getDoc(doc(publicDatabase, 'businesses', 'pending_review-business')))
    await assertFails(getDoc(doc(publicDatabase, 'businesses', 'rejected-business')))
    await assertFails(getDoc(doc(publicDatabase, 'businesses', 'unsafe-active-business')))
    await assertFails(getDoc(doc(publicDatabase, 'businesses', 'unsafe-website-business')))
    await assertFails(getDoc(doc(publicDatabase, 'businesses', 'active-with-deletedAt-business')))
    await assertFails(getDoc(doc(publicDatabase, 'businesses', 'active-with-deletion-request-business')))
    await assertFails(getDoc(doc(publicDatabase, 'businesses', 'incomplete-active-business')))
    await assertFails(getDoc(doc(publicDatabase, 'businesses', 'active-without-publishedAt-business')))
  })
  test('businessPrivate is restricted to managers', async () => {
    await assertSucceeds(getDoc(doc(environment.authenticatedContext('owner').firestore(), 'businessPrivate', 'active-business')))
    await assertFails(getDoc(doc(environment.authenticatedContext('unrelated').firestore(), 'businessPrivate', 'active-business')))
  })
  test('moderation events are moderator-only and do not inherit public parent access', async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'businesses', 'active-business', 'moderationEvents', 'event-1'), {
        businessId: 'active-business',
        action: 'publish',
        previousStatus: 'pending_review',
        newStatus: 'active',
        moderatorUid: 'moderator',
        reasonCode: null,
        guidance: null,
        requestId: 'event-1',
        schemaVersion: 1,
        createdAt: serverTimestamp(),
      })
    })
    const eventPath = ['businesses', 'active-business', 'moderationEvents', 'event-1']
    await assertSucceeds(getDoc(doc(environment.authenticatedContext('moderator', { moderator: true }).firestore(), ...eventPath)))
    await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), ...eventPath)))
    await assertFails(getDoc(doc(environment.authenticatedContext('owner').firestore(), ...eventPath)))
    await assertFails(setDoc(doc(environment.authenticatedContext('moderator', { moderator: true }).firestore(), 'businesses', 'active-business', 'moderationEvents', 'event-2'), {
      action: 'publish',
    }))
  })
  test('owner resubmission clears only current rejection feedback in the same batch', async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'businessPrivate', 'rejected-business'), {
        ownerId: 'owner',
        managerIds: ['owner', 'manager'],
        contact: activeContact,
        currentRejection: {
          reasonCode: 'other',
          guidance: 'Please revise the profile before resubmitting it.',
          moderationEventId: 'rejection-event',
          createdAt: serverTimestamp(),
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      await setDoc(doc(context.firestore(), 'businesses', 'rejected-business', 'moderationEvents', 'rejection-event'), {
        action: 'reject',
        createdAt: serverTimestamp(),
      })
    })
    const owner = environment.authenticatedContext('owner').firestore()
    const batch = writeBatch(owner)
    batch.update(doc(owner, 'businesses', 'rejected-business'), {
      status: 'pending_review',
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    batch.update(doc(owner, 'businessPrivate', 'rejected-business'), {
      currentRejection: null,
      updatedAt: serverTimestamp(),
    })
    await assertSucceeds(batch.commit())
    assert.equal((await getDoc(doc(owner, 'businessPrivate', 'rejected-business'))).data().currentRejection, null)
    await assertFails(getDoc(doc(owner, 'businesses', 'rejected-business', 'moderationEvents', 'rejection-event')))
    await assertFails(updateDoc(doc(owner, 'businessPrivate', 'rejected-business'), {
      currentRejection: { reasonCode: 'other', guidance: 'Owner injected guidance.' },
      updatedAt: serverTimestamp(),
    }))
  })
})

describe('conversations and messages', () => {
  test('surviving participant retains terminal history and only personal read state remains writable', async () => {
    const conversationId = 'v2_deleted-participant-history'
    await seedConversationWithoutRules(conversationId, conversation({
      status: 'participant_deleted',
      participantTombstones: {
        customer: { type: 'deleted_user', deletedAt: Timestamp.now() },
      },
    }))
    await seedMessageWithoutRules(conversationId, 'historic-message')
    await environment.withSecurityRulesDisabled(async (context) => {
      const database = context.firestore()
      await setDoc(doc(database, 'users', 'same-email-new-uid'), user('same-email-new-uid', {
        email: users.customer.email,
      }))
      await deleteDoc(doc(database, 'users', 'customer'))
    })

    const owner = environment.authenticatedContext('owner').firestore()
    const unrelated = environment.authenticatedContext('unrelated').firestore()
    const replacement = environment.authenticatedContext('same-email-new-uid').firestore()
    const anonymous = environment.unauthenticatedContext().firestore()
    const reference = doc(owner, 'conversations', conversationId)

    await assertSucceeds(getDoc(reference))
    await assertSucceeds(getDoc(doc(owner, `conversations/${conversationId}/messages`, 'historic-message')))
    const inbox = await assertSucceeds(getDocs(inboxQuery(owner, 'owner')))
    assert.deepEqual(inbox.docs.map(({ id }) => id), [conversationId])
    await assertFails(getDoc(doc(unrelated, 'conversations', conversationId)))
    await assertFails(getDoc(doc(replacement, 'conversations', conversationId)))
    await assertFails(getDoc(doc(anonymous, 'conversations', conversationId)))
    await assertFails(getDoc(doc(unrelated, `conversations/${conversationId}/messages`, 'historic-message')))
    await assertFails(getDoc(doc(replacement, `conversations/${conversationId}/messages`, 'historic-message')))

    await assertSucceeds(updateDoc(
      reference,
      new FieldPath('participantState', 'owner', 'lastReadAt'), serverTimestamp(),
      'updatedAt', serverTimestamp(),
    ))
    await assertFails(updateDoc(reference, { status: 'active', updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(reference, { participantIds: ['owner', 'unrelated'], updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(reference, { customerId: 'unrelated', updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(reference, { participantTombstones: {}, updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(reference, {
      participantTombstones: {
        customer: { type: 'deleted_user', deletedAt: Timestamp.now(), name: 'forged' },
      },
      updatedAt: serverTimestamp(),
    }))

    await assertFails(setDoc(doc(owner, `conversations/${conversationId}/messages`, 'new-message'), message({
      senderId: 'owner', text: 'Must remain terminal',
    })))
  })

  test('clients cannot fabricate participant deletion or tombstones on active conversations', async () => {
    const conversationId = canonicalConversationId()
    await createConversation(conversationId)
    const owner = environment.authenticatedContext('owner').firestore()
    await assertFails(updateDoc(doc(owner, 'conversations', conversationId), {
      status: 'participant_deleted',
      participantTombstones: {
        customer: { type: 'deleted_user', deletedAt: serverTimestamp() },
      },
      updatedAt: serverTimestamp(),
    }))
  })

  test('server-created v2 conversations with snapshots preserve participant-only access', async () => {
    const conversationId = 'v2_rules-safe-conversation'
    const payload = conversation({
      businessSnapshot: {
        name: 'Active business',
        logoUrl: null,
        primaryLanguage: 'en',
      },
    })
    await seedConversationWithoutRules(conversationId, payload)
    await seedMessageWithoutRules(conversationId, 'history-message')

    const customer = environment.authenticatedContext('customer').firestore()
    const owner = environment.authenticatedContext('owner').firestore()
    const unrelated = environment.authenticatedContext('unrelated').firestore()
    await assertSucceeds(getDoc(doc(customer, 'conversations', conversationId)))
    await assertSucceeds(getDoc(doc(owner, 'conversations', conversationId)))
    await assertFails(getDoc(doc(unrelated, 'conversations', conversationId)))
    await assertSucceeds(getDoc(doc(customer, `conversations/${conversationId}/messages`, 'history-message')))
    await assertSucceeds(getDoc(doc(owner, `conversations/${conversationId}/messages`, 'history-message')))
    await assertFails(getDoc(doc(unrelated, `conversations/${conversationId}/messages`, 'history-message')))

    const customerInbox = await assertSucceeds(getDocs(inboxQuery(customer, 'customer')))
    assert.deepEqual(customerInbox.docs.map(({ id }) => id), [conversationId])
    const existingPair = await assertSucceeds(getDocs(existingConversationQuery(
      customer,
      'customer',
      'active-business',
    )))
    assert.deepEqual(existingPair.docs.map(({ id }) => id), [conversationId])

    const customerReference = doc(customer, 'conversations', conversationId)
    await assertSucceeds(updateDoc(
      customerReference,
      new FieldPath('participantState', 'customer', 'archivedAt'),
      serverTimestamp(),
      'updatedAt',
      serverTimestamp(),
    ))
    await assertFails(updateDoc(
      customerReference,
      new FieldPath('participantState', 'customer', 'archivedAt'),
      null,
      'businessSnapshot',
      { name: 'Forged business', logoUrl: null, primaryLanguage: 'en' },
      'updatedAt',
      serverTimestamp(),
    ))
    await assertFails(setDoc(
      doc(environment.authenticatedContext('customer').firestore(), 'conversations', 'v2_client-created'),
      payload,
    ))

    const legacyId = canonicalConversationId('customer', 'active-business')
    await seedConversationWithoutRules(legacyId, conversation())
    await assertSucceeds(getDoc(doc(customer, 'conversations', legacyId)))
  })
  test('valid customer-to-business conversation succeeds', async () => {
    const database = environment.authenticatedContext('customer').firestore()
    const conversationId = canonicalConversationId()
    await assertSucceeds(setDoc(doc(database, 'conversations', conversationId), conversation()))
    await assertFails(setDoc(doc(database, `conversations/${conversationId}/messages`, 'message'), message()))
    await seedMessageWithoutRules(conversationId, 'message')
    await assertSucceeds(getDoc(doc(environment.authenticatedContext('owner').firestore(), 'conversations', conversationId)))
    await assertSucceeds(getDoc(doc(environment.authenticatedContext('owner').firestore(), `conversations/${conversationId}/messages`, 'message')))
    await assertFails(setDoc(
      doc(environment.authenticatedContext('owner').firestore(), `conversations/${conversationId}/messages`, 'owner-reply'),
      message({ senderId: 'owner', text: 'Owner reply' }),
    ))
  })
  test('production inbox queries list valid conversations only for active participants', async () => {
    await createConversation()

    const customerSnapshot = await assertQuerySucceeds('customer legacy-safe inbox query', getDocs(inboxQuery(
      environment.authenticatedContext('customer').firestore(),
      'customer',
    )))
    const ownerSnapshot = await assertSucceeds(getDocs(inboxQuery(
      environment.authenticatedContext('owner').firestore(),
      'owner',
    )))
    const unrelatedSnapshot = await assertSucceeds(getDocs(inboxQuery(
      environment.authenticatedContext('unrelated').firestore(),
      'unrelated',
    )))

    assert.deepEqual(customerSnapshot.docs.map(({ id }) => id), [canonicalConversationId()])
    assert.deepEqual(ownerSnapshot.docs.map(({ id }) => id), [canonicalConversationId()])
    assert.equal(unrelatedSnapshot.empty, true)
    await assertFails(getDocs(inboxQuery(
      environment.authenticatedContext('unrelated').firestore(),
      'customer',
    )))
    await assertFails(getDocs(inboxQuery(
      environment.authenticatedContext('suspended').firestore(),
      'suspended',
    )))
  })
  test('both-role customers can list conversations without gaining manager access', async () => {
    const conversationId = canonicalConversationId('both')
    const database = environment.authenticatedContext('both').firestore()
    await assertSucceeds(setDoc(
      doc(database, 'conversations', conversationId),
      conversation({ customerId: 'both' }),
    ))

    const bothSnapshot = await assertSucceeds(getDocs(inboxQuery(database, 'both')))
    assert.deepEqual(bothSnapshot.docs.map(({ id }) => id), [conversationId])
    const managerSnapshot = await assertQuerySucceeds('manager legacy-safe inbox query', getDocs(inboxQuery(
      environment.authenticatedContext('manager').firestore(),
      'manager',
    )))
    assert.equal(managerSnapshot.empty, true)
  })
  test('production existing-conversation query is scoped to the authenticated customer and business', async () => {
    await createConversation()

    const customerDatabase = environment.authenticatedContext('customer').firestore()
    const snapshot = await assertSucceeds(getDocs(existingConversationQuery(
      customerDatabase,
      'customer',
      'active-business',
    )))
    assert.deepEqual(snapshot.docs.map(({ id }) => id), [canonicalConversationId()])

    await assertFails(getDocs(existingConversationQuery(
      environment.authenticatedContext('unrelated').firestore(),
      'customer',
      'active-business',
    )))
    const unrelatedSnapshot = await assertSucceeds(getDocs(existingConversationQuery(
      environment.authenticatedContext('unrelated').firestore(),
      'unrelated',
      'active-business',
    )))
    assert.equal(unrelatedSnapshot.empty, true)
  })
  test('untrusted legacy and malformed conversations are excluded from production list queries', async () => {
    await createConversation()
    const managerConversation = {
      ...conversation({ ownerId: 'manager' }),
      participantIds: ['customer', 'manager'],
      participantState: {
        customer: { lastReadAt: null, archivedAt: null, mutedUntil: null, deletedAt: null },
        manager: { lastReadAt: null, archivedAt: null, mutedUntil: null, deletedAt: null },
      },
    }
    const ownerMismatchConversation = {
      ...conversation({ ownerId: 'other-owner' }),
      participantIds: ['customer', 'other-owner'],
      participantState: {
        customer: { lastReadAt: null, archivedAt: null, mutedUntil: null, deletedAt: null },
        'other-owner': { lastReadAt: null, archivedAt: null, mutedUntil: null, deletedAt: null },
      },
    }
    delete managerConversation.schemaVersion
    delete ownerMismatchConversation.schemaVersion
    await seedConversationWithoutRules('legacy-manager-participant', managerConversation)
    await seedConversationWithoutRules('legacy-owner-mismatch', ownerMismatchConversation)

    const customerSnapshot = await assertSucceeds(getDocs(inboxQuery(
      environment.authenticatedContext('customer').firestore(),
      'customer',
    )))
    assert.deepEqual(customerSnapshot.docs.map(({ id }) => id), [canonicalConversationId()])
    const managerSnapshot = await assertSucceeds(getDocs(inboxQuery(
      environment.authenticatedContext('manager').firestore(),
      'manager',
    )))
    assert.equal(managerSnapshot.empty, true)
    const otherOwnerSnapshot = await assertQuerySucceeds('other-owner legacy-safe inbox query', getDocs(inboxQuery(
      environment.authenticatedContext('other-owner').firestore(),
      'other-owner',
    )))
    assert.equal(otherOwnerSnapshot.empty, true)
  })
  test('new conversations must use the deterministic customer and business identity', async () => {
    const database = environment.authenticatedContext('customer').firestore()
    await assertFails(setDoc(doc(database, 'conversations', 'random-id'), conversation()))
    await assertFails(setDoc(doc(database, 'conversations', canonicalConversationId('unrelated', 'active-business')), {
      ...conversation(),
      customerId: 'unrelated',
      participantIds: ['unrelated', 'owner'],
      participantState: {
        unrelated: { lastReadAt: null, archivedAt: null, mutedUntil: null, deletedAt: null },
        owner: { lastReadAt: null, archivedAt: null, mutedUntil: null, deletedAt: null },
      },
    }))
  })
  test('inactive businesses and self-owned businesses cannot start conversations', async () => {
    const database = environment.authenticatedContext('customer').firestore()
    for (const businessId of [
      'draft-business', 'pending_review-business', 'rejected-business', 'suspended-business',
      'archived-business', 'deleted-business', 'active-with-deletedAt-business',
      'active-with-deletion-request-business', 'incomplete-active-business',
      'active-without-publishedAt-business', 'unsafe-active-business',
    ]) {
      await assertFails(setDoc(
        doc(database, 'conversations', canonicalConversationId('customer', businessId)),
        conversation({ businessId }),
      ))
    }
    await assertFails(setDoc(
      doc(environment.authenticatedContext('owner').firestore(), 'conversations', canonicalConversationId('owner', 'active-business')),
      conversation({
        customerId: 'owner',
        participantIds: ['owner'],
        participantState: { owner: { lastReadAt: null, archivedAt: null, mutedUntil: null, deletedAt: null } },
      }),
    ))
  })
  test('arbitrary participant injection is rejected', async () => {
    await assertFails(setDoc(doc(environment.authenticatedContext('customer').firestore(), 'conversations', canonicalConversationId()), {
      ...conversation(), participantIds: ['customer', 'owner', 'unrelated'],
    }))
    await assertFails(setDoc(doc(environment.authenticatedContext('customer').firestore(), 'conversations', canonicalConversationId()), {
      ...conversation({ ownerId: 'manager' }),
      participantIds: ['customer', 'manager'],
    }))
    await assertFails(setDoc(doc(environment.authenticatedContext('customer').firestore(), 'conversations', canonicalConversationId()), {
      ...conversation({ ownerId: 'other-owner' }),
      participantIds: ['customer', 'other-owner'],
    }))
  })
  test('non-members cannot read or write and protected fields cannot change', async () => {
    const conversationId = canonicalConversationId()
    await assertSucceeds(setDoc(doc(environment.authenticatedContext('customer').firestore(), 'conversations', conversationId), conversation()))
    const unrelated = environment.authenticatedContext('unrelated').firestore()
    await assertFails(getDoc(doc(unrelated, 'conversations', conversationId)))
    await assertFails(getDoc(doc(environment.authenticatedContext('manager').firestore(), 'conversations', conversationId)))
    await assertFails(getDoc(doc(environment.authenticatedContext('other-owner').firestore(), 'conversations', conversationId)))
    await assertFails(setDoc(doc(unrelated, `conversations/${conversationId}/messages`, 'message'), {
      senderId: 'unrelated', type: 'text', text: 'No access', attachment: null,
      moderationStatus: 'visible', editedAt: null, deletedAt: null, createdAt: serverTimestamp(),
    }))
    await assertFails(updateDoc(doc(environment.authenticatedContext('customer').firestore(), 'conversations', conversationId), { businessId: 'draft-business' }))
  })
  test('malformed legacy manager conversations fail safely for all messaging reads and writes', async () => {
    const conversationId = 'legacy-manager-participant'
    await seedConversationWithoutRules(conversationId, {
      ...conversation({ ownerId: 'manager' }),
      participantIds: ['customer', 'manager'],
      participantState: {
        customer: { lastReadAt: null, archivedAt: null, mutedUntil: null, deletedAt: null },
        manager: { lastReadAt: null, archivedAt: null, mutedUntil: null, deletedAt: null },
      },
    })

    await assertFails(getDoc(doc(environment.authenticatedContext('manager').firestore(), 'conversations', conversationId)))
    await assertFails(getDoc(doc(environment.authenticatedContext('customer').firestore(), 'conversations', conversationId)))
    await assertFails(setDoc(
      doc(environment.authenticatedContext('manager').firestore(), `conversations/${conversationId}/messages`, 'manager-message'),
      message({ senderId: 'manager' }),
    ))
    await assertFails(updateDoc(
      doc(environment.authenticatedContext('manager').firestore(), 'conversations', conversationId),
      new FieldPath('participantState', 'manager', 'lastReadAt'),
      serverTimestamp(),
      'updatedAt',
      serverTimestamp(),
    ))
  })
  test('invalid message creates are rejected', async () => {
    const conversationId = canonicalConversationId()
    await createConversation(conversationId)
    const database = environment.authenticatedContext('customer').firestore()
    const reference = (id) => doc(database, `conversations/${conversationId}/messages`, id)
    await assertFails(setDoc(reference('spoof'), message({ senderId: 'owner' })))
    await assertFails(setDoc(reference('backdated'), message({ createdAt: Timestamp.fromMillis(0) })))
    await assertFails(setDoc(reference('blank'), message({ text: '   ' })))
    await assertFails(setDoc(reference('too-long'), message({ text: 'a'.repeat(4001) })))
    await assertFails(setDoc(reference('unsupported-type'), message({ type: 'image' })))
    await assertFails(setDoc(reference('unsupported-field'), { ...message(), translatedText: 'Hola' }))
    await assertFails(setDoc(reference('spoofed-translation'), {
      ...message(),
      translation: {
        status: 'completed',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        translatedText: 'Hola',
        reason: null,
        processingStartedAt: null,
        processingLeaseUntil: null,
        attemptId: null,
        updatedAt: serverTimestamp(),
      },
    }))
  })
  test('clients cannot update original text or backend translation fields', async () => {
    const conversationId = canonicalConversationId()
    await createConversation(conversationId)
    await seedMessageWithoutRules(conversationId, 'message')
    const reference = doc(
      environment.authenticatedContext('customer').firestore(),
      `conversations/${conversationId}/messages`,
      'message',
    )

    await assertFails(updateDoc(reference, { text: 'Changed' }))
    await assertFails(updateDoc(reference, {
      translation: {
        status: 'completed',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        translatedText: 'Hola',
        reason: null,
        processingStartedAt: null,
        processingLeaseUntil: null,
        attemptId: null,
        updatedAt: serverTimestamp(),
      },
    }))
  })
  test('function admin path can store translation while participants can read it', async () => {
    const conversationId = canonicalConversationId()
    await createConversation(conversationId)
    await seedMessageWithoutRules(conversationId, 'translated-message')

    await environment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), `conversations/${conversationId}/messages`, 'translated-message'), {
        translation: {
          status: 'completed',
          sourceLanguage: 'en',
          targetLanguage: 'es',
          translatedText: 'Hola',
          reason: null,
          processingStartedAt: null,
          processingLeaseUntil: null,
          attemptId: null,
          updatedAt: serverTimestamp(),
        },
      })
    })

    const participantSnapshot = await assertSucceeds(getDoc(doc(
      environment.authenticatedContext('owner').firestore(),
      `conversations/${conversationId}/messages`,
      'translated-message',
    )))
    assert.equal(participantSnapshot.data().translation.status, 'completed')
    await assertFails(getDoc(doc(
      environment.authenticatedContext('unrelated').firestore(),
      `conversations/${conversationId}/messages`,
      'translated-message',
    )))
  })
  test('obsolete direct atomic message plus preview update is rejected', async () => {
    const conversationId = canonicalConversationId()
    await createConversation(conversationId)
    await assertFails(atomicMessagePreviewWrite())
    const snapshot = await getDoc(doc(environment.authenticatedContext('customer').firestore(), 'conversations', conversationId))
    assert.equal(snapshot.data().lastMessage, null)
    assert.equal(snapshot.data().lastMessageAt, null)
  })
  test('conversation preview cannot move backwards to an older message', async () => {
    const conversationId = canonicalConversationId()
    const newer = freshTimestamp(-1000)
    const older = Timestamp.fromMillis(newer.toMillis() - 1000)
    await seedConversationWithoutRules(conversationId, conversation({
      lastMessage: {
        messageId: 'newer-message',
        senderId: 'customer',
        type: 'text',
        preview: 'Newer',
        createdAt: newer,
      },
      lastMessageAt: newer,
    }))
    await seedMessageWithoutRules(conversationId, 'newer-message', message({ text: 'Newer', createdAt: newer }))
    await assertFails(atomicMessagePreviewWrite({
      conversationId,
      messageId: 'older-message',
      messageData: message({ text: 'Older', createdAt: older }),
    }))
    const snapshot = await getDoc(doc(environment.authenticatedContext('customer').firestore(), 'conversations', conversationId))
    assert.equal(snapshot.data().lastMessage.preview, 'Newer')
    assert.equal(snapshot.data().lastMessage.messageId, 'newer-message')
  })
  test('conversation preview updates require a matching message created in the same batch', async () => {
    const conversationId = canonicalConversationId()
    await createConversation(conversationId)
    const database = environment.authenticatedContext('customer').firestore()
    await assertFails(updateDoc(doc(database, 'conversations', conversationId), {
      lastMessage: {
        messageId: 'missing',
        senderId: 'customer',
        type: 'text',
        preview: 'Hello',
        createdAt: serverTimestamp(),
      },
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }))
    await assertFails(atomicMessagePreviewWrite({
      lastMessage: {
        messageId: 'message',
        senderId: 'customer',
        type: 'text',
        preview: 'Different text',
        createdAt: serverTimestamp(),
      },
    }))
    await assertFails(atomicMessagePreviewWrite({
      messageId: 'sender-mismatch',
      lastMessage: {
        messageId: 'sender-mismatch',
        senderId: 'owner',
        type: 'text',
        preview: 'Hello',
        createdAt: serverTimestamp(),
      },
    }))
    await assertFails(atomicMessagePreviewWrite({
      messageId: 'timestamp-mismatch',
      lastMessage: {
        messageId: 'timestamp-mismatch',
        senderId: 'customer',
        type: 'text',
        preview: 'Hello',
        createdAt: Timestamp.fromMillis(0),
      },
    }))
  })
  test('participants cannot alter conversation identity or participants', async () => {
    const conversationId = canonicalConversationId()
    await createConversation(conversationId)
    const reference = doc(environment.authenticatedContext('customer').firestore(), 'conversations', conversationId)
    await assertFails(updateDoc(reference, { businessId: 'draft-business', updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(reference, { customerId: 'unrelated', updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(reference, { participantIds: ['customer', 'unrelated'], updatedAt: serverTimestamp() }))
  })
  test('participants can update only their own participant state', async () => {
    const conversationId = canonicalConversationId()
    await createConversation(conversationId)
    const customerConversation = doc(environment.authenticatedContext('customer').firestore(), 'conversations', conversationId)
    const ownerConversation = doc(environment.authenticatedContext('owner').firestore(), 'conversations', conversationId)
    await assertSucceeds(updateDoc(
      customerConversation,
      new FieldPath('participantState', 'customer', 'deletedAt'),
      serverTimestamp(),
      'updatedAt',
      serverTimestamp(),
    ))
    await assertFails(updateDoc(
      customerConversation,
      new FieldPath('participantState', 'owner', 'deletedAt'),
      serverTimestamp(),
      'updatedAt',
      serverTimestamp(),
    ))
    await assertSucceeds(updateDoc(
      customerConversation,
      new FieldPath('participantState', 'customer', 'deletedAt'),
      null,
      new FieldPath('participantState', 'customer', 'archivedAt'),
      null,
      'updatedAt',
      serverTimestamp(),
    ))
    await assertSucceeds(updateDoc(
      ownerConversation,
      new FieldPath('participantState', 'owner', 'deletedAt'),
      serverTimestamp(),
      'updatedAt',
      serverTimestamp(),
    ))
  })
  test('participants can mark only their own read state with request time', async () => {
    const conversationId = canonicalConversationId()
    await createConversation(conversationId)
    const customerConversation = doc(environment.authenticatedContext('customer').firestore(), 'conversations', conversationId)

    await assertSucceeds(updateDoc(
      customerConversation,
      new FieldPath('participantState', 'customer', 'lastReadAt'),
      serverTimestamp(),
      'updatedAt',
      serverTimestamp(),
    ))
    await assertFails(updateDoc(
      customerConversation,
      new FieldPath('participantState', 'owner', 'lastReadAt'),
      serverTimestamp(),
      'updatedAt',
      serverTimestamp(),
    ))
    await assertFails(updateDoc(
      customerConversation,
      new FieldPath('participantState', 'customer', 'lastReadAt'),
      Timestamp.fromMillis(0),
      'updatedAt',
      serverTimestamp(),
    ))
    await assertFails(updateDoc(
      customerConversation,
      new FieldPath('participantState', 'customer', 'lastReadAt'),
      serverTimestamp(),
      'lastMessage',
      { messageId: 'fake', senderId: 'owner', type: 'text', preview: 'fake', createdAt: serverTimestamp() },
      'updatedAt',
      serverTimestamp(),
    ))
    await assertFails(updateDoc(
      customerConversation,
      new FieldPath('participantState', 'customer', 'lastReadAt'),
      serverTimestamp(),
      'businessId',
      'draft-business',
      'updatedAt',
      serverTimestamp(),
    ))
  })
})

describe('business insights aggregates', () => {
  test('aggregate documents are inaccessible and immutable to every client role', async () => {
    const path = ['businessInsights', 'active-business']
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), ...path), { profileViews: 4, schemaVersion: 1 })
      await setDoc(doc(context.firestore(), ...path, 'days', '2026-08-01'), { profileViews: 2 })
    })
    for (const context of [
      environment.unauthenticatedContext(),
      environment.authenticatedContext('owner'),
      environment.authenticatedContext('manager'),
      environment.authenticatedContext('other-owner'),
      environment.authenticatedContext('moderator', { moderator: true }),
    ]) {
      await assertFails(getDoc(doc(context.firestore(), ...path)))
      await assertFails(getDoc(doc(context.firestore(), ...path, 'days', '2026-08-01')))
      await assertFails(setDoc(doc(context.firestore(), ...path), { profileViews: 100 }, { merge: true }))
    }
  })
})

describe('storage', () => {
  const image = new Uint8Array([137, 80, 78, 71])
  const stagingMetadata = (contentType = 'image/png') => ({
    contentType, customMetadata: { holalocalUploadSession: 'request-12345678' },
  })
  test('canonical profile media is private to its owner and cannot be listed', async () => {
    const path = 'users/owner/profile/avatar'
    const ownerStorage = environment.authenticatedContext('owner').storage()
    await seedStorageWithoutRules(path)
    await assertSucceeds(getBytes(ref(ownerStorage, path)))
    await assertFails(getBytes(ref(environment.authenticatedContext('unrelated').storage(), path)))
    await assertFails(getBytes(ref(environment.unauthenticatedContext().storage(), path)))
    await assertFails(getBytes(ref(environment.authenticatedContext('moderator', { moderator: true }).storage(), path)))
    await assertFails(getBytes(ref(environment.authenticatedContext('admin', { admin: true }).storage(), path)))
    await assertFails(listAll(ref(ownerStorage, 'users/owner/profile')))
  })
  test('profile staging writes accept only the exact bounded slot and strict canonical writes are denied', async () => {
    await assertSucceeds(uploadBytes(
      ref(environment.authenticatedContext('customer').storage(), 'users/customer/staging/profile/avatar'),
      image,
      stagingMetadata('image/webp'),
    ))
    await assertFails(uploadBytes(
      ref(environment.authenticatedContext('customer').storage(), 'users/customer/staging/profile/photo.png'),
      image,
      { contentType: 'image/png' },
    ))
    await assertFails(uploadBytes(
      ref(environment.authenticatedContext('unrelated').storage(), 'users/customer/staging/profile/avatar'),
      image,
      { contentType: 'image/png' },
    ))
    for (const uid of ['suspended', 'deleted', 'deletion-pending']) {
      await assertFails(uploadBytes(
        ref(environment.authenticatedContext(uid).storage(), `users/${uid}/staging/profile/avatar`),
        image,
        { contentType: 'image/png' },
      ))
      await seedStorageWithoutRules(`users/${uid}/profile/avatar`)
      await assertFails(deleteObject(
        ref(environment.authenticatedContext(uid).storage(), `users/${uid}/profile/avatar`),
      ))
    }
    await assertFails(uploadBytes(
      ref(environment.authenticatedContext('customer').storage(), 'users/customer/profile/avatar'),
      image, { contentType: 'image/png' },
    ))
    await assertFails(getBytes(ref(
      environment.authenticatedContext('customer').storage(), 'users/customer/staging/profile/avatar',
    )))
    await assertFails(deleteObject(ref(
      environment.authenticatedContext('customer').storage(), 'users/customer/staging/profile/avatar',
    )))
  })
  test('legacy profile objects are owner-readable/deletable but immutable and private', async () => {
    const path = 'users/owner/profile/legacy-uuid.png'
    await seedStorageWithoutRules(path)
    const ownerStorage = environment.authenticatedContext('owner').storage()
    await assertSucceeds(getBytes(ref(ownerStorage, path)))
    await assertFails(getBytes(ref(environment.authenticatedContext('unrelated').storage(), path)))
    await assertFails(getBytes(ref(environment.authenticatedContext('moderator', { moderator: true }).storage(), path)))
    await assertFails(uploadBytes(ref(ownerStorage, path), image, { contentType: 'image/png' }))
    await assertSucceeds(deleteObject(ref(ownerStorage, path)))
    await assertFails(uploadBytes(
      ref(ownerStorage, 'users/owner/profile/new-legacy.png'),
      image,
      { contentType: 'image/png' },
    ))
  })
  test('owner and manager can upload exact bounded staging slots only while editable', async () => {
    await assertSucceeds(uploadBytes(
      ref(environment.authenticatedContext('owner').storage(), 'businesses/draft-business/staging/logos/logo'),
      image,
      stagingMetadata('image/jpeg'),
    ))
    await assertSucceeds(uploadBytes(
      ref(environment.authenticatedContext('manager').storage(), 'businesses/manager/staging/photos/0'),
      image,
      stagingMetadata('image/png'),
    ))
    await assertSucceeds(uploadBytes(
      ref(environment.authenticatedContext('manager').storage(), 'businesses/manager/staging/photos/7'),
      image,
      stagingMetadata('image/webp'),
    ))
    await assertFails(uploadBytes(
      ref(environment.authenticatedContext('unrelated').storage(), 'businesses/draft-business/staging/photos/0'),
      image,
      { contentType: 'image/png' },
    ))
    for (const path of [
      'businesses/draft-business/staging/photos/8',
      'businesses/draft-business/staging/photos/-1',
      'businesses/draft-business/staging/photos/custom.png',
      'businesses/draft-business/staging/logos/custom.png',
      'businesses/draft-business/covers/logo',
      'businesses/draft-business/private/0',
    ]) {
      await assertFails(uploadBytes(
        ref(environment.authenticatedContext('owner').storage(), path),
        image,
        { contentType: 'image/png' },
      ))
    }
    await assertFails(uploadBytes(
      ref(environment.authenticatedContext('owner').storage(), 'businesses/draft-business/logos/logo'),
      image, { contentType: 'image/png' },
    ))
  })
  test('inactive accounts and non-editable businesses cannot mutate canonical media', async () => {
    for (const uid of ['suspended', 'deleted', 'deletion-pending']) {
      await assertFails(uploadBytes(
        ref(environment.authenticatedContext(uid).storage(), `businesses/${uid}-owner-business/staging/logos/logo`),
        image,
        { contentType: 'image/png' },
      ))
    }
    for (const businessId of [
      'active-business', 'pending_review-business', 'suspended-business',
      'archived-business', 'deleted-business', 'active-with-deletedAt-business',
      'active-with-deletion-request-business',
    ]) {
      await assertFails(uploadBytes(
        ref(environment.authenticatedContext('owner').storage(), `businesses/${businessId}/staging/logos/logo`),
        image,
        { contentType: 'image/png' },
      ))
    }
  })
  test('staging uploads enforce MIME, strict size and exactly one session marker', async () => {
    const storage = environment.authenticatedContext('owner').storage()
    await assertFails(uploadBytes(
      ref(storage, 'businesses/draft-business/staging/photos/0'),
      image,
      stagingMetadata('text/plain'),
    ))
    await assertFails(uploadBytes(
      ref(storage, 'businesses/draft-business/staging/photos/1'),
      new Uint8Array(5 * 1024 * 1024),
      stagingMetadata('image/png'),
    ))
    await assertFails(uploadBytes(
      ref(storage, 'businesses/draft-business/staging/photos/2'),
      new Uint8Array((5 * 1024 * 1024) + 1),
      stagingMetadata('image/png'),
    ))
    await assertFails(uploadBytes(
      ref(storage, 'businesses/draft-business/staging/photos/3'),
      image,
      { contentType: 'image/png', customMetadata: { originalName: 'private-name.png' } },
    ))
    await assertFails(uploadBytes(
      ref(storage, 'businesses/draft-business/staging/photos/4'),
      image,
      { contentType: 'image/png', customMetadata: { arbitrary: 'value' } },
    ))
    await assertFails(uploadBytes(
      ref(storage, 'businesses/draft-business/staging/photos/5'), image,
      { contentType: 'image/png' },
    ))
    await assertFails(uploadBytes(
      ref(storage, 'businesses/draft-business/staging/photos/6'), image,
      { contentType: 'image/png', customMetadata: {
        holalocalUploadSession: 'request-12345678', extra: 'forbidden',
      } },
    ))
    for (const path of [
      'businesses/draft-business/logos/logo/a',
      'businesses/draft-business/photos/0/b',
      'users/owner/profile/avatar/a',
    ]) await assertFails(uploadBytes(ref(storage, path), image, { contentType: 'image/png' }))
  })
  test('canonical and legacy business folders cannot be listed', async () => {
    const storage = environment.authenticatedContext('owner').storage()
    await assertFails(listAll(ref(storage, 'businesses/draft-business/logos')))
    await assertFails(listAll(ref(storage, 'businesses/draft-business/photos')))
    await assertFails(listAll(ref(storage, 'businesses/draft-business')))
  })
  test('legacy business media remains minimally readable/deletable but cannot be created or updated', async () => {
    const logoPath = 'businesses/draft-business/logos/legacy-uuid.png'
    const photoPath = 'businesses/draft-business/photos/legacy-uuid.webp'
    await seedStorageWithoutRules(logoPath)
    await seedStorageWithoutRules(photoPath)
    const ownerStorage = environment.authenticatedContext('owner').storage()
    const moderatorStorage = environment.authenticatedContext('moderator', { moderator: true }).storage()
    await assertSucceeds(getBytes(ref(ownerStorage, logoPath)))
    await assertSucceeds(getBytes(ref(moderatorStorage, photoPath)))
    await assertFails(getBytes(ref(environment.authenticatedContext('unrelated').storage(), logoPath)))
    await assertFails(getBytes(ref(environment.unauthenticatedContext().storage(), logoPath)))
    await assertFails(uploadBytes(ref(ownerStorage, logoPath), image, { contentType: 'image/png' }))
    await assertFails(uploadBytes(
      ref(ownerStorage, 'businesses/draft-business/photos/new-legacy.png'),
      image,
      { contentType: 'image/png' },
    ))
    await assertSucceeds(deleteObject(ref(ownerStorage, logoPath)))
    await assertSucceeds(deleteObject(ref(ownerStorage, photoPath)))
  })
  test('browser deletion is restricted to legitimate media folders and editable businesses', async () => {
    const internalPath = 'businesses/draft-business/internal/private.bin'
    const activeLegacyPath = 'businesses/active-business/photos/legacy-active.png'
    await seedStorageWithoutRules(internalPath)
    await seedStorageWithoutRules(activeLegacyPath)
    const ownerStorage = environment.authenticatedContext('owner').storage()
    await assertFails(deleteObject(ref(ownerStorage, internalPath)))
    await assertFails(deleteObject(ref(ownerStorage, activeLegacyPath)))
    await assertFails(deleteObject(ref(environment.authenticatedContext('unrelated').storage(), activeLegacyPath)))
  })
  test('public canonical reads require full eligibility and an exact manifest reference', async () => {
    const publicStorage = environment.unauthenticatedContext().storage()
    const referencedLogo = 'businesses/active-business/logos/logo'
    const referencedPhoto = 'businesses/active-business/photos/0'
    const unreferencedPhoto = 'businesses/active-business/photos/1'
    await seedStorageWithoutRules(referencedLogo)
    await seedStorageWithoutRules(referencedPhoto)
    await seedStorageWithoutRules(unreferencedPhoto)
    await assertSucceeds(getBytes(ref(publicStorage, referencedLogo)))
    await assertSucceeds(getBytes(ref(publicStorage, referencedPhoto)))
    await assertFails(getBytes(ref(publicStorage, unreferencedPhoto)))
  })
  test('public A/B reads allow only the exact active manifest slot', async () => {
    const businessId = 'active-business'
    const activeLogo = `businesses/${businessId}/logos/logo/a`
    const inactiveLogo = `businesses/${businessId}/logos/logo/b`
    const activePhoto = `businesses/${businessId}/photos/0/b`
    const inactivePhoto = `businesses/${businessId}/photos/0/a`
    await environment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'businesses', businessId), {
        logoStoragePath: activeLogo, galleryStoragePaths: [activePhoto],
      })
      for (const path of [activeLogo, inactiveLogo, activePhoto, inactivePhoto]) {
        await uploadBytes(ref(context.storage(), path), image, { contentType: 'image/png' })
      }
    })
    const storage = environment.unauthenticatedContext().storage()
    await assertSucceeds(getBytes(ref(storage, activeLogo)))
    await assertSucceeds(getBytes(ref(storage, activePhoto)))
    await assertFails(getBytes(ref(storage, inactiveLogo)))
    await assertFails(getBytes(ref(storage, inactivePhoto)))
  })
  test('public canonical reads fail for every non-public lifecycle and deletion state', async () => {
    const businessIds = [
      'draft-business', 'pending_review-business', 'rejected-business', 'suspended-business',
      'archived-business', 'deleted-business', 'active-with-deletedAt-business',
      'active-with-deletion-request-business', 'incomplete-active-business',
      'active-without-publishedAt-business', 'unsafe-active-business',
      'unsafe-website-business',
    ]
    await environment.withSecurityRulesDisabled(async (context) => {
      const database = context.firestore()
      for (const businessId of businessIds) {
        await updateDoc(doc(database, 'businesses', businessId), {
          logoStoragePath: `businesses/${businessId}/logos/logo`,
          galleryStoragePaths: [`businesses/${businessId}/photos/0`],
        })
        await uploadBytes(
          ref(context.storage(), `businesses/${businessId}/logos/logo`),
          image,
          { contentType: 'image/png' },
        )
      }
    })
    const publicStorage = environment.unauthenticatedContext().storage()
    for (const businessId of businessIds) {
      await assertFails(getBytes(ref(publicStorage, `businesses/${businessId}/logos/logo`)))
    }
  })
  test('legacy unreferenced media is never anonymously rule-readable', async () => {
    const path = 'businesses/active-business/photos/legacy-public-token-object.png'
    await seedStorageWithoutRules(path)
    await assertFails(getBytes(ref(environment.unauthenticatedContext().storage(), path)))
  })
})

test('test environment was initialized', () => assert.ok(environment))
