import test from 'node:test'
import assert from 'node:assert/strict'
import * as contract from '../index.js'

const hasIssue = (result, code) => result.issues.some((entry) => entry.code === code)

test('public entry point is explicit and excludes the internal issue constructor', () => {
  for (const name of [
    'adaptUserDocument', 'adaptBusinessDocument', 'normalizeLanguage', 'normalizeServiceAreas',
    'projectPublicContact', 'foundBusiness', 'validateOwnerWritablePayload', 'USER_CONTRACT',
    'BUSINESS_CONTRACT', 'BUSINESS_PRIVATE_CONTRACT', 'BUSINESS_OWNER_CONTRACT',
  ]) assert.equal(typeof contract[name] === 'function' || typeof contract[name] === 'object', true, name)
  assert.equal('issue' in contract, false)
})

test('every controlled language code is unique and every native label maps correctly', () => {
  assert.equal(new Set(contract.SUPPORTED_LANGUAGE_CODES).size, 17)
  const labels = {
    en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', nl: 'Nederlands',
    pt: 'Português', pl: 'Polski', ro: 'Română', cs: 'Čeština', sk: 'Slovenčina',
    hu: 'Magyar', uk: 'Українська', it: 'Italiano', sv: 'Svenska', da: 'Dansk',
    fi: 'Suomi', no: 'Norsk',
  }
  for (const [code, label] of Object.entries(labels)) {
    assert.equal(contract.normalizeLanguage(code).value.id, code)
    assert.equal(contract.normalizeLanguage(label).value.id, code)
  }
})

test('custom identifiers are stable, bounded, normalized, separated and non-empty', () => {
  const composed = contract.normalizeLanguage('Élfico').value
  const decomposed = contract.normalizeLanguage('E\u0301lfico').value
  const spaced = contract.normalizeLanguage('  Sign   Language  ').value
  const repeated = contract.normalizeLanguage('sign language').value
  const area = contract.normalizeServiceArea('Sign Language').value
  assert.equal(composed.id, decomposed.id)
  assert.equal(spaced.id, repeated.id)
  assert.equal(contract.normalizeLanguage('Klingon').value.id, contract.normalizeLanguage('Klingon').value.id)
  assert.notEqual(contract.normalizeLanguage('Area One').value.id, contract.normalizeLanguage('Area Two').value.id)
  assert.notEqual(contract.normalizeServiceArea('Area A').value.id, contract.normalizeServiceArea('Área A').value.id)
  assert.notEqual(spaced.id, area.id)
  assert.ok(spaced.id.length < 100)
  assert.ok(contract.normalizeLanguage('x'.repeat(10_000)).value.id.length < 100)
  for (const malformed of ['', '   ', null, {}, 12]) {
    const result = contract.normalizeLanguage(malformed)
    assert.equal(result.value, null)
    assert.ok(hasIssue(result, contract.ISSUE_CODES.LANGUAGE_INVALID_VALUE))
  }
})

test('custom source labels survive while standard and custom duplicates collapse predictably', () => {
  const result = contract.normalizeLanguages(['EN', 'English', '  Custom   Tongue ', 'custom tongue'])
  assert.deepEqual(result.identifiers.slice(0, 1), ['en'])
  assert.equal(result.identifiers.length, 2)
  assert.equal(result.values[1].label, 'Custom   Tongue')
  assert.equal(result.values[1].source, 'Custom   Tongue')
  assert.ok(hasIssue(result, contract.ISSUE_CODES.LANGUAGE_DUPLICATE_REMOVED))
})

test('primary language cannot be silently accepted outside the preserved list', () => {
  const repaired = contract.normalizePrimaryLanguage('de', ['es', 'fr'])
  assert.equal(repaired.value, 'es')
  assert.ok(hasIssue(repaired, contract.ISSUE_CODES.LANGUAGE_PRIMARY_REPAIRED))
  assert.equal(contract.validatePrimaryLanguage('de', ['es', 'fr']).valid, false)
})

test('service-area aliases come from current IDs and do not conflate Costa del Sol with Gibraltar', () => {
  const result = contract.normalizeServiceAreas(['Málaga', 'malaga', 'Gibraltar', 'Costa del Sol'])
  assert.deepEqual(result.identifiers.slice(0, 2), ['malaga', 'gibraltar'])
  assert.equal(result.values[2].label, 'Costa del Sol')
  assert.ok(contract.isCustomIdentifier(result.identifiers[2], 'area'))
  assert.ok(hasIssue(result, contract.ISSUE_CODES.SERVICE_AREA_UNKNOWN_CUSTOM))
  const mapped = contract.normalizeServiceAreas(['Future Area'], { 'future area': 'future-area-id' })
  assert.deepEqual(mapped.identifiers, ['future-area-id'])
  assert.equal(mapped.values[0].isCustom, false)
})

test('user adapter reports conflicts, preserves opaque timestamps, and never invents media', () => {
  class TimestampFixture {}
  const timestamp = new TimestampFixture()
  const raw = {
    uid: 'user-1', email: 'synthetic@example.invalid', roles: ['customer'], accountType: 'both',
    preferredLocale: 'es', preferredLanguage: 'Deutsch', accountStatus: 'active',
    photoURL: 'https://example.invalid/photo.png', emailVerified: false,
    termsAccepted: false, privacyAccepted: true, termsAcceptedAt: timestamp,
  }
  const before = { ...raw }
  const result = contract.adaptUserDocument('user-1', raw)
  assert.equal(result.kind, 'user_compatibility_view')
  assert.equal(result.writeSafe, false)
  assert.equal(result.documentId, 'user-1')
  assert.equal(result.profile.profilePhoto, null)
  assert.equal(result.profile.photoURL, raw.photoURL)
  assert.equal(result.profile.consent.termsAccepted, false)
  assert.equal(result.profile.consent.privacyAccepted, true)
  assert.equal(result.profile.consent.termsAcceptedAt, timestamp)
  assert.ok(hasIssue(result, contract.ISSUE_CODES.USER_CONFLICTING_ROLES))
  assert.ok(hasIssue(result, contract.ISSUE_CODES.USER_CONFLICTING_LANGUAGE))
  assert.deepEqual(raw, before)
})

test('user adapter marks missing target fields and keeps legacy trust ambiguous', () => {
  const result = contract.adaptUserDocument('legacy-user', {
    preferredLanguage: 'English', isVerified: true, isPremium: true, deletedAt: { seconds: 1 },
  })
  assert.equal(result.profile.emailVerified, null)
  assert.equal(result.profile.accountStatus, null)
  assert.ok(hasIssue(result, contract.ISSUE_CODES.COMPATIBILITY_MISSING_REQUIRED_FIELD))
  assert.ok(hasIssue(result, contract.ISSUE_CODES.USER_AMBIGUOUS_VERIFICATION))
  assert.ok(hasIssue(result, contract.ISSUE_CODES.USER_AMBIGUOUS_DELETION))
})

test('business adapter separates source identity, legacy contacts, media and location evidence', () => {
  const raw = {
    ownerId: 'owner-1', businessName: 'Legacy Name', mainCategory: 'Legacy Category',
    subcategories: ['Unmapped Category'], city: 'Málaga', province: 'Málaga', country: 'Spain',
    phone: '000000000', website: 'https://example.invalid', logoURL: 'https://example.invalid/logo.png',
    galleryImageURLs: ['https://example.invalid/gallery.png'], languages: ['English'],
    primaryLanguage: 'English', isActive: true, isVerified: true, subscriptionTier: 'paid',
  }
  const before = structuredClone(raw)
  const result = contract.adaptBusinessDocument('owner-1', raw)
  assert.equal(result.kind, 'business_compatibility_view')
  assert.equal(result.writeSafe, false)
  assert.equal(result.documentId, 'owner-1')
  assert.equal(result.business.ownerId, 'owner-1')
  assert.equal(result.business.contact, null)
  assert.equal(result.business.profilePhoto, null)
  assert.deepEqual(result.business.galleryImages, [])
  assert.equal(result.legacy.logoURL, raw.logoURL)
  assert.deepEqual(result.legacy.galleryImageURLs, raw.galleryImageURLs)
  assert.equal(result.legacy.contactCandidate.phone, raw.phone)
  assert.equal(result.business.locationSources.legacy.locality, 'Málaga')
  assert.equal(result.business.status, null)
  assert.equal(result.business.verificationStatus, null)
  assert.equal(result.business.subscription, null)
  assert.ok(hasIssue(result, contract.ISSUE_CODES.BUSINESS_LEGACY_CATEGORY))
  assert.ok(hasIssue(result, contract.ISSUE_CODES.BUSINESS_CONTACT_REQUIRES_PRIVATE_MIGRATION))
  assert.deepEqual(raw, before)
})

test('business adapter reports canonical/legacy contact conflicts and unsafe nested values', () => {
  const result = contract.adaptBusinessDocument('business-1', {
    ownerId: 'owner-1', name: 'Synthetic Business', primaryCategoryId: 'cleaning', categoryIds: [],
    languages: ['en'], primaryLanguage: 'en', status: 'draft', verificationStatus: 'unverified',
    contact: { email: 'canonical@example.invalid', emailVisible: false },
    email: 'legacy@example.invalid',
  })
  assert.ok(hasIssue(result, contract.ISSUE_CODES.BUSINESS_CONFLICTING_CONTACT))
  assert.ok(hasIssue(result, contract.ISSUE_CODES.BUSINESS_PUBLIC_CONTACT_UNSAFE))
  assert.equal(result.business.contact.email, 'canonical@example.invalid')
})

test('contact projection exhaustively respects false, missing and true visibility', () => {
  const definitions = [
    ['phone', 'phoneVisible'], ['email', 'emailVisible'],
    ['whatsappNumber', 'whatsappVisible'], ['website', 'websiteVisible'],
  ]
  for (const [valueField, visibilityField] of definitions) {
    for (const visibility of [undefined, false, true]) {
      const input = { [valueField]: 'synthetic-value' }
      if (visibility !== undefined) input[visibilityField] = visibility
      const projected = contract.projectPublicContact(input).contact
      assert.equal(projected[valueField], visibility === true ? 'synthetic-value' : '')
    }
  }
  const nested = contract.projectPublicContact({
    contact: { phone: '000000000' }, visibility: { phone: true },
    preferredContactMethod: 'phone', callbackPreferences: { allowRequests: true, privateNote: 'not public' },
  })
  assert.equal(nested.contact.phone, '000000000')
  assert.equal(nested.contact.allowCallbackRequests, true)
  assert.equal('privateNote' in nested.contact, false)
})

test('contact preferences and unsafe detectors fail closed', () => {
  assert.equal(contract.projectPublicContact({ preferredContactMethod: 'holalocal' }).issues.length, 0)
  for (const method of ['phone', 'email', 'whatsapp']) {
    const result = contract.projectPublicContact({ preferredContactMethod: method, [`${method}Visible`]: true })
    assert.ok(hasIssue(result, contract.ISSUE_CODES.CONTACT_PREFERRED_METHOD_NOT_PUBLIC))
  }
  for (const field of ['phone', 'email', 'whatsapp', 'whatsappNumber', 'website']) {
    const result = contract.detectUnsafePublicContact({ [field]: 'synthetic-value' })
    assert.equal(result.safe, false)
    assert.ok(hasIssue(result, contract.ISSUE_CODES.CONTACT_TOP_LEVEL_PRIVATE_FIELD))
  }
  assert.equal(contract.detectUnsafePublicContact({ contact: { phone: 'x', phoneVisible: false } }).safe, false)
  assert.equal(contract.detectUnsafePublicContact({ contact: { phoneVisible: 'yes' } }).safe, false)
  assert.ok(hasIssue(contract.projectPublicContact({ contact: 'invalid' }), contract.ISSUE_CODES.CONTACT_UNKNOWN_STRUCTURE))
  assert.ok(hasIssue(contract.projectPublicContact({ contact: { secret: 'invalid' } }), contract.ISSUE_CODES.CONTACT_UNKNOWN_STRUCTURE))
})

test('lookup results reject malformed inputs, preserve only issue-code warnings and are immutable', () => {
  assert.equal(contract.foundBusiness().status, 'invalid_mapping')
  assert.equal(contract.foundBusiness({ businessId: 'b', ownerId: 'o', source: 'unknown' }).status, 'invalid_mapping')
  assert.equal(contract.ambiguousBusinesses('not-an-array').status, 'invalid_mapping')
  assert.equal(contract.ambiguousBusinesses(['only-one']).status, 'invalid_mapping')
  assert.equal(contract.ownerMismatch().status, 'invalid_mapping')
  const ambiguous = contract.ambiguousBusinesses(['b', 'a'], [
    contract.ISSUE_CODES.BUSINESS_LEGACY_ID_STRATEGY, 'NOT_A_CODE',
  ])
  assert.equal(ambiguous.status, 'ambiguous')
  assert.deepEqual(ambiguous.warnings.map(({ code }) => code), [contract.ISSUE_CODES.BUSINESS_LEGACY_ID_STRATEGY])
  assert.equal(Object.isFrozen(ambiguous), true)
  assert.equal(Object.isFrozen(ambiguous.candidateDocumentIds), true)
  assert.throws(() => ambiguous.candidateDocumentIds.push('c'), TypeError)
})

test('validators reject recursive trusted paths and malformed private shapes without throwing', () => {
  for (const payload of [
    { subscription: { status: 'active' } }, { 'subscription.status': 'active' },
    { verification: { status: 'verified' } }, { ratings: { average: 5 } },
    { galleryCount: 8 }, { publishedAt: {} }, { updatedAt: {} }, { contact: { phone: 'x' } },
  ]) assert.equal(contract.validateOwnerWritablePayload(payload, 'business').valid, false)
  assert.equal(contract.validateOwnerWritablePayload(null, 'business').valid, false)
  assert.equal(contract.validateManagerIds('', null).valid, false)
  assert.equal(contract.validatePrivateContact({ contact: { phone: 123 } }).valid, false)
  assert.equal(contract.validatePrivateContact({ visibility: { phone: 'yes' } }).valid, false)
  assert.equal(contract.validatePublicContact(null).valid, false)
})

test('contract authority metadata covers critical trusted and derived fields recursively', () => {
  const userFields = contract.USER_CONTRACT.fields
  assert.equal(userFields.businessId.access, 'trusted_only')
  assert.equal(userFields.emailVerified.access, 'trusted_only')
  assert.equal(userFields.accountStatus.access, 'trusted_only')
  const businessFields = contract.BUSINESS_CONTRACT.fields
  for (const field of ['status', 'verificationStatus', 'subscription', 'publishedAt', 'verifiedAt']) {
    assert.equal(businessFields[field].access, 'trusted_only', field)
  }
  for (const field of ['nameNormalized', 'slug', 'ratingAverage', 'ratingCount', 'galleryCount']) {
    assert.equal(businessFields[field].access, 'derived', field)
  }
  for (const field of Object.values(contract.BUSINESS_OWNER_CONTRACT.fields)) {
    assert.equal(field.access, 'trusted_only')
  }
})

test('every issue code is unique, documented and classified', () => {
  const codes = Object.values(contract.ISSUE_CODES)
  assert.equal(new Set(codes).size, codes.length)
  assert.deepEqual(Object.keys(contract.ISSUE_CODE_DESCRIPTIONS).sort(), [...codes].sort())
  assert.deepEqual(Object.keys(contract.ISSUE_CODE_METADATA).sort(), [...codes].sort())
  for (const code of codes) {
    assert.equal(typeof contract.ISSUE_CODE_METADATA[code].description, 'string')
    assert.ok(['error', 'warning'].includes(contract.ISSUE_CODE_METADATA[code].severity))
  }
})
