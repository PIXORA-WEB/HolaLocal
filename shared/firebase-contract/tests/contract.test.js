import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ACCOUNT_STATUSES, BUSINESS_STATUSES, CONTACT_METHODS, ISSUE_CODES, SUBSCRIPTION_STATUSES,
  SUPPORTED_LANGUAGE_CODES, USER_ROLES, VERIFICATION_STATUSES, adaptBusinessDocument,
  adaptUserDocument, ambiguousBusinesses, buildConversationId, businessNotFound, detectUnsafePublicContact,
  foundBusiness, getConversationActivityTime, hasOwnerOnlyConversationParticipants, invalidMapping,
  hasCompleteUserProfile, isConversationHiddenForUser, isConversationUnreadForUser, isCustomIdentifier,
  isPublicBusinessEligible, normalizeLanguage, normalizeLanguages,
  normalizePrimaryLanguage, normalizeServiceAreas, ownerMismatch, projectPublicContact,
  MESSAGE_TRANSLATION_REASONS, MESSAGE_TRANSLATION_STATUSES, normalizeMessageTranslation,
  selectMessageDisplayText, shouldAdvanceConversationPreview, shouldShowTranslatedMessage,
  validateAccountStatus, validateBusinessOwnerMapping, validateBusinessStatus,
  validateManagerIds, validateOwnerWritablePayload, validatePrimaryLanguage, validateRoles,
  validateSubscriptionStatus, validateVerificationStatus, isConversationIdFor, MAX_MESSAGE_LENGTH,
} from '../index.js'

const hasIssue = (result, code) => result.issues.some((entry) => entry.code === code)

test('controlled values match the approved contract', () => {
  assert.deepEqual(USER_ROLES, ['customer', 'business'])
  assert.equal(SUPPORTED_LANGUAGE_CODES.length, 17)
  assert.deepEqual(CONTACT_METHODS, ['holalocal', 'phone', 'email', 'whatsapp'])
  assert.ok(ACCOUNT_STATUSES.includes('deletion_pending'))
  assert.ok(BUSINESS_STATUSES.includes('pending_review'))
  assert.ok(BUSINESS_STATUSES.includes('rejected'))
  assert.ok(VERIFICATION_STATUSES.includes('rejected'))
  assert.ok(SUBSCRIPTION_STATUSES.includes('past_due'))
})

test('user profile completion is derived from canonical profile fields', () => {
  const profile = {
    firstName: 'Casey',
    lastName: 'Customer',
    displayName: 'Casey Customer',
    preferredLocale: 'en',
    city: 'Marbella',
    country: 'Spain',
    profileCompleted: false,
  }

  assert.equal(hasCompleteUserProfile(profile), true)
  assert.equal(hasCompleteUserProfile({ ...profile, city: '' }), false)
  assert.equal(hasCompleteUserProfile({ ...profile, profileCompleted: true, firstName: '' }), false)
})

test('messaging translation helpers normalize backend-managed translation state', () => {
  assert.deepEqual(MESSAGE_TRANSLATION_STATUSES, ['processing', 'completed', 'not_required', 'failed'])
  assert.ok(MESSAGE_TRANSLATION_REASONS.includes('provider_unavailable'))

  const translated = {
    senderId: 'owner',
    text: 'Original text',
    translation: {
      status: 'completed',
      sourceLanguage: 'en',
      targetLanguage: 'es',
      translatedText: 'Texto traducido',
      reason: null,
      processingStartedAt: null,
      processingLeaseUntil: null,
      attemptId: null,
      updatedAt: 1,
    },
  }

  assert.equal(shouldShowTranslatedMessage(translated, 'customer'), true)
  assert.equal(shouldShowTranslatedMessage(translated, 'owner'), false)
  assert.equal(selectMessageDisplayText(translated, 'customer'), 'Texto traducido')
  assert.equal(selectMessageDisplayText(translated, 'customer', true), 'Original text')
  assert.equal(selectMessageDisplayText(translated, 'owner'), 'Original text')
  assert.equal(normalizeMessageTranslation({ status: 'completed', translatedText: 42 }).translatedText, null)
  assert.equal(normalizeMessageTranslation({ status: 'unknown' }).valid, false)
})

test('messaging helpers build deterministic customer and business conversation IDs', () => {
  const conversationId = buildConversationId('customer-1', 'business-1')
  assert.equal(conversationId, 'customer-1__business-1')
  assert.equal(isConversationIdFor(conversationId, 'customer-1', 'business-1'), true)
  assert.equal(isConversationIdFor(conversationId, 'customer-2', 'business-1'), false)
  assert.equal(MAX_MESSAGE_LENGTH, 4000)

  assert.throws(() => buildConversationId('', 'business-1'))
  assert.throws(() => buildConversationId('customer-1', 'business/1'))
})

test('conversation preview ordering is monotonic for concurrent sends', () => {
  const older = new Date('2026-07-14T10:00:00.000Z')
  const newer = new Date('2026-07-14T10:00:00.010Z')

  assert.equal(shouldAdvanceConversationPreview(null, older), true)
  assert.equal(shouldAdvanceConversationPreview(older, newer), true)
  assert.equal(shouldAdvanceConversationPreview(newer, older), false)
  assert.equal(shouldAdvanceConversationPreview(newer, newer), true)
  assert.equal(shouldAdvanceConversationPreview(newer, null), false)
})

test('messaging helpers derive unread state from participant read timestamps', () => {
  const conversation = {
    lastMessage: { senderId: 'owner', createdAt: 2000 },
    lastMessageAt: 2000,
    createdAt: 1000,
    participantState: {
      customer: { lastReadAt: 1000, deletedAt: null },
      owner: { lastReadAt: null, deletedAt: null },
    },
  }

  assert.equal(isConversationUnreadForUser(conversation, 'customer'), true)
  assert.equal(isConversationUnreadForUser({
    ...conversation,
    lastMessage: { senderId: 'customer', createdAt: 2000 },
  }, 'customer'), false)
  assert.equal(isConversationUnreadForUser({
    ...conversation,
    participantState: { customer: { lastReadAt: null, deletedAt: null } },
  }, 'customer'), true)
  assert.equal(isConversationHiddenForUser({
    ...conversation,
    participantState: { customer: { lastReadAt: 1000, deletedAt: 1500 } },
  }, 'customer'), true)
  assert.equal(isConversationUnreadForUser({
    ...conversation,
    participantState: { customer: { lastReadAt: 1000, deletedAt: 1500 } },
  }, 'customer'), false)
  assert.equal(getConversationActivityTime(conversation), 2000)
})

test('messaging helpers require exactly customer and business owner participants', () => {
  assert.equal(hasOwnerOnlyConversationParticipants({
    customerId: 'customer',
    participantIds: ['customer', 'owner'],
  }, 'owner'), true)
  assert.equal(hasOwnerOnlyConversationParticipants({
    customerId: 'customer',
    participantIds: ['customer', 'manager'],
  }, 'owner'), false)
  assert.equal(hasOwnerOnlyConversationParticipants({
    customerId: 'customer',
    participantIds: ['customer', 'owner', 'manager'],
  }, 'owner'), false)
  assert.equal(hasOwnerOnlyConversationParticipants({
    customerId: 'owner',
    participantIds: ['owner'],
  }, 'owner'), false)
})

test('public business eligibility requires publication, complete canonical fields and safe contact', () => {
  const contact = {
    phone: '', phoneVisible: false,
    email: '', emailVisible: false,
    whatsappNumber: '', whatsappVisible: false,
    website: '', websiteVisible: false,
    preferredContactMethod: 'holalocal',
    allowCallbackRequests: false,
  }
  const business = {
    ownerId: 'owner',
    managerIds: ['owner'],
    name: 'Published business',
    description: 'A complete profile.',
    primaryCategoryId: 'Cleaning',
    categoryIds: ['Cleaning'],
    serviceAreas: ['marbella'],
    languages: ['en', 'es'],
    primaryLanguage: 'en',
    location: { locality: 'Marbella', region: 'Málaga', countryCode: 'ES' },
    contact,
    status: 'active',
    publishedAt: 1,
  }

  assert.equal(isPublicBusinessEligible(business), true)
  assert.equal(isPublicBusinessEligible({ ...business, publishedAt: null }), false)
  assert.equal(isPublicBusinessEligible({ ...business, status: 'pending_review' }), false)
  assert.equal(isPublicBusinessEligible({ ...business, deletedAt: 1 }), false)
  assert.equal(isPublicBusinessEligible({ ...business, deletionRequestedAt: 1 }), false)
  assert.equal(isPublicBusinessEligible({ ...business, description: '' }), false)
  assert.equal(isPublicBusinessEligible({
    ...business,
    contact: { ...contact, email: 'hidden@example.invalid', emailVisible: false },
  }), false)
})

test('all codes, locale variants, labels, case and whitespace normalize', () => {
  for (const code of SUPPORTED_LANGUAGE_CODES) assert.equal(normalizeLanguage(code).value.id, code)
  assert.equal(normalizeLanguage(' ES ').value.id, 'es')
  assert.equal(normalizeLanguage('es-ES').value.id, 'es')
  assert.equal(normalizeLanguage('ES_es').value.id, 'es')
  assert.equal(normalizeLanguage('Español').value.id, 'es')
  assert.equal(normalizeLanguage('Francais').value.id, 'fr')
  assert.equal(normalizeLanguage('Українська').value.id, 'uk')
})

test('language arrays deduplicate and preserve deterministic custom values', () => {
  const first = normalizeLanguages(['English', 'en', 'Klingon'])
  const second = normalizeLanguages([' klingon '])
  assert.deepEqual(first.identifiers.slice(0, 1), ['en'])
  assert.equal(first.identifiers[1], second.identifiers[0])
  assert.equal(first.values[1].label, 'Klingon')
  assert.ok(isCustomIdentifier(first.identifiers[1], 'language'))
  assert.ok(hasIssue(first, ISSUE_CODES.LANGUAGE_DUPLICATE_REMOVED))
  assert.ok(hasIssue(first, ISSUE_CODES.LANGUAGE_UNKNOWN_CUSTOM))
})

test('invalid primary language repairs to first preserved value with an issue', () => {
  const result = normalizePrimaryLanguage('de', ['es', 'Custom Tongue'])
  assert.equal(result.value, 'es')
  assert.ok(hasIssue(result, ISSUE_CODES.LANGUAGE_PRIMARY_REPAIRED))
  assert.equal(result.languages.length, 2)
})

test('service areas preserve IDs, normalize known labels, and retain distinct customs', () => {
  const result = normalizeServiceAreas(['marbella', 'Málaga', ' marbella ', 'Nueva Andalucía', 'Nueva Andalucia'])
  assert.deepEqual(result.identifiers.slice(0, 2), ['marbella', 'malaga'])
  assert.equal(result.identifiers.length, 4)
  assert.ok(isCustomIdentifier(result.identifiers[2], 'area'))
  assert.equal(result.values[2].label, 'Nueva Andalucía')
  assert.notEqual(result.identifiers[2], result.identifiers[3])
  assert.ok(hasIssue(result, ISSUE_CODES.SERVICE_AREA_UNKNOWN_CUSTOM))
})

test('canonical and legacy users normalize without mutating input or promoting trust', () => {
  const canonical = { roles: ['customer'], preferredLocale: 'es', accountStatus: 'active', emailVerified: true }
  const snapshot = structuredClone(canonical)
  const canonicalResult = adaptUserDocument('user-1', canonical)
  assert.equal(canonicalResult.profile.preferredLocale, 'es')
  assert.equal(canonicalResult.profile.emailVerified, true)
  assert.deepEqual(canonical, snapshot)

  const legacy = {
    accountType: 'both', roles: ['customer'], preferredLanguage: 'Deutsch', isVerified: true,
    isPremium: true, deletedAt: 'legacy-value',
  }
  const legacySnapshot = structuredClone(legacy)
  const result = adaptUserDocument('user-2', legacy)
  assert.equal(result.profile.preferredLocale, 'de')
  assert.equal(result.profile.emailVerified, null)
  assert.equal(result.profile.accountStatus, null)
  assert.ok(hasIssue(result, ISSUE_CODES.USER_CONFLICTING_ROLES))
  assert.ok(hasIssue(result, ISSUE_CODES.USER_AMBIGUOUS_VERIFICATION))
  assert.ok(hasIssue(result, ISSUE_CODES.USER_LEGACY_PREMIUM_NOT_PROMOTED))
  assert.ok(hasIssue(result, ISSUE_CODES.USER_AMBIGUOUS_DELETION))
  assert.deepEqual(legacy, legacySnapshot)
})

test('canonical business normalizes and legacy business preserves data without trust promotion', () => {
  const canonical = {
    ownerId: 'owner-1', managerIds: ['owner-1'], name: 'Example', primaryCategoryId: 'cleaning',
    categoryIds: ['cleaning'], serviceAreas: ['marbella'], languages: ['es'], primaryLanguage: 'es',
    location: { locality: 'Marbella', countryCode: 'ES' },
    contact: { phone: '', phoneVisible: false, email: '', emailVisible: false, whatsappNumber: '', whatsappVisible: false, website: '', websiteVisible: false, preferredContactMethod: 'holalocal' },
    status: 'draft', verificationStatus: 'unverified', subscription: { status: 'none' },
  }
  const canonicalResult = adaptBusinessDocument('business-1', canonical)
  assert.equal(canonicalResult.business.name, 'Example')
  assert.equal(canonicalResult.business.status, 'draft')

  const legacy = {
    ownerId: 'owner-2', businessName: 'Legacy', mainCategory: 'Cleaning', subcategories: ['Cleaning'],
    city: 'Málaga', province: 'Málaga', country: 'Spain', serviceAreas: ['Málaga', 'Custom Coast'],
    languages: ['English', 'Custom Language'], primaryLanguage: 'English', phone: '000000000',
    isActive: true, isVerified: true, isPremium: true, subscriptionTier: 'paid', logoURL: 'https://example.invalid/logo.png',
  }
  const snapshot = structuredClone(legacy)
  const result = adaptBusinessDocument('owner-2', legacy)
  assert.equal(result.business.name, 'Legacy')
  assert.equal(result.business.status, null)
  assert.equal(result.business.verificationStatus, null)
  assert.equal(result.business.subscription, null)
  assert.equal(result.business.languages.length, 2)
  assert.equal(result.business.serviceAreas.length, 2)
  assert.ok(hasIssue(result, ISSUE_CODES.BUSINESS_CONTACT_REQUIRES_PRIVATE_MIGRATION))
  assert.ok(hasIssue(result, ISSUE_CODES.BUSINESS_TRUST_STATUS_NOT_PROMOTED))
  assert.ok(hasIssue(result, ISSUE_CODES.BUSINESS_LEGACY_ID_STRATEGY))
  assert.deepEqual(legacy, snapshot)
})

test('canonical and legacy business conflicts are reported', () => {
  const result = adaptBusinessDocument('business-2', {
    ownerId: 'owner', name: 'Canonical', businessName: 'Legacy',
    primaryCategoryId: 'canonical-category', mainCategory: 'Legacy Category',
    location: { locality: 'Marbella' }, city: 'Málaga', languages: ['en'], primaryLanguage: 'en',
  })
  assert.ok(hasIssue(result, ISSUE_CODES.BUSINESS_CONFLICTING_NAME))
  assert.ok(hasIssue(result, ISSUE_CODES.BUSINESS_CONFLICTING_CATEGORY))
  assert.ok(hasIssue(result, ISSUE_CODES.BUSINESS_CONFLICTING_LOCATION))
})

test('public contact projection never exposes hidden or implicitly visible values', () => {
  const hidden = projectPublicContact({
    phone: '000000000', email: 'person@example.invalid', website: 'https://example.invalid',
    preferredContactMethod: 'phone',
  })
  assert.equal(hidden.contact.phone, '')
  assert.equal(hidden.contact.email, '')
  assert.equal(hidden.contact.website, '')
  assert.equal(hidden.contact.preferredContactMethod, 'holalocal')
  assert.ok(hasIssue(hidden, ISSUE_CODES.CONTACT_PREFERRED_METHOD_NOT_PUBLIC))

  const visible = projectPublicContact({
    phone: '000000000', phoneVisible: true, website: 'https://example.invalid', websiteVisible: true,
    preferredContactMethod: 'phone',
  })
  assert.equal(visible.contact.phone, '000000000')
  assert.equal(visible.contact.website, 'https://example.invalid')
  assert.equal(visible.contact.preferredContactMethod, 'phone')
})

test('unsafe public contact detector catches top-level, hidden nested, and unknown structures', () => {
  assert.equal(detectUnsafePublicContact({ phone: '000000000' }).safe, false)
  assert.equal(detectUnsafePublicContact({ contact: { email: 'person@example.invalid', emailVisible: false } }).safe, false)
  assert.equal(detectUnsafePublicContact({ contact: { secret: 'value' } }).safe, false)
})

test('lookup result model covers every lookup outcome without payload data', () => {
  const mapped = foundBusiness({ businessId: 'business-1', ownerId: 'owner-1', source: 'business_owner_mapping' })
  assert.equal(mapped.status, 'found')
  assert.equal(mapped.usedLegacyCompatibility, false)
  assert.equal(foundBusiness({ businessId: 'owner-1', ownerId: 'owner-1', source: 'owner_uid_document' }).idEqualsOwnerUid, true)
  assert.equal(foundBusiness({ businessId: 'business-2', ownerId: 'owner-1', source: 'owner_id_query' }).usedLegacyCompatibility, true)
  assert.equal(businessNotFound().status, 'not_found')
  assert.equal(invalidMapping().status, 'invalid_mapping')
  assert.equal(ownerMismatch({ businessId: 'business-1', expectedOwnerId: 'owner-1', actualOwnerId: 'owner-2' }).status, 'owner_mismatch')
  const ambiguous = ambiguousBusinesses(['b', 'a', 'b'])
  assert.deepEqual(ambiguous.candidateDocumentIds, ['a', 'b'])
  assert.ok(hasIssue(ambiguous, ISSUE_CODES.LOOKUP_MULTIPLE_CANDIDATES))
})

test('validators reject invalid states, membership, duplicate managers, mappings and trusted fields', () => {
  assert.equal(validateRoles(['customer', 'admin']).valid, false)
  assert.equal(validateAccountStatus('unknown').valid, false)
  assert.equal(validateBusinessStatus('published').valid, false)
  assert.equal(validateVerificationStatus('self_verified').valid, false)
  assert.equal(validateSubscriptionStatus('paid').valid, false)
  assert.equal(validatePrimaryLanguage('de', ['en']).valid, false)
  assert.equal(validateManagerIds('owner', ['owner', 'owner']).valid, false)
  assert.equal(validateBusinessOwnerMapping({ ownerId: 'other', businessId: 'b' }, 'owner').valid, false)
  assert.equal(validateOwnerWritablePayload({ name: 'Okay', status: 'active' }, 'business').valid, false)
  assert.equal(validateOwnerWritablePayload({ displayName: 'Okay', businessId: 'b' }, 'user').valid, false)
})
