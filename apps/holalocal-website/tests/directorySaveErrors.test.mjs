import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { classifyFrontendError } from '../src/utils/frontendErrors.js'
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

test('homepage preview uses real directory results only and retains a safe retry state', () => {
  const home = source('../src/pages/HomePage.jsx')

  assert.match(home, /const \[featuredBusinesses, setFeaturedBusinesses\] = useState\(\[\]\)/)
  assert.match(home, /const \[directoryLoadAttempt, setDirectoryLoadAttempt\] = useState\(0\)/)
  assert.match(home, /getFeaturedActiveBusinesses\(60\)/)
  // Selection/order, three-logo resolution and callable failure/retry are exercised
  // by homeFeaturedMedia.test.mjs against the actual public service and loader.
  assert.ok(home.includes("import { getFeaturedActiveBusinesses } from '../services/publicBusinessService.js'"))
  assert.match(home, /setFeaturedBusinesses\(businesses\)/)
  assert.match(home, /\.catch\(\(\) => \{[\s\S]*?setFeaturedBusinesses\(\[\]\)[\s\S]*?setDirectoryStatus\('error'\)/)
  assert.match(home, /\}, \[directoryLoadAttempt\]\)/)
  const retryHandlerStart = home.indexOf('function retryDirectoryLoad()')
  const retryHandler = home.slice(
    retryHandlerStart,
    home.indexOf('\n\n  return (', retryHandlerStart),
  )
  assert.match(retryHandler, /setFeaturedBusinesses\(\[\]\)/)
  assert.match(retryHandler, /setDirectoryStatus\('loading'\)/)
  assert.match(retryHandler, /setDirectoryLoadAttempt\(\(attempt\) => attempt \+ 1\)/)
  assert.match(home, /featuredBusinesses\.map\(\(business\) => \(/)
  assert.doesNotMatch(home, /isDemo|exampleBusinesses|fallbackBusinesses/)
  assert.match(home, /directoryStatus === 'error'/)
  assert.match(home, /\{t\('common.retry'\)\}/)
})

test('services retry preserves URL-backed filters and distinguishes load failure from unavailable', () => {
  const services = source('../src/pages/ServicesPage.jsx')
  assert.match(services, /const \[loadAttempt, setLoadAttempt\] = useState\(0\)/)
  assert.match(services, /getActivePublicBusinesses\(\)/)
  assert.match(services, /if \(businessId\) return undefined[\s\S]*?getActivePublicBusinesses\(\)/)
  assert.match(services, /\}, \[businessId, loadAttempt, t\]\)/)
  assert.match(services, /getPublicBusinessById\(businessId\)/)
  assert.match(services, /status: business \? 'ready' : 'unavailable'/)
  assert.match(services, /business: null, status: 'error'/)
  assert.match(services, /function retryDirectoryLoad\(\)/)
  const retry = services.slice(services.indexOf('function retryDirectoryLoad()'), services.indexOf('const categoryOptions'))
  assert.match(retry, /setError\(''\)/)
  assert.match(retry, /setLoading\(true\)/)
  assert.match(retry, /setLoadAttempt\(\(attempt\) => attempt \+ 1\)/)
  assert.doesNotMatch(retry, /setSearchParams/)
  assert.match(services, /detailStatus === 'error'/)
  assert.match(services, /detailStatus === 'unavailable'/)
  assert.ok(services.includes('to={`/services${currentLocation.search}`}'))
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
  const form = business.match(/<form\b[^>]*id="business-profile-form"[^>]*>/)?.[0]
  assert.ok(form, 'the business editor retains its native form')
  assert.match(form, /onSubmit=\{handleSubmit\}/)
  assert.match(business, /async function handleSubmit\(event\) \{\s*event\.preventDefault\(\)/)
  const failure = business.slice(business.indexOf('} catch (saveError)'), business.indexOf('const mediaErrorAction'))
  assert.match(failure, /setError\(t\(classifiedError\.translationKey\)\)/)
  assert.match(failure, /finally \{\s*setSubmitting\(false\)/)
  assert.doesNotMatch(failure, /setForm\(|setCustomLanguage\(|setTaxonomy\(/, 'failed saves must retain editable input')
})

test('recoverable business failures point to Contact while Subscription stays informational', () => {
  const routes = source('../src/routes/AppRoutes.jsx')
  const contact = source('../src/pages/ContactPage.jsx')
  const subscription = source('../src/pages/business/SubscriptionPage.jsx')
  for (const page of [
    '../src/pages/business/BusinessDashboardPage.jsx',
    '../src/pages/business/EditBusinessPage.jsx',
  ]) {
    assert.match(source(page), /navigate\('\/contact'\)/)
  }
  assert.doesNotMatch(subscription, /navigate\(|RecoveryMessage|useEffect|useState|loadOwnerSubscriptionProjection/)
  assert.match(routes, /<Route path="contact" element=\{<ContactPage \/>\} \/>/)
  assert.match(contact, /hello@holalocal\.es/)
})
