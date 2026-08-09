import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { Timestamp } from 'firebase/firestore'
import {
  authenticatedPublicDecision,
  protectedAccountDecision,
} from '../src/routes/accountRoutePolicy.js'
import { internalPathFromLocation } from '../src/utils/internalNavigation.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const timestamp = { seconds: 1_700_000_000, nanoseconds: 0, toMillis: () => 1_700_000_000_000 }

function profile(overrides = {}) {
  return {
    accountStatus: 'active',
    deletionRequestedAt: null,
    termsAccepted: true,
    termsAcceptedAt: timestamp,
    termsVersion: '1.0',
    privacyAccepted: true,
    privacyAcceptedAt: timestamp,
    privacyVersion: '1.0',
    profileCompleted: true,
    onboardingCompleted: true,
    ...overrides,
  }
}

function decision(userProfile, overrides = {}) {
  return protectedAccountDecision({
    emailVerified: true,
    profileStatus: userProfile ? 'loaded' : 'absent',
    user: { uid: 'user-1' },
    userProfile,
    ...overrides,
  })
}

test('current consent proceeds while missing partial malformed and outdated states recover', () => {
  assert.equal(decision(profile()), 'allow')
  const genuineTimestamp = Timestamp.fromMillis(1_700_000_000_123)
  assert.equal(decision(profile({
    termsAcceptedAt: genuineTimestamp,
    privacyAcceptedAt: genuineTimestamp,
  })), 'allow')
  for (const overrides of [
    { termsAccepted: undefined }, { privacyAccepted: false },
    { termsAccepted: 'true' }, { privacyAcceptedAt: null },
    { termsAcceptedAt: 'client-time' }, { termsVersion: undefined },
    { privacyVersion: undefined }, { termsVersion: '0.9' }, { privacyVersion: '0.9' },
  ]) assert.equal(decision(profile(overrides)), 'legal_consent')
  assert.equal(decision(null), 'legal_consent')
})

test('guard priority is blocked then verification then consent then profile and onboarding', () => {
  assert.equal(decision(profile({ accountStatus: 'suspended', termsAccepted: false }), { emailVerified: false }), 'blocked')
  assert.equal(decision(profile({ termsAccepted: false }), { emailVerified: false }), 'verify_email')
  assert.equal(decision(profile({ termsAccepted: false, profileCompleted: false })), 'legal_consent')
  assert.equal(decision(profile({ profileCompleted: false })), 'complete_profile')
  assert.equal(decision(profile({ onboardingCompleted: false })), 'onboarding')
})

test('legal consent and verification routes bypass only their own prerequisite', () => {
  const recovery = { allowMissingConsent: true, allowIncompleteProfile: true, allowIncompleteOnboarding: true }
  assert.equal(decision(null, recovery), 'allow')
  assert.equal(decision(null, { ...recovery, emailVerified: false }), 'verify_email')
  assert.equal(decision(null, { ...recovery, allowUnverified: true, emailVerified: false }), 'allow')
})

test('authenticated public routes cannot bypass consent recovery', () => {
  assert.equal(authenticatedPublicDecision({
    emailVerified: true,
    profileStatus: 'loaded',
    user: { uid: 'user-1' },
    userProfile: profile({ privacyVersion: '0.9' }),
  }), 'legal_consent')
})

test('intended destinations are internal-only and preserve search and hash', () => {
  assert.equal(internalPathFromLocation({ pathname: '/messages', search: '?view=all', hash: '#latest' }), '/messages?view=all#latest')
  assert.equal(internalPathFromLocation({ pathname: '//evil.example/path' }), '/')
  assert.equal(internalPathFromLocation({ pathname: 'https://evil.example' }), '/')
})

test('intended destinations reject protocol backslash encoding and parsing attacks', () => {
  for (const pathname of ['/messages', '/services', '/profile/settings']) {
    const accepted = internalPathFromLocation({ pathname })
    assert.equal(new URL(accepted, 'https://www.holalocal.es').origin, 'https://www.holalocal.es')
    assert.equal(accepted, pathname)
  }
  assert.equal(internalPathFromLocation({ pathname: '/messages', search: '?x=1', hash: '#test' }), '/messages?x=1#test')

  for (const pathname of [
    '//', '//evil.example', ' //evil.example', 'https://evil.example', 'http://evil.example',
    'javascript:alert(1)', 'data:text/html,test', '/\\evil.example', '/\\\\evil.example',
    '\\evil.example', '\\\\evil.example', '/%5cevil.example', '/%5C%5Cevil.example',
    '/%2f%2fevil.example', '/%2F%5Cevil.example', '/%E0%A4%A',
  ]) assert.equal(internalPathFromLocation({ pathname }), '/')
})

test('verified Auth-only login skips legacy profile creation and follows recovery ordering', async () => {
  const { shouldMaintainProfileAfterLogin } = await import('../src/firebase/loginProfilePolicy.js')
  const authSource = await readFile(path.resolve(__dirname, '../src/firebase/auth.js'), 'utf8')
  const login = authSource.slice(
    authSource.indexOf('export async function loginUser'),
    authSource.indexOf('export async function logoutUser'),
  )
  assert.match(login, /shouldMaintainProfileAfterLogin\(existingProfile\)/)
  assert.doesNotMatch(login, /!existingProfile/)
  assert.equal(shouldMaintainProfileAfterLogin(null), false)
  assert.equal(shouldMaintainProfileAfterLogin(undefined), false)
  assert.equal(shouldMaintainProfileAfterLogin(profile()), true)
  assert.equal(decision(null), 'legal_consent')
  assert.equal(decision(null, { emailVerified: false }), 'verify_email')
  assert.equal(decision(profile({ profileCompleted: false })), 'complete_profile')
})

test('admin routes compose shared account safety with existing claim authorization', async () => {
  const { hasAdminAccessClaim } = await import('../src/routes/adminAccessPolicy.js')
  const routes = await readFile(path.resolve(__dirname, '../src/routes/AppRoutes.jsx'), 'utf8')
  const adminRoute = await readFile(path.resolve(__dirname, '../src/routes/AdminRoute.jsx'), 'utf8')
  assert.match(routes, /<Route element=\{<ProtectedRoute allowIncompleteOnboarding allowIncompleteProfile \/>\}>\s*<Route element=\{<AdminRoute \/>\}>\s*<Route path="admin"/s)
  assert.match(adminRoute, /hasAdminAccessClaim\(token\.claims\)/)
  assert.equal(hasAdminAccessClaim({}), false)
  assert.equal(hasAdminAccessClaim({ roles: ['admin'] }), false)
  assert.equal(hasAdminAccessClaim({ admin: true }), true)
  assert.equal(hasAdminAccessClaim({ moderator: true }), true)
  assert.equal(decision(profile({ termsVersion: '0.9' }), { allowIncompleteOnboarding: true, allowIncompleteProfile: true }), 'legal_consent')
  assert.equal(decision(profile(), { allowIncompleteOnboarding: true, allowIncompleteProfile: true, emailVerified: false }), 'verify_email')
  for (const accountStatus of ['suspended', 'deletion_pending', 'deleted']) {
    assert.equal(decision(profile({ accountStatus }), { allowIncompleteOnboarding: true, allowIncompleteProfile: true }), 'blocked')
  }
  assert.equal(decision(profile({ deletionRequestedAt: timestamp }), { allowIncompleteOnboarding: true, allowIncompleteProfile: true }), 'blocked')
  assert.equal(decision(profile(), { allowIncompleteOnboarding: true, allowIncompleteProfile: true }), 'allow')
})

test('email verification profile completion and onboarding preserve the intended route', async () => {
  const verification = await readFile(path.resolve(__dirname, '../src/pages/auth/VerificationPendingPage.jsx'), 'utf8')
  const completion = await readFile(path.resolve(__dirname, '../src/pages/auth/CompleteProfilePage.jsx'), 'utf8')
  const onboarding = await readFile(path.resolve(__dirname, '../src/pages/auth/OnboardingPage.jsx'), 'utf8')
  assert.match(verification, /state: \{ from: location\.state\?\.from \}/)
  assert.match(completion, /state: \{ from: location\.state\?\.from \}/)
  assert.match(onboarding, /internalPathFromLocation\(location\.state\?\.from, fallback\)/)
})

test('legal consent UI is explicit accessible and does not precheck acknowledgements', async () => {
  const source = await readFile(path.resolve(__dirname, '../src/pages/auth/LegalConsentPage.jsx'), 'utf8')
  const routes = await readFile(path.resolve(__dirname, '../src/routes/AppRoutes.jsx'), 'utf8')
  const functionsClient = await readFile(path.resolve(__dirname, '../src/firebase/functionsClient.js'), 'utf8')

  assert.match(routes, /path="legal-consent"/)
  assert.match(routes, /allowMissingConsent/)
  assert.match(source, /<fieldset/)
  assert.match(source, /<legend>/)
  assert.match(source, /type="checkbox"/)
  assert.doesNotMatch(source, /defaultChecked|useState\(true\)/)
  assert.match(source, /to="\/terms"/)
  assert.match(source, /to="\/privacy"/)
  assert.match(source, /event\.stopPropagation\(\)/)
  assert.match(source, /role="alert"/)
  assert.match(source, /\.focus\(\)/)
  assert.match(source, /signOutUser/)
  assert.match(functionsClient, /httpsCallable\(functions, 'acceptLegalConsent'\)/)
})

test('successful consent refreshes provider state before recovery navigation', async () => {
  const provider = await readFile(path.resolve(__dirname, '../src/context/AuthenticationProvider.jsx'), 'utf8')
  const page = await readFile(path.resolve(__dirname, '../src/pages/auth/LegalConsentPage.jsx'), 'utf8')
  const callableIndex = provider.indexOf('const response = await acceptLegalConsentCallable')
  const refreshIndex = provider.indexOf('const profile = await refreshUserProfile(user)', callableIndex)
  const returnIndex = provider.indexOf('return { consent: response.data, profile }', refreshIndex)
  assert.ok(callableIndex >= 0 && refreshIndex > callableIndex && returnIndex > refreshIndex)
  assert.match(page, /const \{ profile \} = await acceptLegalConsent\(\)[\s\S]*?navigate\(nextAccountPath\(profile, intended\)/)
  assert.match(page, /if \(profile\?\.profileCompleted !== true\) return '\/complete-profile'/)
  assert.match(page, /if \(profile\?\.onboardingCompleted !== true\) return '\/onboarding'/)
})

test('ordinary profile sanitization excludes all consent evidence fields', async () => {
  const source = await readFile(path.resolve(__dirname, '../src/services/userService.js'), 'utf8')
  const editableMatch = source.match(/const editableProfileFields = new Set\(\[([\s\S]*?)\]\)/)
  assert.ok(editableMatch)
  for (const field of ['termsAccepted', 'termsAcceptedAt', 'termsVersion', 'privacyAccepted', 'privacyAcceptedAt', 'privacyVersion']) {
    assert.equal(editableMatch[1].includes(field), false)
  }
  assert.doesNotMatch(source, /completeAbsentUserProfile[\s\S]*?transaction\.set/)
})
