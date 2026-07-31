import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { getRecoveryActionTranslationKey } from '../src/utils/frontendErrors.js'
import { authenticatedTranslations } from '../src/i18n/locales/authenticatedTranslations.js'

const source = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('workflow recovery values have action-specific translation labels', () => {
  assert.deepEqual(
    Object.fromEntries([
      'retry', 'sign-in', 'sign-out', 'verify-email', 'complete-profile',
      'refresh-account', 'edit-business', 'contact-support', 'back',
    ].map((recovery) => [recovery, getRecoveryActionTranslationKey(recovery)])),
    {
      back: 'messages.backToInbox',
      'complete-profile': 'profile.completion.title',
      'contact-support': 'workflow.actions.contactSupport',
      'edit-business': 'business.edit',
      'refresh-account': 'workflow.actions.refreshAccount',
      retry: 'common.retry',
      'sign-in': 'account.signIn',
      'sign-out': 'auth.logout',
      'verify-email': 'auth.verification.title',
    },
  )
})

test('new workflow action labels exist in every authenticated locale pack', () => {
  assert.equal(Object.keys(authenticatedTranslations).length, 17)
  for (const [locale, resource] of Object.entries(authenticatedTranslations)) {
    assert.ok(resource.workflow.actions.refreshAccount?.trim(), `${locale} refresh account`)
    assert.ok(resource.workflow.actions.contactSupport?.trim(), `${locale} contact support`)
  }
})

test('RecoveryMessage supports explicit pending actions without owning workflow logic', () => {
  const recoveryMessage = source('../src/components/common/RecoveryMessage.jsx')
  assert.match(recoveryMessage, /actionPending = false/)
  assert.match(recoveryMessage, /disabled=\{actionPending\}/)
  assert.match(recoveryMessage, /aria-busy=\{actionPending \|\| undefined\}/)
})

test('profile save and logout recovery no longer refresh the profile', () => {
  const profile = source('../src/pages/customer/ProfilePage.jsx')
  assert.match(profile, /setErrorOperation\('save'\)/)
  assert.match(profile, /setErrorOperation\('logout'\)/)
  assert.match(profile, /onAction=\{errorOperation === 'logout' \? \(\) => void handleLogout\(\) : undefined\}/)
  assert.doesNotMatch(profile, /errorOperation === 'save'.*refreshUserProfile/s)
})

test('verification and blocked-account sign-out failures are handled locally', () => {
  const verification = source('../src/pages/auth/VerificationPendingPage.jsx')
  const blocked = source('../src/components/common/BlockedAccountScreen.jsx')
  for (const contents of [verification, blocked]) {
    assert.match(contents, /await signOutUser\(\)/)
    assert.match(contents, /getAuthenticationErrorMessage\(/)
    assert.match(contents, /disabled=\{signingOut\}/)
  }
})

test('SubscriptionPage classifies owner-business workflow failures and executes mapped recovery', () => {
  const subscription = source('../src/pages/business/SubscriptionPage.jsx')
  assert.match(subscription, /classifyFrontendError\(loadError, \{\s*domain: 'workflow'/s)
  for (const recovery of ['verify-email', 'complete-profile', 'refresh-account', 'contact-support']) {
    assert.match(subscription, new RegExp(`recovery === '${recovery}'`))
  }
  assert.doesNotMatch(subscription, /getAuthenticationErrorMessage/)
  assert.doesNotMatch(subscription, /\.message\s*\|\|/)
})
