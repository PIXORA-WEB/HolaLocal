import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { toMobileUserProfile } from '../src/services/userCompatibility.js'
import { toWebsiteUserProfile } from '../../holalocal-website/src/services/firebaseCompatibility.js'
import { completeRegistration } from '../src/firebase/registrationFlow.js'
import { protectedAccountDecision, publicAccountDestination } from '../src/routes/accountRoutePolicy.js'
import { hasCompleteUserProfile } from '@holalocal/firebase-contract'
import {
  POLICY_VERSION,
  buildProfileUpdates,
  buildRegistrationProfile,
  resolveRegistrationLocale,
} from '../src/services/userPayloads.js'
import { getAuthenticatedUiLanguage, getLanguageDisplayName } from '../src/utils/languages.js'

class TimestampFixture { toDate() { return new Date(0) } }
const timestamp = Object.freeze(new TimestampFixture())
const fakeTimestamp = () => timestamp

test('canonical and legacy user reads preserve trust boundaries', () => {
  const canonical = {
    uid: 'canonical', roles: ['customer'], accountType: 'customer', preferredLocale: 'es',
    accountStatus: 'active', createdAt: timestamp, isVerified: true, isPremium: true,
  }
  const before = { ...canonical }
  const view = toMobileUserProfile('canonical', canonical)
  assert.deepEqual(view.roles, ['customer'])
  assert.equal(view.preferredLocale, 'es')
  assert.equal(view.createdAt, timestamp)
  assert.equal('isVerified' in view, false)
  assert.equal('isPremium' in view, false)
  assert.deepEqual(canonical, before)

  const legacy = toMobileUserProfile('legacy', {
    accountType: 'business', preferredLanguage: 'Deutsch', isVerified: true,
    isPremium: true, deletedAt: timestamp,
  })
  assert.deepEqual(legacy.roles, ['business'])
  assert.equal(legacy.preferredLocale, 'de')
  assert.equal(legacy.compatibility.writeSafe, false)
})

test('canonical roles win conflicts', () => {
  const view = toMobileUserProfile('conflict', {
    roles: ['customer'], accountType: 'both', preferredLocale: 'en', accountStatus: 'active',
  })
  assert.deepEqual(view.roles, ['customer'])
  assert.equal(view.accountType, 'customer')
})

test('registration payload is explicit and rule-compatible', () => {
  const payload = buildRegistrationProfile('user-1', {
    email: 'synthetic@example.invalid', password: 'must-not-leak', surprise: true,
    termsAccepted: true, termsVersion: POLICY_VERSION,
    privacyAccepted: true, privacyVersion: POLICY_VERSION,
  }, fakeTimestamp)
  assert.equal(payload.uid, 'user-1')
  assert.deepEqual(payload.roles, ['customer'])
  assert.equal(payload.accountStatus, 'active')
  assert.equal(payload.preferredLocale, 'en')
  assert.equal(payload.termsVersion, '1.0')
  assert.equal(payload.termsAcceptedAt, timestamp)
  assert.equal(payload.businessId, null)
  for (const field of ['password', 'surprise', 'isVerified', 'isPremium', 'preferredLanguage', 'deletedAt']) {
    assert.equal(field in payload, false)
  }
})

test('registration preserves supported locales and explicitly handles invalid values', () => {
  for (const locale of ['es', 'uk']) {
    const payload = buildRegistrationProfile(`user-${locale}`, {
      preferredLocale: locale, termsAccepted: true, termsVersion: POLICY_VERSION,
      privacyAccepted: true, privacyVersion: POLICY_VERSION,
    }, fakeTimestamp)
    assert.equal(payload.preferredLocale, locale)
  }
  assert.equal(resolveRegistrationLocale('not-a-language').locale, 'en')
  assert.ok(resolveRegistrationLocale('not-a-language').issue)
  assert.deepEqual(resolveRegistrationLocale(null), { locale: 'en', issue: null })
})

test('profile builder rejects legacy or trusted fields', () => {
  assert.deepEqual(buildProfileUpdates({
    displayName: ' Test User ', preferredLocale: 'uk', isVerified: true,
    isPremium: true, businessId: 'forbidden', businessProfileCompleted: true, deletedAt: timestamp,
  }), {
    displayName: ' Test User ', displayNameNormalized: 'test user', preferredLocale: 'uk',
  })
  assert.throws(() => buildProfileUpdates({ preferredLocale: 'English' }))
  assert.throws(() => buildProfileUpdates({ compatibility: { writeSafe: false } }))
})

test('website and mobile derive profile completion from the same canonical fields', () => {
  const staleComplete = {
    uid: 'user-1',
    roles: ['customer'],
    accountType: 'customer',
    accountStatus: 'active',
    profileCompleted: true,
    firstName: '',
    lastName: 'Customer',
    displayName: 'Customer',
    preferredLocale: 'en',
    city: 'Marbella',
    country: 'Spain',
  }
  assert.equal(hasCompleteUserProfile(staleComplete), false)
  assert.equal(toMobileUserProfile('user-1', staleComplete).profileCompleted, false)
  assert.equal(toWebsiteUserProfile('user-1', staleComplete).profileCompleted, false)
  const complete = { ...staleComplete, firstName: 'Casey' }
  assert.equal(toMobileUserProfile('user-1', complete).profileCompleted, true)
  assert.equal(toWebsiteUserProfile('user-1', complete).profileCompleted, true)
})

test('verification is Auth-based and business creation remains disabled', async () => {
  const [authSource, businessSource, editSource] = await Promise.all([
    readFile(new URL('../src/firebase/auth.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/businessService.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/business/EditBusinessPage.jsx', import.meta.url), 'utf8'),
  ])
  assert.match(authSource, /sendEmailVerification\(user/)
  assert.match(authSource, /reload\(user\)/)
  assert.doesNotMatch(authSource, /isVerified/)
  assert.doesNotMatch(businessSource, /createBusinessProfile|ensureBusinessProfile|transaction\.set/)
  assert.doesNotMatch(editSource, /createBusinessProfile/)
})

test('registration profile failure is cleaned up and never sends verification', async () => {
  const calls = []
  await assert.rejects(completeRegistration({
    createAuthenticationUser: async () => ({ user: { uid: 'synthetic-user' } }),
    createProfile: async () => { calls.push('profile'); throw new Error('profile failed') },
    deleteAuthenticationUser: async () => { calls.push('cleanup') },
    email: 'synthetic@example.invalid', password: 'secret-not-logged', policyConsent: {},
    sendVerification: async () => { calls.push('verification') },
  }), /profile failed/)
  assert.deepEqual(calls, ['profile', 'cleanup'])
})

test('successful registration sends one verification request', async () => {
  let sends = 0
  const result = await completeRegistration({
    createAuthenticationUser: async () => ({ user: { uid: 'synthetic-user' } }),
    createProfile: async () => undefined,
    deleteAuthenticationUser: async () => undefined,
    email: 'synthetic@example.invalid', password: 'secret-not-logged', policyConsent: {},
    sendVerification: async () => { sends += 1 },
  })
  assert.equal(sends, 1)
  assert.equal(result.verificationEmailSent, true)
})

test('Auth verification and account status guards cannot be bypassed by legacy fields', () => {
  const base = {
    user: { uid: 'user-1' }, userProfile: {
      accountStatus: 'active', profileCompleted: false, onboardingCompleted: false,
      isVerified: true,
    },
  }
  assert.equal(protectedAccountDecision({ ...base, emailVerified: false }), 'verify_email')
  assert.equal(protectedAccountDecision({ ...base, emailVerified: true }), 'complete_profile')
  for (const accountStatus of ['suspended', 'deletion_pending', 'deleted']) {
    assert.equal(protectedAccountDecision({
      ...base, emailVerified: true, userProfile: { ...base.userProfile, accountStatus },
    }), 'blocked')
  }
  assert.equal(publicAccountDestination({ emailVerified: false, userProfile: base.userProfile }), '/verify-email')
  assert.equal(publicAccountDestination({ emailVerified: true, userProfile: base.userProfile }), '/complete-profile')
})

test('authenticated locale remains authoritative over stale local state', () => {
  const profile = toMobileUserProfile('locale-user', {
    roles: ['customer'], preferredLocale: 'fr', accountStatus: 'active',
  })
  const staleLocalLocale = 'es'
  assert.equal(profile.preferredLocale, 'fr')
  assert.notEqual(profile.preferredLocale, staleLocalLocale)
  assert.equal(getAuthenticatedUiLanguage(profile.preferredLocale), 'fr')
  assert.equal(getAuthenticatedUiLanguage('uk'), 'en')
})

test('language names have deterministic English fallback without Intl.DisplayNames', () => {
  assert.equal(getLanguageDisplayName('uk', 'invalid_locale_!'), 'Ukrainian')
})

test('login and password reset continue using Firebase Auth operations', async () => {
  const authSource = await readFile(new URL('../src/firebase/auth.js', import.meta.url), 'utf8')
  assert.match(authSource, /signInWithEmailAndPassword\(auth, email, password\)/)
  assert.match(authSource, /sendPasswordResetEmail\(auth, email\)/)
})

test('mobile account type changes use trusted callable instead of direct role writes', async () => {
  const [serviceSource, payloadSource, onboardingSource, dashboardSource, businessServiceSource] = await Promise.all([
    readFile(new URL('../src/services/userService.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/userPayloads.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/auth/OnboardingPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/business/BusinessDashboardPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/businessService.js', import.meta.url), 'utf8'),
  ])
  assert.match(serviceSource, /httpsCallable\(functions, 'updateAccountRole'\)/)
  assert.match(onboardingSource, /navigate\(requiresBusinessProfile \? '\/business\/dashboard' : '\/profile'/)
  assert.match(dashboardSource, /business\.setupDeferred\.title/)
  assert.match(dashboardSource, /if \(!businessProfile\)/)
  assert.doesNotMatch(businessServiceSource, /createBusinessProfile|ensureBusinessProfile|transaction\.set/)
  assert.doesNotMatch(payloadSource, /buildRoleUpdates/)
  assert.doesNotMatch(payloadSource, /validateRoles/)
})
