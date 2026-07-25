import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  resolveWebsiteBusinessLookup,
  isPublicBusinessEligible,
  toManagedBusinessView,
  toPublicBusinessView,
  toWebsiteUserProfile,
} from '../src/services/firebaseCompatibility.js'
import {
  businessCategoryOptions,
  countryOptions,
  getBusinessCategoryLabel,
  serviceAreaOptions,
} from '../src/utils/business.js'
import { supportedUILanguages } from '../src/utils/languages.js'
import {
  getServiceAreaGroupLabel,
  getServiceAreaLabel,
  serviceAreaGroupLabels,
  serviceAreaLabels,
} from '../src/utils/locations.js'
import { authenticatedTranslations } from '../src/i18n/locales/authenticatedTranslations.js'
import { mergeLocale } from '../src/i18n/locales/mergeLocale.js'

class TimestampFixture {
  toDate() { return new Date(0) }
}

const canonicalContact = {
  phone: '', phoneVisible: false, email: '', emailVisible: false,
  whatsappNumber: '', whatsappVisible: false, website: '', websiteVisible: false,
  preferredContactMethod: 'holalocal', allowCallbackRequests: false,
}

const jsonLocaleCodes = new Set(['en', 'es', 'fr', 'de', 'nl', 'pt'])
const localeRoot = new URL('../src/i18n/locales/', import.meta.url)

async function readJsonLocale(code) {
  return JSON.parse(await readFile(new URL(`${code}.json`, localeRoot), 'utf8'))
}

async function readBaseLocale(code, english) {
  if (jsonLocaleCodes.has(code)) return readJsonLocale(code)
  return english
}

function getPath(resource, key) {
  return key.split('.').reduce((current, part) => current?.[part], resource)
}

function translatorFor(resource) {
  return (key, options = {}) => {
    const value = getPath(resource, key)
    if (typeof value === 'string') return value
    return options.defaultValue ?? key
  }
}

function canonicalBusiness(overrides = {}) {
  return {
    ownerId: 'owner-1', managerIds: ['owner-1'], name: 'Canonical Business',
    description: 'A complete canonical business profile.',
    primaryCategoryId: 'cleaning', categoryIds: ['cleaning'], serviceAreas: ['marbella'],
    languages: ['en'], primaryLanguage: 'en', location: { locality: 'Marbella', region: 'Málaga', countryCode: 'ES' },
    contact: canonicalContact, status: 'draft', verificationStatus: 'unverified',
    subscription: { tier: 'free', status: 'none' }, profileCompleted: true,
    publishedAt: null,
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
  const raw = canonicalBusiness({ status: 'active', publishedAt: new TimestampFixture(), ratingAverage: 4.5, ratingCount: 2 })
  const managed = toManagedBusinessView('business-1', raw)
  const publicView = toPublicBusinessView('business-1', raw)
  assert.equal(isPublicBusinessEligible(raw), true)
  assert.equal(managed.name, 'Canonical Business')
  assert.equal(managed.businessId, 'business-1')
  assert.equal(publicView.name, 'Canonical Business')
  assert.equal(publicView.status, 'active')
  assert.equal(publicView.ratingAverage, 4.5)
})

test('public directory eligibility only allows active safe records', () => {
  for (const status of ['draft', 'pending_review', 'rejected', 'suspended', 'archived', 'deleted']) {
    const raw = canonicalBusiness({ status })
    assert.equal(isPublicBusinessEligible(raw), false)
    assert.equal(toPublicBusinessView(`business-${status}`, canonicalBusiness({ status })), null)
  }
  assert.equal(isPublicBusinessEligible(canonicalBusiness({
    status: 'active',
    publishedAt: new TimestampFixture(),
    deletedAt: new TimestampFixture(),
  })), false)
  assert.equal(isPublicBusinessEligible(canonicalBusiness({
    status: 'active',
    publishedAt: new TimestampFixture(),
    deletionRequestedAt: new TimestampFixture(),
  })), false)

  const activeLegacyShape = {
    ownerId: 'owner-1',
    managerIds: ['owner-1'],
    businessName: 'Legacy Named Business',
    mainCategory: 'Cleaning',
    subcategories: ['Cleaning'],
    serviceAreas: ['Málaga'],
    languages: ['English'],
    primaryLanguage: 'English',
    city: 'Málaga',
    status: 'active',
    publishedAt: new TimestampFixture(),
    verificationStatus: 'unverified',
    subscription: { tier: 'free', status: 'none' },
    isVerified: true,
    isPremium: true,
    email: 'private@example.invalid',
    contact: {
      ...canonicalContact,
      website: 'https://example.invalid',
      websiteVisible: false,
    },
  }
  const publicView = toPublicBusinessView('legacy-canonical-active', activeLegacyShape)
  assert.equal(publicView, null)
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
    status: 'active', publishedAt: new TimestampFixture(), contact: undefined, phone: '000000000', email: 'legacy@example.invalid',
  }))
  assert.equal(publicView, null)
})

test('public contact eligibility rejects hidden values and allows explicit visibility', () => {
  const hidden = toPublicBusinessView('business-hidden', canonicalBusiness({
    status: 'active',
    publishedAt: new TimestampFixture(),
    contact: {
      ...canonicalContact,
      phone: '000000000',
      email: 'owner@example.invalid',
      whatsappNumber: '111111111',
      website: 'https://example.invalid',
    },
  }))
  assert.equal(hidden, null)

  const visible = toPublicBusinessView('business-visible', canonicalBusiness({
    status: 'active',
    publishedAt: new TimestampFixture(),
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

test('business editor controlled option labels resolve for every supported locale', async () => {
  const [english, editor] = await Promise.all([
    readJsonLocale('en'),
    readFile(new URL('../src/pages/business/EditBusinessPage.jsx', import.meta.url), 'utf8'),
  ])
  const rawKeys = [
    'business.categories.cleaning',
    'locations.countries.ES',
    'locations.groups.malaga',
    'locations.groups.cadiz',
    'locations.groups.gibraltar',
    'locations.groups.other',
    'common.other',
  ]
  const categoryIds = businessCategoryOptions.map((option) => option.value)
  const countryIds = countryOptions.map((option) => option.value)
  const serviceAreaIds = serviceAreaOptions.map((option) => option.value)
  const serviceAreaGroups = [...new Set(serviceAreaOptions.map((option) => option.group))]

  assert.deepEqual(categoryIds, [
    'Cleaning', 'Plumbing', 'Electrical', 'Gardening', 'Painting & Decorating',
    'Building & Renovation', 'Handyman', 'Air Conditioning', 'Locksmith',
    'Pest Control', 'Pool Maintenance', 'Pet Services', 'Other',
  ])
  assert.deepEqual(countryIds, ['ES', 'GI'])
  assert.equal(serviceAreaIds.includes('marbella'), true)
  assert.equal(serviceAreaIds.includes('other'), true)

  for (const { code } of supportedUILanguages) {
    const baseLocale = await readBaseLocale(code, english)
    const resource = mergeLocale(
      english,
      baseLocale,
      authenticatedTranslations[code],
      { locations: { areas: serviceAreaLabels } },
    )
    const translate = translatorFor(resource)

    assert.equal(translate('common.other') === 'common.other', false, `${code}: common.other resolves`)
    for (const key of rawKeys) {
      assert.notEqual(translate(key), key, `${code}: ${key} resolves`)
    }
    for (const option of businessCategoryOptions) {
      assert.notEqual(getBusinessCategoryLabel(option.value, translate), option.labelKey, `${code}: ${option.labelKey}`)
    }
    for (const option of countryOptions) {
      assert.notEqual(translate(option.labelKey, { defaultValue: option.defaultLabel }), option.labelKey, `${code}: ${option.labelKey}`)
    }
    for (const group of serviceAreaGroups) {
      assert.notEqual(getServiceAreaGroupLabel(group, translate), `locations.groups.${group}`, `${code}: locations.groups.${group}`)
      assert.notEqual(getServiceAreaGroupLabel(group, translate), group, `${code}: group ${group} is not a raw id`)
    }
    for (const option of serviceAreaOptions) {
      assert.notEqual(getServiceAreaLabel(option.value, translate), option.labelKey, `${code}: ${option.labelKey}`)
    }
  }

  assert.doesNotMatch(editor, /label:\s*['"](?:Spain|Málaga|Cádiz|Gibraltar|Other)['"]/)
  assert.match(editor, /t\(country\.labelKey, \{ defaultValue: country\.defaultLabel \}\)/)
  assert.match(editor, /getServiceAreaGroupLabel\(area\.group, t\)/)
  assert.match(editor, /t\('common\.other', \{ defaultValue: 'Other' \}\)/)
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
  assert.equal(resolveWebsiteBusinessLookup({ ownerId: 'owner-1', uidInvalid: true }).lookup.status, 'invalid_mapping')
  const mismatch = resolveWebsiteBusinessLookup({
    ownerId: 'owner-1',
    pointerCandidate: { businessId: 'other-business', ownerId: 'other-owner', document: {} },
  })
  assert.equal(mismatch.lookup.status, 'owner_mismatch')
  assert.equal(mismatch.document, null)
})

test('lookup treats inaccessible speculative UID document as absent for new business users', () => {
  const result = resolveWebsiteBusinessLookup({
    ownerId: 'owner-1',
    pointerCandidate: null,
    uidCandidate: null,
    ownerCandidates: [],
    pointerInvalid: false,
    uidInvalid: false,
  })

  assert.equal(result.lookup.status, 'not_found')
  assert.equal(result.document, null)
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
  assert.match(businessService, /ensureOwnerBusinessCallable\(\)/)
  assert.match(businessService, /if \(privateContact\) safeUpdates\.contact = storedPublicContact\(privateContact\)/)
  assert.match(businessService, /websiteVisible: contact\.websiteVisible === true/)
  assert.doesNotMatch(userService, /transaction\.(?:set|update)\([^\n]*toWebsiteUserProfile/)
  assert.doesNotMatch(businessService, /transaction\.(?:set|update)\([^\n]*toManagedBusinessView/)
  assert.doesNotMatch(businessService, /transaction\.set\(reference/)
})

test('business creation uses the trusted callable without browser owner discovery', async () => {
  const businessService = await readFile(new URL('../src/services/businessService.js', import.meta.url), 'utf8')
  const createBusinessProfileSource = businessService.match(
    /export async function createBusinessProfile\(\) \{[\s\S]*?\n\}/,
  )?.[0] ?? ''
  const ensureBusinessProfileSource = businessService.match(
    /export async function ensureBusinessProfile\(ownerId, userProfile\) \{[\s\S]*?return createBusinessProfile\(\)\n\}/,
  )?.[0] ?? ''

  assert.match(businessService, /candidateById\(businessId, source, \{ missingIsInvalid = false, permissionDeniedIsInvalid = false \} = \{\}\)/)
  assert.match(businessService, /candidateById\(userBusinessId, 'user_business_id', \{\s*missingIsInvalid: true,\s*permissionDeniedIsInvalid: true,\s*\}\)/s)
  assert.match(businessService, /candidateById\(ownerId, 'owner_uid_document'\)/)
  assert.match(businessService, /if \(result\.lookup\.status === 'not_found'\) return null/)
  assert.match(createBusinessProfileSource, /const result = await ensureOwnerBusinessCallable\(\)/)
  assert.doesNotMatch(createBusinessProfileSource, /getBusinessByOwnerId\(/)
  assert.match(createBusinessProfileSource, /const businessId = result\.data\?\.businessId/)
  assert.match(createBusinessProfileSource, /if \(!businessId\) throw new Error\('Business profile could not be created\.'\)/)
  assert.match(createBusinessProfileSource, /return getManagedBusinessById\(businessId\)/)
  assert.match(ensureBusinessProfileSource, /if \(!userProfile\?\.roles\?\.includes\('business'\)\)/)
  assert.match(ensureBusinessProfileSource, /if \(userProfile\.businessId\) \{\s*const existingBusiness = await getManagedBusinessById\(userProfile\.businessId\)/s)
  assert.doesNotMatch(ensureBusinessProfileSource, /getBusinessByOwnerId\(|getManagedBusinessLookup\(/)
  assert.match(ensureBusinessProfileSource, /return createBusinessProfile\(\)/)
  assert.doesNotMatch(businessService, /addDoc\(|setDoc\(|doc\(collection\(db, 'businesses'\)\)/)
})

test('public directory uses the callable while exact public document reads stay direct', async () => {
  const [businessService, functionsClient, servicesPage] = await Promise.all([
    readFile(new URL('../src/services/businessService.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/firebase/functionsClient.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/ServicesPage.jsx', import.meta.url), 'utf8'),
  ])
  const activeDirectorySource = businessService.match(
    /export async function getActivePublicBusinesses\(maxResults = 60\) \{[\s\S]*?\n\}/,
  )?.[0] ?? ''
  const publicDetailSource = businessService.match(
    /export async function getPublicBusinessById\(businessId\) \{[\s\S]*?\n\}/,
  )?.[0] ?? ''

  assert.match(functionsClient, /httpsCallable\(functions, 'listPublicBusinesses'\)/)
  assert.match(activeDirectorySource, /listPublicBusinessesCallable\(\{ maxResults: resultLimit \}\)/)
  assert.doesNotMatch(activeDirectorySource, /collection\(db, 'businesses'\)|getDocs\(|where\(|orderBy\(/)
  assert.match(activeDirectorySource, /return Array\.isArray\(result\.data\?\.businesses\)/)
  assert.match(servicesPage, /setBusinesses\(activeBusinesses\)/)
  assert.match(servicesPage, /services\.emptyTitle/)

  assert.match(publicDetailSource, /getDoc\(businessDocument\(businessId\)\)/)
  assert.match(publicDetailSource, /toPublicBusiness\(snapshot\)/)
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
      firstName: accountType, lastName: 'User', displayName: `${accountType} User`,
      city: 'Marbella', country: 'Spain',
      onboardingCompleted: true,
    })
    assert.equal(profile.roles.includes('business'), hasBusiness)
    assert.equal(profile.profileCompleted, true)
    assert.equal(profile.onboardingCompleted, true)
  }
})
