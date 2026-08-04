export const TEST_PROJECT_ID = 'demo-holalocal-admin-browser'
export const TEST_BUSINESS_ID = 'browser-smoke-business'
export const TEST_PASSWORD = 'BrowserSmoke!234'

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
