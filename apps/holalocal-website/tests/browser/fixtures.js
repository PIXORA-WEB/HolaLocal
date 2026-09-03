export const TEST_PROJECT_ID = 'demo-holalocal-admin-browser'
export const TEST_BUSINESS_ID = 'browser-smoke-business'
export const TEST_PUBLIC_BUSINESS_IDS = Object.freeze([
  'browser-public-business-short',
  'browser-public-business-long',
])
export const TEST_PASSWORD = 'BrowserSmoke!234'
export const TEST_LEGACY_MEDIA_TOKEN = '123e4567-e89b-42d3-a456-426614174000'
export const TEST_STORAGE_EMULATOR_HOST = '127.0.0.1'
export const TEST_STORAGE_EMULATOR_PORT = '9199'
export const TEST_STORAGE_BUCKET = `${TEST_PROJECT_ID}.appspot.com`
export const TEST_LEGACY_LOGO_PATH = `businesses/${TEST_BUSINESS_ID}/logos/logo`
export const TEST_LEGACY_GALLERY_PATH = `businesses/${TEST_BUSINESS_ID}/photos/0`

const forbiddenStorageHosts = new Set([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
])

export function normalizeStorageEmulatorHost(value) {
  const legacyHost = `${TEST_STORAGE_EMULATOR_HOST}:${TEST_STORAGE_EMULATOR_PORT}`
  const candidate = value === legacyHost ? `http://${legacyHost}` : value
  let url

  try {
    url = new URL(candidate)
  } catch {
    throw new Error('Storage emulator host must be the fixed HTTP loopback endpoint.')
  }

  if (url.protocol !== 'http:'
    || url.hostname !== TEST_STORAGE_EMULATOR_HOST
    || url.port !== TEST_STORAGE_EMULATOR_PORT
    || url.username
    || url.password
    || url.pathname !== '/'
    || url.search
    || url.hash) {
    throw new Error('Storage emulator host must be the fixed HTTP loopback endpoint.')
  }

  return `http://${legacyHost}`
}

export function assertLoopbackFixtureMediaUrl(value, expectedStoragePath = null) {
  const url = new URL(value)
  if (forbiddenStorageHosts.has(url.hostname) || url.hostname.endsWith('.googleapis.com')) {
    throw new Error(`Fixture media URL uses a forbidden remote Storage host: ${url.hostname}`)
  }
  if (url.protocol !== 'http:'
    || !['127.0.0.1', 'localhost'].includes(url.hostname)
    || url.port !== TEST_STORAGE_EMULATOR_PORT) {
    throw new Error('Fixture media URLs must use the configured loopback Storage emulator.')
  }
  const prefix = `/v0/b/${TEST_STORAGE_BUCKET}/o/`
  if (!url.pathname.startsWith(prefix) || url.searchParams.get('alt') !== 'media') {
    throw new Error('Fixture media URL does not use the Storage emulator media-download format.')
  }
  const encodedPath = url.pathname.slice(prefix.length)
  if (!encodedPath || encodeURIComponent(decodeURIComponent(encodedPath)) !== encodedPath) {
    throw new Error('Fixture media URL object path must be URL encoded.')
  }
  if (expectedStoragePath && decodeURIComponent(encodedPath) !== expectedStoragePath) {
    throw new Error('Fixture media URL does not match its expected Storage object path.')
  }
  return value
}

export function testLegacyMediaUrl(storagePath) {
  const encodedPath = encodeURIComponent(storagePath)
  const url = `http://${TEST_STORAGE_EMULATOR_HOST}:${TEST_STORAGE_EMULATOR_PORT}/v0/b/${TEST_STORAGE_BUCKET}/o/${encodedPath}?alt=media&token=${TEST_LEGACY_MEDIA_TOKEN}`
  return assertLoopbackFixtureMediaUrl(url, storagePath)
}

export const TEST_LEGACY_LOGO_URL = testLegacyMediaUrl(TEST_LEGACY_LOGO_PATH)
export const TEST_LEGACY_GALLERY_URL = testLegacyMediaUrl(TEST_LEGACY_GALLERY_PATH)

export const TEST_USERS = Object.freeze({
  admin: Object.freeze({
    uid: 'browser-admin',
    email: 'admin.browser@example.invalid',
    displayName: 'Browser Administrator',
    preferredLocale: 'en',
    claims: { admin: true },
  }),
  adminTwo: Object.freeze({
    uid: 'browser-admin-two',
    email: 'admin.two.browser@example.invalid',
    displayName: 'Second Browser Administrator',
    preferredLocale: 'en',
    claims: { admin: true },
  }),
  moderator: Object.freeze({
    uid: 'browser-moderator',
    email: 'moderator.browser@example.invalid',
    displayName: 'Browser Moderator',
    preferredLocale: 'en',
    claims: { moderator: true },
  }),
  customer: Object.freeze({
    uid: 'browser-customer',
    email: 'customer.browser@example.invalid',
    displayName: 'Browser Customer',
    preferredLocale: 'en',
    claims: {},
  }),
  owner: Object.freeze({
    uid: 'browser-owner',
    email: 'owner.browser@example.invalid',
    displayName: 'Browser Owner',
    preferredLocale: 'es',
    businessId: TEST_BUSINESS_ID,
    claims: {},
  }),
  publicShortOwner: Object.freeze({
    uid: 'browser-public-owner-short',
    email: 'public.short.browser@example.invalid',
    displayName: 'Synthetic Short Owner',
    preferredLocale: 'en',
    businessId: TEST_PUBLIC_BUSINESS_IDS[0],
    claims: {},
  }),
  publicLongOwner: Object.freeze({
    uid: 'browser-public-owner-long',
    email: 'public.long.browser@example.invalid',
    displayName: 'Synthetic Long Owner',
    preferredLocale: 'en',
    businessId: TEST_PUBLIC_BUSINESS_IDS[1],
    claims: {},
  }),
})

export const TEST_PUBLIC_BUSINESSES = Object.freeze([
  Object.freeze({
    businessId: TEST_PUBLIC_BUSINESS_IDS[0],
    ownerId: TEST_USERS.publicShortOwner.uid,
    name: 'QA Quick Clean',
    nameNormalized: 'qa quick clean',
    slug: 'qa-quick-clean',
    tagline: 'Synthetic local cleaning fixture',
    description: 'Synthetic cleaning services for isolated browser QA.',
    primaryCategoryId: 'cleaner',
    categoryIds: Object.freeze(['cleaner']),
    serviceAreas: Object.freeze(['marbella']),
    location: Object.freeze({ locality: 'Marbella', region: 'Málaga', countryCode: 'ES' }),
    languages: Object.freeze(['en', 'es']),
    primaryLanguage: 'en',
    ratingAverage: 4.7,
    ratingCount: 18,
    verificationStatus: 'verified',
    logoStoragePath: `businesses/${TEST_PUBLIC_BUSINESS_IDS[0]}/logos/logo`,
    galleryStoragePaths: Object.freeze([`businesses/${TEST_PUBLIC_BUSINESS_IDS[0]}/photos/0`]),
  }),
  Object.freeze({
    businessId: TEST_PUBLIC_BUSINESS_IDS[1],
    ownerId: TEST_USERS.publicLongOwner.uid,
    name: 'QA Multilingual Home and Garden Services Collective',
    nameNormalized: 'qa multilingual home and garden services collective',
    slug: 'qa-multilingual-home-garden-services',
    tagline: 'Synthetic multi-service fixture for responsive browser checks',
    description: 'A deliberately longer synthetic profile offering cleaning, gardening and property maintenance information across several local service areas for isolated responsive-layout QA.',
    primaryCategoryId: 'gardener',
    categoryIds: Object.freeze(['gardener', 'cleaner', 'handyman']),
    serviceAreas: Object.freeze(['estepona', 'fuengirola', 'marbella']),
    location: Object.freeze({ locality: 'Estepona', region: 'Málaga', countryCode: 'ES' }),
    languages: Object.freeze(['en', 'de', 'uk', 'es']),
    primaryLanguage: 'en',
    ratingAverage: 3.9,
    ratingCount: 127,
    verificationStatus: 'verified',
    logoStoragePath: `businesses/${TEST_PUBLIC_BUSINESS_IDS[1]}/logos/logo`,
    galleryStoragePaths: Object.freeze([`businesses/${TEST_PUBLIC_BUSINESS_IDS[1]}/photos/0`]),
  }),
])
