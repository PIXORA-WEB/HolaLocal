import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  resolveWebsiteBusinessLookup,
  toManagedBusinessView,
  toPublicBusinessView,
  toWebsiteUserProfile,
} from '../src/services/firebaseCompatibility.js'

class TimestampFixture {
  toDate() { return new Date(0) }
}

const canonicalContact = {
  phone: '', phoneVisible: false, email: '', emailVisible: false,
  whatsappNumber: '', whatsappVisible: false, website: '', websiteVisible: false,
  preferredContactMethod: 'holalocal', allowCallbackRequests: false,
}

function canonicalBusiness(overrides = {}) {
  return {
    ownerId: 'owner-1', managerIds: ['owner-1'], name: 'Canonical Business',
    primaryCategoryId: 'cleaning', categoryIds: ['cleaning'], serviceAreas: ['marbella'],
    languages: ['en'], primaryLanguage: 'en', location: { locality: 'Marbella', countryCode: 'ES' },
    contact: canonicalContact, status: 'draft', verificationStatus: 'unverified',
    subscription: { tier: 'free', status: 'none' }, profileCompleted: true,
    ...overrides,
  }
}

test('canonical website user view preserves behavior and opaque timestamps', () => {
  const timestamp = new TimestampFixture()
  const raw = {
    uid: 'user-1', email: 'user@example.invalid', displayName: 'Synthetic User',
    displayNameNormalized: 'synthetic user', roles: ['customer', 'business'], accountType: 'both',
    preferredLocale: 'es', accountStatus: 'active', profileCompleted: true,
    onboardingCompleted: true, businessProfileRequired: true, businessProfileCompleted: true,
    businessId: 'business-1', createdAt: timestamp, updatedAt: timestamp,
  }
  const before = { ...raw }
  const profile = toWebsiteUserProfile('user-1', raw)
  assert.deepEqual(profile.roles, ['customer', 'business'])
  assert.equal(profile.accountType, 'both')
  assert.equal(profile.preferredLocale, 'es')
  assert.equal(profile.createdAt, timestamp)
  assert.equal(profile.compatibility.writeSafe, false)
  assert.deepEqual(raw, before)
})

test('legacy mobile user is interpreted without promoting trust', () => {
  const raw = {
    uid: 'legacy-user', email: 'legacy@example.invalid', displayName: 'Legacy User',
    accountType: 'business', preferredLanguage: 'Deutsch', accountStatus: 'active',
    profileCompleted: true, onboardingCompleted: true, isVerified: true, isPremium: true,
  }
  const profile = toWebsiteUserProfile('legacy-user', raw)
  assert.deepEqual(profile.roles, ['business'])
  assert.equal(profile.preferredLocale, 'de')
  assert.equal(profile.emailVerified, null)
  assert.equal('isPremium' in profile, false)
  assert.equal(profile.compatibility.writeSafe, false)
})

test('roles win conflicts so accountType cannot grant additional access', () => {
  const profile = toWebsiteUserProfile('conflict-user', {
    email: 'conflict@example.invalid', roles: ['customer'], accountType: 'both',
    preferredLocale: 'en', accountStatus: 'active',
  })
  assert.deepEqual(profile.roles, ['customer'])
  assert.equal(profile.accountType, 'both')
  assert.equal(profile.roles.includes('business'), false)
})

test('canonical managed and public business views remain compatible', () => {
  const raw = canonicalBusiness({ status: 'active', ratingAverage: 4.5, ratingCount: 2 })
  const managed = toManagedBusinessView('business-1', raw)
  const publicView = toPublicBusinessView('business-1', raw)
  assert.equal(managed.name, 'Canonical Business')
  assert.equal(managed.businessId, 'business-1')
  assert.equal(publicView.name, 'Canonical Business')
  assert.equal(publicView.status, 'active')
  assert.equal(publicView.ratingAverage, 4.5)
})

test('legacy UID business is owner-readable without trust or media promotion', () => {
  const raw = {
    ownerId: 'owner-1', businessName: 'Legacy Business', mainCategory: 'Cleaning',
    subcategories: ['Cleaning'], serviceAreas: ['Málaga', 'Custom Coast'],
    languages: ['English', 'Custom Tongue'], primaryLanguage: 'English', city: 'Málaga',
    phone: '000000000', email: 'legacy@example.invalid', website: 'https://example.invalid',
    logoURL: 'https://example.invalid/logo.png', galleryImageURLs: ['https://example.invalid/work.png'],
    isActive: true, isVerified: true, isPremium: true, subscriptionTier: 'paid',
  }
  const before = structuredClone(raw)
  const managed = toManagedBusinessView('owner-1', raw)
  assert.equal(managed.name, 'Legacy Business')
  assert.equal(managed.primaryCategoryId, 'Cleaning')
  assert.deepEqual(managed.languages, ['en', 'Custom Tongue'])
  assert.deepEqual(managed.serviceAreas, ['malaga', 'Custom Coast'])
  assert.equal(managed.status, null)
  assert.equal(managed.verificationStatus, null)
  assert.equal(managed.subscription, null)
  assert.equal(managed.profilePhoto, null)
  assert.equal(managed.logoUrl, raw.logoURL)
  assert.equal(managed.contact.phoneVisible, false)
  assert.equal(managed.contact.website, '')
  assert.equal(managed.legacyPrivateContact.website, raw.website)
  assert.equal(toPublicBusinessView('owner-1', raw), null)
  assert.deepEqual(raw, before)
})

test('legacy top-level contacts never enter an otherwise canonical public view', () => {
  const publicView = toPublicBusinessView('business-1', canonicalBusiness({
    status: 'active', contact: undefined, phone: '000000000', email: 'legacy@example.invalid',
  }))
  assert.equal(publicView.contact.phone, '')
  assert.equal(publicView.contact.email, '')
})

test('public contact projection defaults private and requires explicit visibility', () => {
  const hidden = toPublicBusinessView('business-hidden', canonicalBusiness({
    status: 'active',
    contact: {
      ...canonicalContact,
      phone: '000000000',
      email: 'owner@example.invalid',
      whatsappNumber: '111111111',
      website: 'https://example.invalid',
    },
  }))
  assert.deepEqual(
    [hidden.contact.phone, hidden.contact.email, hidden.contact.whatsappNumber, hidden.contact.website],
    ['', '', '', ''],
  )

  const visible = toPublicBusinessView('business-visible', canonicalBusiness({
    status: 'active',
    contact: {
      ...canonicalContact,
      phone: '000000000',
      phoneVisible: true,
      email: 'owner@example.invalid',
      emailVisible: true,
      whatsappNumber: '111111111',
      whatsappVisible: true,
      website: 'https://example.invalid',
      websiteVisible: true,
    },
  }))
  assert.equal(visible.contact.phone, '000000000')
  assert.equal(visible.contact.email, 'owner@example.invalid')
  assert.equal(visible.contact.whatsappNumber, '111111111')
  assert.equal(visible.contact.website, 'https://example.invalid')
})

test('business editor includes all four explicit public-contact visibility controls', async () => {
  const [editor, english] = await Promise.all([
    readFile(new URL('../src/pages/business/EditBusinessPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/i18n/locales/en.json', import.meta.url), 'utf8'),
  ])
  for (const field of ['emailVisible', 'phoneVisible', 'whatsappVisible', 'websiteVisible']) {
    assert.match(editor, new RegExp(`${field}: false`))
    assert.match(editor, new RegExp(`${field}: profile\\?\\.contact\\?\\.${field}`))
    assert.match(editor, new RegExp(`${field}: form\\.${field}`))
  }
  const translations = JSON.parse(english)
  assert.equal(translations.business.form.contact.showEmail, 'Show email on my public profile')
  assert.equal(translations.business.form.contact.showPhone, 'Show phone number on my public profile')
  assert.equal(translations.business.form.contact.showWhatsapp, 'Show WhatsApp on my public profile')
  assert.equal(translations.business.form.contact.showWebsite, 'Show website on my public profile')
})

test('lookup accepts a valid user pointer and deduplicates the same owner-query document', () => {
  const document = canonicalBusiness()
  const result = resolveWebsiteBusinessLookup({
    ownerId: 'owner-1',
    pointerCandidate: { businessId: 'business-1', ownerId: 'owner-1', document },
    ownerCandidates: [{ businessId: 'business-1', ownerId: 'owner-1', document }],
  })
  assert.equal(result.lookup.status, 'found')
  assert.equal(result.lookup.source, 'user_business_id')
  assert.equal(result.document, document)
})

test('lookup reports invalid pointers and owner mismatches without selecting them', () => {
  assert.equal(resolveWebsiteBusinessLookup({ ownerId: 'owner-1', pointerInvalid: true }).lookup.status, 'invalid_mapping')
  const mismatch = resolveWebsiteBusinessLookup({
    ownerId: 'owner-1',
    pointerCandidate: { businessId: 'other-business', ownerId: 'other-owner', document: {} },
  })
  assert.equal(mismatch.lookup.status, 'owner_mismatch')
  assert.equal(mismatch.document, null)
})

test('lookup supports UID and owner-query fallbacks', () => {
  const uid = resolveWebsiteBusinessLookup({
    ownerId: 'owner-1', uidCandidate: { businessId: 'owner-1', ownerId: 'owner-1', document: {} },
  })
  assert.equal(uid.lookup.status, 'found')
  assert.equal(uid.lookup.source, 'owner_uid_document')

  const query = resolveWebsiteBusinessLookup({
    ownerId: 'owner-1', ownerCandidates: [{ businessId: 'business-1', ownerId: 'owner-1', document: {} }],
  })
  assert.equal(query.lookup.status, 'found')
  assert.equal(query.lookup.source, 'owner_id_query')
})

test('multiple candidates are always ambiguous regardless of order', () => {
  const first = { businessId: 'business-a', ownerId: 'owner-1', document: { name: 'A' } }
  const second = { businessId: 'business-b', ownerId: 'owner-1', document: { name: 'B' } }
  for (const ownerCandidates of [[first, second], [second, first]]) {
    const result = resolveWebsiteBusinessLookup({ ownerId: 'owner-1', ownerCandidates })
    assert.equal(result.lookup.status, 'ambiguous')
    assert.deepEqual(result.lookup.candidateDocumentIds, ['business-a', 'business-b'])
    assert.equal(result.document, null)
  }
  assert.equal(resolveWebsiteBusinessLookup({ ownerId: 'owner-1' }).lookup.status, 'not_found')
})

test('compatibility adapters remain isolated from canonical write builders', async () => {
  const [userService, businessService] = await Promise.all([
    readFile(new URL('../src/services/userService.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/businessService.js', import.meta.url), 'utf8'),
  ])
  assert.match(userService, /sanitizeProfileData\(updates\)/)
  assert.match(businessService, /sanitizeBusinessData\(updates\)/)
  assert.match(businessService, /projectPublicContact\(sanitizeContact\(contact\)\)\.contact/)
  assert.match(businessService, /business\.contact = storedPublicContact\(privateContact\)/)
  assert.match(businessService, /websiteVisible: contact\.websiteVisible === true/)
  assert.doesNotMatch(userService, /transaction\.(?:set|update)\([^\n]*toWebsiteUserProfile/)
  assert.doesNotMatch(businessService, /transaction\.(?:set|update)\([^\n]*toManagedBusinessView/)
})

test('canonical customer, business and combined roles retain route-facing semantics', () => {
  for (const [accountType, roles, hasBusiness] of [
    ['customer', ['customer'], false],
    ['business', ['business'], true],
    ['both', ['customer', 'business'], true],
  ]) {
    const profile = toWebsiteUserProfile(`user-${accountType}`, {
      email: `${accountType}@example.invalid`, accountType, roles,
      preferredLocale: 'en', accountStatus: 'active', profileCompleted: true,
      onboardingCompleted: true,
    })
    assert.equal(profile.roles.includes('business'), hasBusiness)
    assert.equal(profile.profileCompleted, true)
    assert.equal(profile.onboardingCompleted, true)
  }
})
