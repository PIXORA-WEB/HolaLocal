import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { protectedAccountDecision } from '../src/routes/accountRoutePolicy.js'

const directory = path.dirname(fileURLToPath(import.meta.url))
const source = (relative) => readFile(path.resolve(directory, relative), 'utf8')
const timestamp = { seconds: 1_700_000_000, nanoseconds: 0, toMillis: () => 1_700_000_000_000 }
const profile = (overrides = {}) => ({
  accountStatus: 'active', deletionRequestedAt: null,
  termsAccepted: true, termsAcceptedAt: timestamp, termsVersion: '1.0',
  privacyAccepted: true, privacyAcceptedAt: timestamp, privacyVersion: '1.0',
  profileCompleted: true, onboardingCompleted: true, ...overrides,
})
const decision = (userProfile, overrides = {}) => protectedAccountDecision({
  emailVerified: true, profileStatus: 'loaded', user: { uid: 'user-1' }, userProfile, ...overrides,
})

test('pending deletion precedes ordinary protected access but follows blocked status', () => {
  assert.equal(decision(profile({ deletionRequestedAt: timestamp })), 'account_deletion')
  assert.equal(decision(profile({ accountStatus: 'suspended', deletionRequestedAt: timestamp })), 'blocked')
  assert.equal(decision(profile({ deletionRequestedAt: timestamp }), { allowDeletionPending: true }), 'allow')
  assert.equal(decision(profile()), 'allow')
})

test('provider does not maintain a deletion-pending profile through denied generic writes', async () => {
  const provider = await source('../src/context/AuthenticationProvider.jsx')
  assert.match(provider, /existingProfile\?\.accountStatus === 'active'[\s\S]*?existingProfile\?\.deletionRequestedAt == null[\s\S]*?\? await ensureUserProfile\(user\)/)
})

test('account deletion route is a narrow pending-account exception', async () => {
  const [routes, protectedRoute, publicRoute] = await Promise.all([
    source('../src/routes/AppRoutes.jsx'), source('../src/routes/ProtectedRoute.jsx'), source('../src/routes/PublicRoute.jsx'),
  ])
  assert.match(routes, /path="account-deletion"/)
  assert.match(routes, /<ProtectedRoute allowDeletionPending allowIncompleteOnboarding allowIncompleteProfile allowMissingConsent allowUnverified \/>/)
  assert.match(protectedRoute, /decision === 'account_deletion'[\s\S]*?to="\/account-deletion"/)
  assert.match(publicRoute, /decision === 'account_deletion'[\s\S]*?to="\/account-deletion"/)
})

test('request UI reauthenticates, confirms, blocks owners, and never claims completion', async () => {
  const [profilePage, auth, service] = await Promise.all([
    source('../src/pages/customer/ProfilePage.jsx'), source('../src/firebase/auth.js'),
    source('../src/services/accountDeletionService.js'),
  ])
  assert.match(profilePage, /reauthenticateUserWithPassword\(user, deletionPassword\)/)
  assert.match(profilePage, /deletionConfirmed/)
  assert.match(profilePage, /accountDeletion\.request\.retainedRecords/)
  assert.match(profilePage, /<Link to="\/privacy">/)
  assert.match(profilePage, /result\?\.blocked && result\.reason === 'owned-businesses'/)
  assert.match(profilePage, /navigate\('\/account-deletion', \{ replace: true \}\)/)
  assert.match(auth, /reauthenticateWithCredential/)
  assert.match(auth, /getIdToken\(true\)/)
  assert.match(service, /requestAccountDeletionCallable\(\{\}\)/)
  assert.doesNotMatch(`${profilePage}\n${service}`, /deleteUser|cleanupUserMedia|completedAt|deletionScheduledFor/)
})

test('status page permits cancellation and logout without exposing administrator fields', async () => {
  const page = await source('../src/pages/customer/AccountDeletionPage.jsx')
  assert.match(page, /cancelAccountDeletion\(\)/)
  assert.match(page, /refreshUserProfile\(user\)/)
  assert.match(page, /navigate\('\/profile', \{ replace: true \}\)/)
  assert.match(page, /signOutUser\(\)/)
  assert.match(page, /to="\/privacy"/)
  assert.match(page, /to="\/contact"/)
  assert.doesNotMatch(page, /retryCount|lastErrorCode|requestedBy|administrator note/)
})

test('generic website profile writes exclude trusted deletion fields', async () => {
  const service = await source('../src/services/userService.js')
  const editable = service.match(/const editableProfileFields = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? ''
  for (const field of ['deletionRequestedAt', 'deletionScheduledFor', 'anonymizedAt', 'accountStatus']) {
    assert.equal(editable.includes(field), false)
  }
})

test('all supported locales define the complete account-deletion pack', async () => {
  const translations = await import('../src/i18n/accountDeletionTranslations.js')
  const english = await import('../src/i18n/deletionDisclosureEnglishTranslations.js')
  const expected = ['es','fr','de','nl','pt','it','pl','ro','cs','sk','hu','uk','sv','da','fi','no']
  assert.deepEqual(Object.keys(translations.accountDeletionTranslations).sort(), expected.sort())
  for (const locale of expected) {
    const pack = translations.accountDeletionTranslations[locale].accountDeletion
    assert.ok(pack.request.submit)
    assert.ok(pack.request.retainedRecords)
    assert.notEqual(pack.request.retainedRecords, english.deletionDisclosureEnglishTranslations.request)
    assert.ok(pack.request.ownedBusinessBlock.includes('{{count}}'))
    assert.ok(pack.status.cancel)
    assert.ok(pack.errors.recentAuth)
  }
})
