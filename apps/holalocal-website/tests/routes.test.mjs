import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const routesPath = path.resolve(__dirname, '../src/routes/AppRoutes.jsx')
const headerPath = path.resolve(__dirname, '../src/components/layout/SiteHeader.jsx')
const footerPath = path.resolve(__dirname, '../src/components/layout/SiteFooter.jsx')
const homePath = path.resolve(__dirname, '../src/pages/HomePage.jsx')
const servicesPath = path.resolve(__dirname, '../src/pages/ServicesPage.jsx')
const authLayoutPath = path.resolve(__dirname, '../src/components/layout/AuthLayout.jsx')
const userServicePath = path.resolve(__dirname, '../src/services/userService.js')
const businessServicePath = path.resolve(__dirname, '../src/services/businessService.js')
const businessRoutePath = path.resolve(__dirname, '../src/routes/BusinessRoute.jsx')
const onboardingPath = path.resolve(__dirname, '../src/pages/auth/OnboardingPage.jsx')
const functionsClientPath = path.resolve(__dirname, '../src/firebase/functionsClient.js')

test('public production routes use the full homepage and services pages', async () => {
  const source = await readFile(routesPath, 'utf8')

  assert.match(source, /const HomePage = lazy\(\(\) => import\('\.\.\/pages\/HomePage\.jsx'\)\)/)
  assert.match(source, /const ServicesPage = lazy\(\(\) => import\('\.\.\/pages\/ServicesPage\.jsx'\)\)/)
  assert.match(source, /<Route index element=\{<HomePage \/>\} \/>/)
  assert.match(source, /<Route path="services" element=\{<ServicesPage \/>\} \/>/)
  assert.match(source, /<Route path="services\/:businessId" element=\{<ServicesPage \/>\} \/>/)
  assert.match(source, /function LegacyBusinessRedirect\(\)/)
  assert.match(source, /`\/services\/\$\{encodeURIComponent\(businessId\)\}\$\{location\.search\}`/)
  assert.match(source, /`\/services\$\{location\.search\}`/)
  assert.match(source, /<Route path="businesses" element=\{<LegacyBusinessRedirect \/>\} \/>/)
  assert.match(source, /<Route path="businesses\/:businessId" element=\{<LegacyBusinessRedirect \/>\} \/>/)
  assert.doesNotMatch(source, /EarlyAccessPage/)
  assert.doesNotMatch(source, /dev-services|dev-home|dev-businesses|main-preview/)
})

test('logged-out header exposes the public navigation on desktop and mobile', async () => {
  const source = await readFile(headerPath, 'utf8')

  for (const route of ['/', '/services', '/contact', '/login', '/register']) {
    assert.match(source, new RegExp(`to="${route.replace('/', '\\/')}"|to: '${route.replace('/', '\\/')}'`))
  }
  assert.match(source, /nav\.findServices/)
  assert.match(source, /nav\.join/)
  assert.match(source, /closeMobileMenu/)
  assert.match(source, /onClick=\{closeMobileMenu\}/)
})

test('shared footer includes public, account and legal links', async () => {
  const source = await readFile(footerPath, 'utf8')

  for (const route of ['/', '/services', '/contact', '/login', '/register', '/privacy', '/terms']) {
    assert.match(source, new RegExp(`to: '${route.replace('/', '\\/')}'|to="${route.replace('/', '\\/')}"`))
  }
  assert.match(source, /footer\.poweredBy/)
  assert.match(source, /BrandLockup/)
  assert.match(source, /LanguageSwitcher/)

  const authLayout = await readFile(authLayoutPath, 'utf8')
  assert.match(authLayout, /<SiteFooter \/>/)
})

test('homepage CTAs use production public routes', async () => {
  const source = await readFile(homePath, 'utf8')

  assert.match(source, /to: '\/services'/)
  assert.match(source, /to: '\/register\?intent=business'/)
  assert.match(source, /to="\/register\?intent=customer"/)
  assert.match(source, /to="\/services"/)
  assert.doesNotMatch(source, /to="\/business\/dashboard"/)
  assert.doesNotMatch(source, /href="#|to="#/)
})

test('services page uses the shared directory implementation and safe states', async () => {
  const [source, businessService] = await Promise.all([
    readFile(servicesPath, 'utf8'),
    readFile(businessServicePath, 'utf8'),
  ])

  assert.match(source, /getActivePublicBusinesses/)
  assert.match(source, /PublicBusinessCard/)
  assert.match(source, /const selectedBusiness = businesses\.find/)
  assert.match(source, /Business unavailable/)
  assert.match(source, /This business profile could not be found or is no longer active\./)
  assert.match(source, /services\.emptyTitle/)
  assert.match(source, /services\.emptyAction/)
  assert.match(source, /services\.loadError/)
  assert.match(source, /to=\{`\/services\/\$\{business\.businessId\}/)
  assert.match(businessService, /toPublicBusiness\(snapshot\)/)
  assert.match(businessService, /filter\(\(business\) => business\?\.name\)/)
  assert.doesNotMatch(source, /example-|isDemo/)
})

test('account onboarding uses the trusted callable instead of direct role writes', async () => {
  const [userService, functionsClient, onboarding, businessRoute, businessService] = await Promise.all([
    readFile(userServicePath, 'utf8'),
    readFile(functionsClientPath, 'utf8'),
    readFile(onboardingPath, 'utf8'),
    readFile(businessRoutePath, 'utf8'),
    readFile(businessServicePath, 'utf8'),
  ])

  assert.match(functionsClient, /httpsCallable\(functions, 'updateAccountRole'\)/)
  assert.match(userService, /updateAccountRoleCallable\(\{ accountType \}\)/)
  assert.doesNotMatch(userService, /roles,\s*$/m)
  assert.doesNotMatch(userService, /businessProfileRequired: roles\.includes/)
  assert.match(onboarding, /navigate\(requiresBusinessProfile \? '\/business\/dashboard' : '\/profile'/)
  assert.match(businessRoute, /userProfile\?\.roles\?\.includes\('business'\)/)
  assert.match(functionsClient, /httpsCallable\(functions, 'ensureOwnerBusiness'\)/)
  assert.match(businessService, /getBusinessByOwnerId\(ownerId\)/)
  assert.match(businessService, /ensureOwnerBusinessCallable\(\)/)
  assert.match(businessService, /return getManagedBusinessById\(businessId\)/)
  assert.doesNotMatch(businessService, /doc\(collection\(db, 'businesses'\)\)/)
  assert.doesNotMatch(businessService, /transaction\.set\(reference/)
})
