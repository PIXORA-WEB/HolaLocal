import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { authenticatedTranslations } from '../src/i18n/locales/authenticatedTranslations.js'
import {
  classifyFrontendError,
  createApplicationError,
} from '../src/utils/frontendErrors.js'
import {
  isOwnerEditableBusinessStatus,
  OWNER_EDITABLE_BUSINESS_STATUSES,
} from '../src/utils/business.js'

const websiteRoot = new URL('../', import.meta.url)
const repoRoot = new URL('../../../', import.meta.url)

async function source(relativePath, root = websiteRoot) {
  return readFile(new URL(relativePath, root), 'utf8')
}

test('workflow classifier maps confirmed callable reasons without exposing details', () => {
  const fixtures = [
    [{ code: 'functions/failed-precondition', message: 'email-verification-required' }, 'AUTH_EMAIL_NOT_VERIFIED', 'verify-email'],
    [{ code: 'functions/unauthenticated', message: 'Cloud Run europe-west1 updateAccountRole' }, 'AUTH_SESSION_EXPIRED', 'sign-in'],
    [{ code: 'functions/failed-precondition', details: { reason: 'account-not-active', uid: 'example-user' } }, 'ACCOUNT_NOT_ACTIVE', 'sign-out'],
    [{ code: 'functions/failed-precondition', message: 'profile-incomplete' }, 'ACCOUNT_PROFILE_INCOMPLETE', 'complete-profile'],
    [{ code: 'functions/failed-precondition', message: 'profile-not-found' }, 'ACCOUNT_PROFILE_NOT_FOUND', 'refresh-account'],
    [{ code: 'functions/failed-precondition', message: 'business-account-active' }, 'BUSINESS_ROLE_CONFLICT', 'refresh-account'],
    [{ code: 'business/ambiguous-ownership', message: 'businesses/example-business' }, 'BUSINESS_OWNERSHIP_CONFLICT', 'contact-support'],
    [{ code: 'functions/failed-precondition', message: 'business-pointer-conflict' }, 'BUSINESS_OWNERSHIP_CONFLICT', 'contact-support'],
    [createApplicationError('business-create-failed'), 'BUSINESS_CREATE_FAILED', 'retry'],
  ]

  for (const [error, type, recovery] of fixtures) {
    const result = classifyFrontendError(error, {
      domain: 'workflow',
      fallbackType: 'BUSINESS_CREATE_FAILED',
    })
    assert.equal(result.type, type)
    assert.equal(result.recovery, recovery)
    assert.deepEqual(Object.keys(result).sort(), ['recovery', 'translationKey', 'type'])
    assert.doesNotMatch(
      JSON.stringify(result),
      /example-user|example-business|businesses\/|Cloud Run|updateAccountRole|failed-precondition/,
    )
  }
})

test('submission mapper distinguishes local eligibility, Firestore, and unknown failures', () => {
  const fixtures = [
    [createApplicationError('business-submit-incomplete'), 'BUSINESS_SUBMIT_INCOMPLETE'],
    [createApplicationError('business-submit-invalid-state'), 'BUSINESS_SUBMIT_INVALID_STATE'],
    [createApplicationError('business-submit-not-found'), 'BUSINESS_SUBMIT_INVALID_STATE'],
    [{ code: 'firestore/permission-denied', message: 'businesses/example-business ownerId' }, 'BUSINESS_SUBMIT_PERMISSION_DENIED'],
    [{ code: 'firestore/unavailable', message: 'project/example database unavailable' }, 'NETWORK_UNAVAILABLE'],
    [new Error('Transaction failed at businesses/example-business with uid example-user'), 'BUSINESS_SUBMIT_FAILED'],
  ]

  for (const [error, type] of fixtures) {
    const result = classifyFrontendError(error, {
      domain: 'workflow',
      operation: 'submit-business',
      fallbackType: 'BUSINESS_SUBMIT_FAILED',
    })
    assert.equal(result.type, type)
    assert.doesNotMatch(
      JSON.stringify(result),
      /businesses\/|example-business|example-user|ownerId|project\/example|Transaction failed/,
    )
  }
})

test('active pages use mapped workflow errors and never render raw exception messages', async () => {
  const [dashboard, editor, profile, onboarding] = await Promise.all([
    source('src/pages/business/BusinessDashboardPage.jsx'),
    source('src/pages/business/EditBusinessPage.jsx'),
    source('src/pages/customer/ProfilePage.jsx'),
    source('src/pages/auth/OnboardingPage.jsx'),
  ])

  for (const page of [dashboard, editor, profile, onboarding]) {
    assert.match(page, /classifyFrontendError\(/)
    assert.doesNotMatch(page, /(?:submissionError|loadError|upgradeError)\.message/)
    assert.doesNotMatch(page, /\.message\s*\|\|\s*t\(/)
  }

  assert.match(dashboard, /fallbackType: 'BUSINESS_SUBMIT_FAILED'/)
  const submitHandler = dashboard.slice(
    dashboard.indexOf('async function handleSubmitForReview()'),
    dashboard.indexOf('async function retrySubscriptionProjection()'),
  )
  assert.match(submitHandler, /const submittedBusiness = await submitBusinessForReview\(businessProfile\.businessId\)/)
  assert.match(submitHandler, /setBusinessProfile\(\{/)
  assert.match(submitHandler, /\.\.\.submittedBusiness/)
  assert.match(submitHandler, /entitlements: businessProfile\.entitlements/)
  assert.ok(
    submitHandler.indexOf("setSubmitSuccess(t('business.control.submitSuccess'))")
      > submitHandler.indexOf('setBusinessProfile({'),
    'submission success must be shown only after the returned business state is applied',
  )
  assert.match(submitHandler, /classifyFrontendError\(submissionError, \{/)
  assert.doesNotMatch(submitHandler, /submissionError\.message|\.message\s*\|\|\s*t\(/)
  assert.match(editor, /fallbackType: 'BUSINESS_CREATE_FAILED'/)
  assert.match(profile, /fallbackType: 'ACCOUNT_TRANSITION_FAILED'/)
  assert.match(onboarding, /fallbackType: 'ACCOUNT_TRANSITION_FAILED'/)
})

test('service conditions use stable local reasons without changing transaction writes', async () => {
  const service = await source('src/services/businessService.js')

  assert.match(service, /createApplicationError\('business-create-failed'\)/)
  assert.match(service, /createApplicationError\('business-submit-not-found'\)/)
  assert.match(service, /createApplicationError\('business-submit-invalid-state'\)/)
  assert.match(service, /createApplicationError\('business-submit-incomplete'\)/)
  assert.match(service, /if \(!isOwnerEditableBusinessStatus\(business\.status\)\)/)
  assert.match(service, /status: 'pending_review'/)
  assert.match(service, /submittedAt: serverTimestamp\(\)/)
  assert.match(service, /await ensureOwnerBusinessCallable\(\)/)
  assert.doesNotMatch(service, /ensureOwnerBusinessCallable\([^)]*\{[^}]*\}/)
})

test('dashboard and direct editor access follow the owner-write status contract', async () => {
  const [dashboard, editor, rules] = await Promise.all([
    source('src/pages/business/BusinessDashboardPage.jsx'),
    source('src/pages/business/EditBusinessPage.jsx'),
    source('firestore.rules', repoRoot),
  ])

  assert.deepEqual(OWNER_EDITABLE_BUSINESS_STATUSES, ['draft', 'rejected'])
  for (const status of ['draft', 'rejected']) {
    assert.equal(isOwnerEditableBusinessStatus(status), true)
  }
  for (const status of ['pending_review', 'active', 'suspended', 'archived', 'deleted']) {
    assert.equal(isOwnerEditableBusinessStatus(status), false)
  }

  assert.match(rules, /resource\.data\.status in \['draft', 'rejected'\]/)
  assert.match(dashboard, /const canEditBusiness = isOwnerEditableBusinessStatus\(status\)/)
  assert.match(dashboard, /\{canEditBusiness && \(\s*<>\s*<Link[^>]+to="\/business\/edit"/s)
  assert.match(dashboard, /canSubmitForReview = canEditBusiness && completion\.ready/)
  assert.match(editor, /businessProfile && !isOwnerEditableBusinessStatus\(businessProfile\.status\)/)
  assert.match(editor, /to="\/business\/dashboard"/)

  const blockedState = editor.slice(
    editor.indexOf('if (businessProfile && !isOwnerEditableBusinessStatus'),
    editor.indexOf('return (', editor.indexOf('if (businessProfile && !isOwnerEditableBusinessStatus')) + 1200,
  )
  assert.doesNotMatch(blockedState, /<form|handleSubmit|updateBusinessProfile|uploadBusiness/)
})

test('backend callable reason contracts and deterministic ownership logic remain unchanged', async () => {
  const [roleContract, ownerContract] = await Promise.all([
    source('functions/src/accountRoleTransition.js', repoRoot),
    source('functions/src/ownerBusinessCreation.js', repoRoot),
  ])

  for (const reason of [
    'auth-required',
    'email-verification-required',
    'invalid-account-type',
    'profile-not-found',
    'uid-mismatch',
    'account-not-active',
    'profile-incomplete',
    'business-account-active',
  ]) {
    assert.match(roleContract, new RegExp(`['"]${reason}['"]`))
  }
  for (const reason of [
    'auth-required',
    'email-verification-required',
    'profile-not-found',
    'uid-mismatch',
    'account-not-active',
    'business-role-required',
    'profile-incomplete',
    'ambiguous-business-ownership',
    'business-pointer-conflict',
    'manager-only-owner-creation-denied',
    'business-id-conflict',
  ]) {
    assert.match(ownerContract, new RegExp(`['"]${reason}['"]`))
  }

  assert.match(ownerContract, /db\.doc\(`businesses\/\$\{safeUid\}`\)/)
  assert.match(ownerContract, /return \{ ok: true, businessId: ownedBusiness\.id, created: false \}/)
  assert.match(ownerContract, /return \{ ok: true, businessId: safeUid, created \}/)
})

test('workflow translations are complete across all seventeen locales', async () => {
  const keys = [
    'emailNotVerified',
    'accountNotActive',
    'profileIncomplete',
    'profileNotFound',
    'accountTransitionFailed',
    'roleConflict',
    'ownershipConflict',
    'businessCreateFailed',
    'submitIncomplete',
    'submitInvalidState',
    'submitPermissionDenied',
    'submitFailed',
    'networkUnavailable',
  ]
  const locales = ['en', 'es', 'fr', 'de', 'nl', 'pt', 'pl', 'ro', 'cs', 'sk', 'hu', 'uk', 'it', 'sv', 'da', 'fi', 'no']
  const english = JSON.parse(await source('src/i18n/locales/en.json'))

  for (const key of keys) {
    assert.ok(english.workflow?.errors?.[key]?.trim(), `en: workflow.errors.${key}`)
  }
  for (const locale of locales) {
    for (const key of keys) {
      assert.ok(
        authenticatedTranslations[locale]?.workflow?.errors?.[key]?.trim(),
        `${locale}: workflow.errors.${key}`,
      )
    }
  }
})
