export const TEST_PROJECT_ID = 'demo-holalocal-admin-browser'
export const TEST_BUSINESS_ID = 'browser-smoke-business'
export const TEST_PASSWORD = 'BrowserSmoke!234'
export const TEST_LEGACY_MEDIA_TOKEN = '123e4567-e89b-42d3-a456-426614174000'
export const TEST_LEGACY_LOGO_PATH = `businesses/${TEST_BUSINESS_ID}/logos/logo.png`
export const TEST_LEGACY_GALLERY_PATH = `businesses/${TEST_BUSINESS_ID}/photos/gallery.png`

const productionStorageBucket = 'holalocal-491c9.firebasestorage.app'

export function testLegacyMediaUrl(storagePath) {
  return `https://firebasestorage.googleapis.com/v0/b/${productionStorageBucket}/o/${encodeURIComponent(storagePath)}?alt=media&token=${TEST_LEGACY_MEDIA_TOKEN}`
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
    claims: {},
  }),
})
