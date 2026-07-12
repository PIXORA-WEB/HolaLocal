import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { projectPublicContact } from '@holalocal/firebase-contract'
import {
  resolveMobileBusinessLookup,
  toMobileManagedBusiness,
  toMobilePublicBusiness,
} from '../src/services/businessCompatibility.js'
import { buildCanonicalBusinessUpdate } from '../src/services/businessPayloads.js'

class TimestampFixture { toDate() { return new Date(0) } }
const timestamp = new TimestampFixture()
const safeContact = {
  phone: '', phoneVisible: false, email: '', emailVisible: false,
  whatsappNumber: '', whatsappVisible: false, website: '', websiteVisible: false,
  preferredContactMethod: 'holalocal', allowCallbackRequests: false,
}

function canonical(overrides = {}) {
  return {
    ownerId: 'owner-1', managerIds: ['owner-1'], name: 'Canonical Business',
    tagline: '', description: 'Description', primaryCategoryId: 'Cleaning',
    categoryIds: ['Cleaning'], serviceAreas: ['marbella'], serviceRadiusKm: 20,
    location: { locality: 'Marbella', region: 'Málaga', countryCode: 'ES' },
    languages: ['en', 'es'], primaryLanguage: 'en', contact: safeContact,
    status: 'draft', verificationStatus: 'unverified', profileCompleted: true,
    createdAt: timestamp, updatedAt: timestamp, ...overrides,
  }
}

test('canonical website business is managed, public-safe and editable without mutation', () => {
  const raw = canonical({ status: 'active' })
  const before = { ...raw }
  const managed = toMobileManagedBusiness('auto-id', raw)
  const publicView = toMobilePublicBusiness('auto-id', raw)
  assert.equal(managed.businessId, 'auto-id')
  assert.equal(managed.ownerId, 'owner-1')
  assert.equal(managed.editSupport.supported, true)
  assert.equal(managed.profileCompleted, true)
  assert.equal(managed.createdAt, timestamp)
  assert.equal(publicView.name, 'Canonical Business')
  assert.equal(publicView.contact.phone, '')
  assert.equal(publicView.contact.website, '')
  assert.deepEqual(raw, before)
})

test('editability predicate rejects unsupported owner, contact, taxonomy and legacy states', () => {
  for (const [name, overrides] of [
    ['missing managerIds', { managerIds: undefined }],
    ['owner not managed', { managerIds: ['manager-1'] }],
    ['legacy top-level contact', { phone: '000000000' }],
    ['hidden nested contact value', { contact: { ...safeContact, email: 'hidden@example.invalid' } }],
    ['hidden nested website value', { contact: { ...safeContact, website: 'https://example.invalid' } }],
    ['unsupported category', { primaryCategoryId: 'Unknown', categoryIds: ['Unknown'] }],
    ['unsupported language label', { languages: ['Custom Tongue'], primaryLanguage: 'Custom Tongue' }],
    ['unsupported service area label', { serviceAreas: ['Custom Coast'] }],
  ]) {
    const managed = toMobileManagedBusiness('auto-id', canonical(overrides))
    assert.equal(managed.editSupport.supported, false, name)
  }
  const uidManaged = toMobileManagedBusiness('owner-1', canonical())
  assert.equal(uidManaged.editSupport.supported, true)
})

test('legacy UID business remains readable without trust, contact or media promotion', () => {
  const raw = {
    ownerId: 'owner-1', businessName: 'Legacy Business', mainCategory: 'Cleaning',
    subcategories: ['Cleaning'], serviceAreas: ['Málaga', 'Custom Coast'],
    languages: ['English', 'Custom Tongue'], primaryLanguage: 'English',
    city: 'Málaga', phone: '000000000', email: 'legacy@example.invalid',
    logoURL: 'https://example.invalid/logo.png', isActive: true, isVerified: true,
    galleryImageURLs: ['https://example.invalid/gallery.png'], isPremium: true,
    subscriptionTier: 'paid', createdAt: timestamp,
  }
  const managed = toMobileManagedBusiness('owner-1', raw)
  assert.equal(managed.name, 'Legacy Business')
  assert.equal(managed.status, null)
  assert.equal(managed.verificationStatus, null)
  assert.equal(managed.subscription, null)
  assert.equal(managed.editSupport.supported, false)
  assert.equal(managed.profilePhoto, null)
  assert.equal(managed.logoUrl, raw.logoURL)
  assert.equal(managed.legacyMedia.logoURL, raw.logoURL)
  assert.deepEqual(managed.legacyMedia.galleryImageURLs, raw.galleryImageURLs)
  assert.equal(managed.contact, null)
  assert.equal(managed.legacyPrivateContact.phone, raw.phone)
  assert.equal(toMobilePublicBusiness('owner-1', raw), null)
})

test('public view never promotes private legacy or hidden nested contact values', () => {
  const legacyView = toMobilePublicBusiness('legacy', canonical({
    status: 'active',
    phone: '000000000',
    email: 'legacy@example.invalid',
    whatsappNumber: '111111111',
    website: 'https://legacy.example.invalid',
  }))
  assert.deepEqual(
    [legacyView.contact.phone, legacyView.contact.email, legacyView.contact.whatsappNumber, legacyView.contact.website],
    ['', '', '', ''],
  )
  const publicView = toMobilePublicBusiness('active', canonical({
    status: 'active',
    contact: {
      ...safeContact,
      phone: '000000000',
      email: 'hidden@example.invalid',
      whatsappNumber: '111111111',
      website: 'https://visible.example.invalid',
    },
  }))
  assert.equal(publicView.contact.phone, '')
  assert.equal(publicView.contact.email, '')
  assert.equal(publicView.contact.whatsappNumber, '')
  assert.equal(publicView.contact.website, '')
})

test('canonical fields win conflicts and report compatibility issues', () => {
  const managed = toMobileManagedBusiness('auto-id', canonical({
    name: 'Canonical', businessName: 'Legacy', primaryCategoryId: 'Cleaning',
    mainCategory: 'Plumbing',
  }))
  assert.equal(managed.name, 'Canonical')
  assert.ok(managed.compatibility.issues.includes('BUSINESS_CONFLICTING_NAME'))
  assert.ok(managed.compatibility.issues.includes('BUSINESS_CONFLICTING_CATEGORY'))
})

test('lookup validates sources and never chooses duplicate businesses', () => {
  const document = canonical()
  const pointer = resolveMobileBusinessLookup({
    ownerId: 'owner-1',
    pointerCandidate: { businessId: 'auto-id', ownerId: 'owner-1', document },
    ownerCandidates: [{ businessId: 'auto-id', ownerId: 'owner-1', document }],
  })
  assert.equal(pointer.lookup.status, 'found')
  assert.equal(pointer.lookup.source, 'user_business_id')
  assert.equal(resolveMobileBusinessLookup({ ownerId: 'owner-1', pointerInvalid: true }).lookup.status, 'invalid_mapping')
  assert.equal(resolveMobileBusinessLookup({
    ownerId: 'owner-1', uidCandidate: { businessId: 'owner-1', ownerId: 'other', document: {} },
  }).lookup.status, 'owner_mismatch')
  assert.equal(resolveMobileBusinessLookup({
    ownerId: 'owner-1', uidCandidate: { businessId: 'owner-1', ownerId: 'owner-1', document },
  }).lookup.source, 'owner_uid_document')
  assert.equal(resolveMobileBusinessLookup({
    ownerId: 'owner-1', ownerCandidates: [{ businessId: 'auto-id', ownerId: 'owner-1', document }],
  }).lookup.source, 'owner_id_query')
  for (const candidates of [
    [{ businessId: 'b', ownerId: 'owner-1' }, { businessId: 'a', ownerId: 'owner-1' }],
    [{ businessId: 'a', ownerId: 'owner-1' }, { businessId: 'b', ownerId: 'owner-1' }],
  ]) {
    assert.equal(resolveMobileBusinessLookup({ ownerId: 'owner-1', ownerCandidates: candidates }).lookup.status, 'ambiguous')
  }
  assert.equal(resolveMobileBusinessLookup({ ownerId: 'owner-1' }).lookup.status, 'not_found')
})

test('canonical edit builder allowlists fields and excludes legacy, trusted and derived values', () => {
  const built = buildCanonicalBusinessUpdate({
    ...canonical(), businessId: 'forbidden', ownerId: 'forbidden', managerIds: ['forbidden'],
    businessName: 'legacy', mainCategory: 'legacy', isActive: true, isVerified: true,
    status: 'active', verificationStatus: 'verified', subscription: { status: 'active' },
    subscriptionTier: 'paid', isPremium: true, ratingAverage: 5, ratingCount: 1,
    galleryCount: 99, nameNormalized: 'forbidden', slug: 'forbidden',
    publishedAt: timestamp, verifiedAt: timestamp, profileCompleted: false,
    phone: '000000000', contact: { phone: '000000000' },
    profilePhoto: null, coverPhoto: null, galleryImages: [], galleryImageURLs: [],
    unknown: 'forbidden',
  })
  assert.equal(built.valid, true)
  assert.deepEqual(Object.keys(built.payload).sort(), [
    'categoryIds', 'description', 'languages', 'location', 'name', 'primaryCategoryId',
    'primaryLanguage', 'serviceAreas', 'serviceRadiusKm', 'tagline',
  ])
  assert.deepEqual(built.payload, {
    name: 'Canonical Business',
    tagline: '',
    description: 'Description',
    primaryCategoryId: 'Cleaning',
    categoryIds: ['Cleaning'],
    serviceAreas: ['marbella'],
    serviceRadiusKm: 20,
    location: { locality: 'Marbella', region: 'Málaga', countryCode: 'ES' },
    languages: ['en', 'es'],
    primaryLanguage: 'en',
  })
})

test('edit builder validates categories, languages, service areas and compatibility views', () => {
  assert.equal(buildCanonicalBusinessUpdate({ ...canonical(), primaryCategoryId: 'Unknown' }).valid, false)
  assert.equal(buildCanonicalBusinessUpdate({ ...canonical(), primaryLanguage: 'fr' }).valid, false)
  assert.equal(buildCanonicalBusinessUpdate({ ...canonical(), languages: ['Custom Tongue'] }).valid, false)
  assert.equal(buildCanonicalBusinessUpdate({ ...canonical(), serviceAreas: ['Custom Coast'] }).valid, false)
  const customLanguage = 'custom:language:custom-tongue:0abc1230def456'
  const customArea = 'custom:area:custom-coast:0abc1230def456'
  const custom = buildCanonicalBusinessUpdate({
    ...canonical(), languages: ['en', customLanguage], primaryLanguage: customLanguage,
    serviceAreas: ['marbella', customArea],
  })
  assert.equal(custom.valid, true)
  assert.deepEqual(custom.payload.languages, ['en', customLanguage])
  assert.deepEqual(custom.payload.serviceAreas, ['marbella', customArea])
  const editableCustom = toMobileManagedBusiness('auto-id', canonical({
    languages: ['en', customLanguage],
    languageLabels: { [customLanguage]: 'Custom Tongue' },
    primaryLanguage: customLanguage,
    serviceAreas: ['marbella', customArea],
    customServiceAreas: { [customArea]: 'Custom Coast' },
  }))
  assert.equal(editableCustom.editSupport.supported, true)
  assert.deepEqual(editableCustom.languages, ['en', customLanguage])
  assert.deepEqual(editableCustom.serviceAreas, ['marbella', customArea])
  assert.equal(buildCanonicalBusinessUpdate({ compatibility: { writeSafe: false } }).valid, false)
})

test('ordinary edit payload does not generate media or contact field deletions', () => {
  const built = buildCanonicalBusinessUpdate(canonical({
    logoURL: 'https://example.invalid/logo.png',
    coverImageURL: 'https://example.invalid/cover.png',
    galleryImageURLs: ['https://example.invalid/gallery.png'],
    profilePhoto: { downloadUrl: 'https://example.invalid/profile.png' },
    coverPhoto: { downloadUrl: 'https://example.invalid/canonical-cover.png' },
    galleryImages: [{ downloadUrl: 'https://example.invalid/canonical-gallery.png' }],
    contact: { ...safeContact, phone: '000000000', phoneVisible: true },
  }))
  assert.equal(built.valid, true)
  for (const field of [
    'contact', 'phone', 'email', 'whatsapp', 'whatsappNumber', 'website',
    'profilePhoto', 'coverPhoto', 'galleryImages', 'galleryImageURLs',
    'logoURL', 'coverImageURL', 'galleryCount',
  ]) assert.equal(Object.hasOwn(built.payload, field), false, field)
})

test('contact projection requires explicit visibility and validates preferred methods', () => {
  const hidden = projectPublicContact({
    phone: '000000000', email: 'synthetic@example.invalid', whatsappNumber: '111111111',
    website: 'https://example.invalid', preferredContactMethod: 'holalocal',
  })
  assert.deepEqual(
    [hidden.contact.phone, hidden.contact.email, hidden.contact.whatsappNumber, hidden.contact.website],
    ['', '', '', ''],
  )
  for (const [valueField, visibilityField, value] of [
    ['phone', 'phoneVisible', '000000000'], ['email', 'emailVisible', 'synthetic@example.invalid'],
    ['whatsappNumber', 'whatsappVisible', '111111111'], ['website', 'websiteVisible', 'https://example.invalid'],
  ]) {
    const projected = projectPublicContact({
      [valueField]: value, [visibilityField]: true, preferredContactMethod: 'holalocal',
    })
    assert.equal(projected.contact[valueField], value)
  }
  assert.ok(projectPublicContact({ phone: '000000000', preferredContactMethod: 'phone' }).issues.length)
  assert.equal(projectPublicContact({ preferredContactMethod: 'holalocal' }).contact.preferredContactMethod, 'holalocal')
})

test('UI keeps creation blocked, unsupported legacy read-only and errors generic', async () => {
  const [service, editor, english] = await Promise.all([
    readFile(new URL('../src/services/businessService.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/business/EditBusinessPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/i18n/locales/en.json', import.meta.url), 'utf8'),
  ])
  assert.doesNotMatch(service, /createBusinessProfile|ensureBusinessProfile|addDoc|transaction\.set/)
  assert.match(editor, /editSupport\.supported/)
  const translations = JSON.parse(english)
  assert.doesNotMatch(translations.business.errors.ambiguous, /business-[a-z0-9]|auto-id/)
})
