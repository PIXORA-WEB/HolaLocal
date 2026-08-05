import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { classifyFrontendError } from '../src/utils/frontendErrors.js'
import { buildHomepagePreviewBusinesses } from '../src/utils/homepagePreview.js'
import { authenticatedTranslations } from '../src/i18n/locales/authenticatedTranslations.js'

const source = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('profile and business save errors are contextual and disclosure-safe', () => {
  const fixtures = [
    ['profile-save', { code: 'firestore/permission-denied' }, 'PROFILE_SAVE_PERMISSION_DENIED'],
    ['profile-save', { code: 'firestore/unavailable' }, 'PROFILE_SAVE_NETWORK_UNAVAILABLE'],
    ['profile-save', { code: 'auth/unauthenticated' }, 'AUTH_SESSION_EXPIRED'],
    ['profile-save', { message: 'projects/example-project/users/example-user stack trace' }, 'PROFILE_SAVE_FAILED'],
    ['business-save', { code: 'firestore/permission-denied' }, 'BUSINESS_SAVE_PERMISSION_DENIED'],
    ['business-save', { code: 'network-request-failed' }, 'BUSINESS_SAVE_NETWORK_UNAVAILABLE'],
    ['business-save', { code: 'functions/unauthenticated' }, 'AUTH_SESSION_EXPIRED'],
    ['business-save', { message: 'businesses/example-business internalField stack trace' }, 'BUSINESS_SAVE_FAILED'],
  ]

  for (const [domain, error, type] of fixtures) {
    const result = classifyFrontendError(error, { domain })
    assert.equal(result.type, type)
    assert.deepEqual(Object.keys(result).sort(), ['recovery', 'translationKey', 'type'])
    assert.doesNotMatch(
      JSON.stringify(result),
      /projects\/|users\/|businesses\/|example-user|example-business|internalField|stack trace/,
    )
  }
})

test('contextual save translations exist in every locale pack', () => {
  assert.equal(Object.keys(authenticatedTranslations).length, 17)
  for (const [locale, resource] of Object.entries(authenticatedTranslations)) {
    for (const key of ['savePermissionDenied', 'saveNetworkUnavailable', 'saveFailed']) {
      assert.ok(resource.profile.errors[key]?.trim(), `${locale} profile ${key}`)
      assert.ok(resource.business.form.errors[key]?.trim(), `${locale} business ${key}`)
    }
  }
})

test('homepage preview safely separates live results, examples and retry state', () => {
  const home = source('../src/pages/HomePage.jsx')
  const liveBusinesses = [{ businessId: 'live-business' }]
  const examples = [
    { businessId: 'example-one', isDemo: true },
    { businessId: 'example-two', isDemo: true },
  ]

  assert.deepEqual(buildHomepagePreviewBusinesses(liveBusinesses, examples, 'loading'), examples)
  assert.deepEqual(buildHomepagePreviewBusinesses(liveBusinesses, examples, 'error'), examples)
  assert.deepEqual(buildHomepagePreviewBusinesses([], examples, 'success'), examples)
  assert.equal(
    buildHomepagePreviewBusinesses(liveBusinesses, examples, 'success')[0],
    liveBusinesses[0],
  )
  for (const status of ['loading', 'error']) {
    const preview = buildHomepagePreviewBusinesses(liveBusinesses, examples, status)
    assert.equal(preview.some((business) => business.businessId === 'live-business'), false)
    assert.equal(preview.every((business) => business.isDemo === true), true)
  }

  assert.match(home, /const \[directoryLoadAttempt, setDirectoryLoadAttempt\] = useState\(0\)/)
  assert.match(home, /getFeaturedActiveBusinesses\(60\)/)
  assert.match(home, /\}, \[directoryLoadAttempt\]\)/)
  const retryHandler = home.slice(
    home.indexOf('function retryDirectoryLoad()'),
    home.indexOf('const fallbackBusinesses'),
  )
  assert.match(retryHandler, /setFeaturedBusinesses\(\[\]\)/)
  assert.match(retryHandler, /setDirectoryStatus\('loading'\)/)
  assert.match(retryHandler, /setDirectoryLoadAttempt\(\(attempt\) => attempt \+ 1\)/)
  assert.match(home, /isDemo: true/)
  assert.match(home, /disabled=\{directoryStatus === 'loading'\}/)
  assert.match(home, /\{t\('common.retry'\)\}/)
})

test('services retry preserves URL-backed filters and distinguishes load failure from unavailable', () => {
  const services = source('../src/pages/ServicesPage.jsx')
  assert.match(services, /const \[loadAttempt, setLoadAttempt\] = useState\(0\)/)
  assert.match(services, /getActivePublicBusinesses\(\)/)
  assert.match(services, /\}, \[loadAttempt, t\]\)/)
  assert.match(services, /function retryDirectoryLoad\(\)/)
  assert.doesNotMatch(services, /retryDirectoryLoad[\s\S]{0,300}setSearchParams/)
  assert.match(services, /!loading && !error && !selectedBusiness/)
  assert.match(services, /publicBusinessDetail\.unavailableTitle/)
  assert.match(services, /publicBusinessDetail\.backToResults/)
})

test('profile and business save paths use contextual classification and retain form state', () => {
  const profile = source('../src/pages/customer/ProfilePage.jsx')
  const business = source('../src/pages/business/EditBusinessPage.jsx')
  assert.match(profile, /classifyFrontendError\(updateError, \{\s*domain: 'profile-save'/s)
  assert.match(profile, /setErrorOperation\('save'\)/)
  assert.doesNotMatch(profile, /domain: 'profile-save'[\s\S]{0,500}refreshUserProfile/)
  assert.match(business, /classifyFrontendError\(saveError, \{\s*domain: 'business-save'/s)
  assert.doesNotMatch(business, /message=\{error\}[\s\S]{0,100}onRetry=/)
  assert.match(business, /id="business-profile-form" onSubmit=\{handleSubmit\}/)
})

test('contact support recovery points to the active public contact route', () => {
  const routes = source('../src/routes/AppRoutes.jsx')
  const contact = source('../src/pages/ContactPage.jsx')
  for (const page of [
    '../src/pages/business/BusinessDashboardPage.jsx',
    '../src/pages/business/EditBusinessPage.jsx',
    '../src/pages/business/SubscriptionPage.jsx',
  ]) {
    assert.match(source(page), /navigate\('\/contact'\)/)
  }
  assert.match(routes, /<Route path="contact" element=\{<ContactPage \/>\} \/>/)
  assert.match(contact, /hello@holalocal\.es/)
})
