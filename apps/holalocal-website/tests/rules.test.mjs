import { after, before, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, FieldPath, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { deleteObject, ref, uploadBytes } from 'firebase/storage'
import { buildConversationId } from '@holalocal/firebase-contract'
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
  owner: user('owner', { roles: ['business'], accountType: 'business', onboardingCompleted: true, profileCompleted: true }),
  manager: user('manager', { roles: ['business'], accountType: 'business', onboardingCompleted: true, profileCompleted: true }),
  otherOwner: user('other-owner', { roles: ['business'], accountType: 'business', onboardingCompleted: true, profileCompleted: true }),
  unrelated: user('unrelated', { roles: ['customer'] }),
  suspended: user('suspended', { roles: ['customer'], accountStatus: 'suspended' }),
  deleted: user('deleted', { roles: ['customer'], accountStatus: 'deleted' }),
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
    await setDoc(doc(database, 'businesses', 'active-business'), business())
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
    await setDoc(doc(database, 'businessPrivate', 'active-business'), {
      ownerId: 'owner', managerIds: ['owner', 'manager'],
      contact: { ...activeContact, email: 'private@example.test' },
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
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

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile('../../firestore.rules', 'utf8') },
    storage: { rules: await readFile('../../storage.rules', 'utf8') },
  })
})
beforeEach(async () => { await environment.clearFirestore(); await seed() })
after(async () => { await environment.cleanup() })

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
  test('blocked accounts cannot perform protected writes', async () => {
    for (const id of ['suspended', 'deleted']) {
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
  test('only safe active businesses are public', async () => {
    await assertSucceeds(getDoc(doc(environment.unauthenticatedContext().firestore(), 'businesses', 'active-business')))
    await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), 'businesses', 'draft-business')))
    await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), 'businesses', 'unsafe-active-business')))
    await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), 'businesses', 'unsafe-website-business')))
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
  test('moderators can publish eligible submitted businesses', async () => {
    const moderator = environment.authenticatedContext('moderator', { moderator: true }).firestore()
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', 'moderator'), user('moderator', { roles: ['customer'] }))
    })
    await assertSucceeds(updateDoc(doc(moderator, 'businesses', 'pending_review-business'), {
      status: 'active',
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }))
    await assertSucceeds(getDoc(doc(environment.unauthenticatedContext().firestore(), 'businesses', 'pending_review-business')))
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
  test('moderator lifecycle transitions are explicit and publication requires eligibility', async () => {
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
    await assertSucceeds(updateDoc(doc(moderator, 'businesses', 'active-business'), {
      status: 'suspended',
      updatedAt: serverTimestamp(),
    }))
    await assertSucceeds(updateDoc(doc(moderator, 'businesses', 'suspended-business'), {
      status: 'active',
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }))
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
})

describe('conversations and messages', () => {
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

describe('storage', () => {
  const image = new Uint8Array([137, 80, 78, 71])
  test('manager image upload succeeds and unrelated upload fails', async () => {
    await assertSucceeds(uploadBytes(ref(environment.authenticatedContext('manager').storage(), 'businesses/active-business/photos/valid.png'), image, { contentType: 'image/png' }))
    await assertFails(uploadBytes(ref(environment.authenticatedContext('unrelated').storage(), 'businesses/active-business/photos/invalid.png'), image, { contentType: 'image/png' }))
  })
  test('invalid type and oversized images fail', async () => {
    const storage = environment.authenticatedContext('owner').storage()
    await assertFails(uploadBytes(ref(storage, 'businesses/active-business/photos/file.txt'), image, { contentType: 'text/plain' }))
    await assertFails(uploadBytes(ref(storage, 'businesses/active-business/photos/large.png'), new Uint8Array(5 * 1024 * 1024), { contentType: 'image/png' }))
  })
  test('suspended accounts cannot upload files', async () => {
    await assertFails(uploadBytes(ref(environment.authenticatedContext('suspended').storage(), 'users/suspended/profile/photo.png'), image, { contentType: 'image/png' }))
  })
  test('unrelated users cannot delete business media', async () => {
    const path = 'businesses/active-business/photos/delete.png'
    await assertSucceeds(uploadBytes(ref(environment.authenticatedContext('owner').storage(), path), image, { contentType: 'image/png' }))
    await assertFails(deleteObject(ref(environment.authenticatedContext('unrelated').storage(), path)))
  })
})

test('test environment was initialized', () => assert.ok(environment))
