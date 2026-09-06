import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const routesPath = path.resolve(__dirname, '../src/routes/AppRoutes.jsx')
const scrollNavigationPath = path.resolve(
  __dirname,
  '../src/routes/ScrollToTopOnNavigation.jsx',
)
const headerPath = path.resolve(__dirname, '../src/components/layout/SiteHeader.jsx')
const footerPath = path.resolve(__dirname, '../src/components/layout/SiteFooter.jsx')
const brandLockupPath = path.resolve(__dirname, '../src/components/common/BrandLockup.jsx')
const homePath = path.resolve(__dirname, '../src/pages/HomePage.jsx')
const globalStylesPath = path.resolve(__dirname, '../src/styles/global.css')
const servicesPath = path.resolve(__dirname, '../src/pages/ServicesPage.jsx')
const siteLayoutPath = path.resolve(__dirname, '../src/components/layout/SiteLayout.jsx')
const authLayoutPath = path.resolve(__dirname, '../src/components/layout/AuthLayout.jsx')
const adminLayoutPath = path.resolve(__dirname, '../src/components/layout/AdminLayout.jsx')
const businessLayoutPath = path.resolve(__dirname, '../src/components/layout/BusinessLayout.jsx')
const userServicePath = path.resolve(__dirname, '../src/services/userService.js')
const businessServicePath = path.resolve(__dirname, '../src/services/businessService.js')
const businessRoutePath = path.resolve(__dirname, '../src/routes/BusinessRoute.jsx')
const onboardingPath = path.resolve(__dirname, '../src/pages/auth/OnboardingPage.jsx')
const functionsClientPath = path.resolve(__dirname, '../src/firebase/functionsClient.js')
const businessDashboardPath = path.resolve(__dirname, '../src/pages/business/BusinessDashboardPage.jsx')
const editBusinessPath = path.resolve(__dirname, '../src/pages/business/EditBusinessPage.jsx')
const subscriptionPath = path.resolve(__dirname, '../src/pages/business/SubscriptionPage.jsx')
const authenticationProviderPath = path.resolve(__dirname, '../src/context/AuthenticationProvider.jsx')
const protectedRoutePath = path.resolve(__dirname, '../src/routes/ProtectedRoute.jsx')
const publicRoutePath = path.resolve(__dirname, '../src/routes/PublicRoute.jsx')
const blockedAccountScreenPath = path.resolve(
  __dirname,
  '../src/components/common/BlockedAccountScreen.jsx',
)
const profilePagePath = path.resolve(__dirname, '../src/pages/customer/ProfilePage.jsx')
const privacyPath = path.resolve(__dirname, '../src/pages/PrivacyPage.jsx')
const termsPath = path.resolve(__dirname, '../src/pages/TermsPage.jsx')
const businessDetailPath = path.resolve(__dirname, '../src/components/common/BusinessDetailPanel.jsx')
const publicBusinessDirectoryPath = path.resolve(
  __dirname,
  '../../../functions/src/publicBusinessDirectory.js',
)

function readCssBlock(styles, selector) {
  const start = styles.indexOf(`${selector} {`)
  assert.notEqual(start, -1, `Expected CSS selector ${selector}`)
  const end = styles.indexOf('\n}', start)
  assert.notEqual(end, -1, `Expected CSS block for ${selector}`)
  return styles.slice(start, end + 2)
}

function readExportedFunction(source, name, nextName) {
  const start = source.indexOf(`export async function ${name}`)
  assert.notEqual(start, -1, `Expected exported function ${name}`)
  const end = nextName ? source.indexOf(`export async function ${nextName}`, start) : source.length
  assert.notEqual(end, -1, `Expected exported function ${nextName}`)
  return source.slice(start, end)
}

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

test('scroll policy handles one plain homepage reload while preserving history and anchors', async () => {
  const [routes, scrollNavigation] = await Promise.all([
    readFile(routesPath, 'utf8'),
    readFile(scrollNavigationPath, 'utf8'),
  ])

  assert.match(routes, /<BrowserRouter>[\s\S]*?<ScrollToTopOnNavigation \/>/)
  assert.match(scrollNavigation, /useNavigationType\(\)/)
  assert.match(scrollNavigation, /const initialNavigationHandledRef = useRef\(false\)/)
  assert.match(scrollNavigation, /window\.performance\.getEntriesByType\('navigation'\)\[0\]/)
  assert.match(scrollNavigation, /navigationEntry\?\.type === 'reload'/)
  assert.match(scrollNavigation, /location\.pathname === '\/'/)
  assert.match(scrollNavigation, /&& !location\.hash/)
  assert.match(scrollNavigation, /navigationType !== 'PUSH'/)
  assert.match(scrollNavigation, /location\.hash/)
  assert.match(scrollNavigation, /window\.scrollTo\(\{ top: 0, left: 0, behavior: 'auto' \}\)/)
  assert.doesNotMatch(scrollNavigation, /navigationType === 'POP'|navigationType !== 'POP'/)
  assert.doesNotMatch(scrollNavigation, /popstate|onClick|scrollRestoration/)
})

test('subscription uses canonical internal navigation with a business-gated legacy redirect', async () => {
  const [routes, header, businessLayout, businessDashboard, subscription] = await Promise.all([
    readFile(routesPath, 'utf8'),
    readFile(headerPath, 'utf8'),
    readFile(businessLayoutPath, 'utf8'),
    readFile(new URL('../src/pages/business/BusinessDashboardPage.jsx', import.meta.url), 'utf8'),
    readFile(subscriptionPath, 'utf8'),
  ])
  const protectedRouteIndex = routes.indexOf('<Route element={<ProtectedRoute />}>')
  const canonicalRouteIndex = routes.indexOf('<Route path="subscription" element={<SubscriptionPage />} />')
  const businessRouteIndex = routes.indexOf('<Route element={<BusinessRoute />}>')
  const legacyRouteIndex = routes.indexOf('<Route path="subscription" element={<Navigate replace to="/subscription" />} />')

  assert.notEqual(protectedRouteIndex, -1)
  assert.equal(protectedRouteIndex < canonicalRouteIndex, true)
  assert.equal(canonicalRouteIndex < businessRouteIndex, true)
  assert.equal(businessRouteIndex < legacyRouteIndex, true)
  assert.match(header, /\{ labelKey: 'business\.subscription', to: '\/subscription' \}/)
  assert.doesNotMatch(header, /to: '\/business\/subscription'/)
  assert.match(businessDashboard, /<Link className="button button--secondary" to="\/subscription">\{t\('business\.subscription'\)\}<\/Link>/)
  assert.doesNotMatch(businessDashboard, /to="\/business\/subscription"/)
  assert.match(businessLayout, /<Outlet \/>/)
  assert.doesNotMatch(businessLayout, /NavLink|account-navigation|business\.subscription/)
  assert.match(routes, /<Route path="dashboard" element=\{<BusinessDashboardPage \/>\} \/>/)
  assert.match(routes, /<Route path="edit" element=\{<EditBusinessPage \/>\} \/>/)
  assert.doesNotMatch(`${routes}\n${header}`, /my-events|\/my-events|events\/subscription|events\/billing|checkout/)
  assert.doesNotMatch(subscription, /getOwnerSubscriptionStatus|loadOwnerSubscriptionProjection|useAuthentication/)
})

test('logged-out header exposes the public navigation on desktop and mobile', async () => {
  const [source, styles] = await Promise.all([
    readFile(headerPath, 'utf8'),
    readFile(globalStylesPath, 'utf8'),
  ])
  const navigationBlock = source.match(/const publicNavigationLinks = \[[\s\S]*?\n\]/)?.[0]

  assert.ok(navigationBlock)
  assert.match(
    navigationBlock,
    /\[\s*\{ product: 'services', labelKey: 'nav\.services', to: '\/services' \},\s*\{ product: 'events', labelKey: 'nav\.events', to: '\/events' \},\s*\{ product: 'community', labelKey: 'nav\.community', to: '\/community' \},\s*\]/,
  )
  assert.doesNotMatch(navigationBlock, /to: '\/'[, }]/)
  assert.doesNotMatch(navigationBlock, /\/contact|nav\.home|nav\.findServices|footer\.contact/)

  for (const route of ['/services', '/events', '/community', '/login', '/register']) {
    assert.match(source, new RegExp(`to="${route.replace('/', '\\/')}"|to: '${route.replace('/', '\\/')}'`))
  }
  assert.match(source, /<BrandLockup \/>/)
  assert.equal(source.match(/publicNavigationLinks\.map\(\(link\) => \(/g)?.length, 3)
  assert.equal(source.match(/className=\{`public-navigation-link public-navigation-link--\$\{link\.product\}`\}/g)?.length, 3)
  assert.doesNotMatch(source, /nav\.findServices/)
  assert.match(source, /nav\.join/)
  assert.match(source, /<NavLink className="site-header__join" to="\/register">/)
  assert.doesNotMatch(source, /className="[^"]*public-navigation-link[^"]*"[^>]*to="\/register"/)
  assert.match(source, /closeMobileMenu/)
  assert.match(source, /onClick=\{closeMobileMenu\}/)

  assert.match(readCssBlock(styles, '.public-navigation-link--services'), /var\(--product-services\)/)
  assert.match(readCssBlock(styles, '.public-navigation-link--events'), /var\(--product-events\)/)
  assert.match(readCssBlock(styles, '.public-navigation-link--community'), /var\(--product-community\)/)
  assert.match(readCssBlock(styles, '.site-header__nav a'), /color: var\(--brand-navy\)/)

  const desktopActive = readCssBlock(styles, '.site-header__nav .public-navigation-link.active')
  const desktopActiveHover = readCssBlock(styles, '.site-header__nav .public-navigation-link.active:hover')
  const desktopIndicator = readCssBlock(styles, '.site-header__nav .public-navigation-link.active::after')
  const mobileActive = readCssBlock(styles, '.mobile-navigation .public-navigation-link.active')

  assert.doesNotMatch(desktopActive, /border|outline|box-shadow/)
  assert.match(desktopActive, /background: transparent/)
  assert.match(desktopActiveHover, /background: var\(--public-navigation-background\)/)
  assert.match(desktopIndicator, /height: 2px/)
  assert.match(desktopIndicator, /background: var\(--public-navigation-accent\)/)
  assert.match(mobileActive, /box-shadow: inset 0\.18rem 0 0 var\(--public-navigation-accent\)/)
})

test('signed-in mobile menu keeps public navigation and role-based account links together', async () => {
  const source = await readFile(headerPath, 'utf8')

  assert.match(source, /const publicNavigationLinks = \[/)
  assert.match(source, /mobile-navigation__group/)
  assert.match(source, /mobile-navigation__group--account/)
  assert.match(source, /publicNavigationLinks\.map\(\(link\) => \(/)
  assert.match(source, /<NavLink className=\{`public-navigation-link public-navigation-link--\$\{link\.product\}`\} key=\{link\.to\} onClick=\{closeMobileMenu\} to=\{link\.to\}>/)
  assert.match(source, /const accountNavigationLinks = \[/)
  assert.equal(source.match(/visibleAccountNavigationLinks\.map\(\(link\) => \(/g)?.length, 2)
  assert.match(source, /!link\.requiresBusinessAccess \|\| hasBusinessAccess/)
  assert.match(source, /to="\/messages"/)
  assert.match(source, /async function handleSignOut\(\)/)
  assert.match(source, /useLocation\(\)/)
  assert.match(source, /location\.pathname/)
  assert.match(source, /location\.search/)
  assert.match(source, /useCallback\(function closeMobileMenu/)
  assert.doesNotMatch(source, /Home<\/NavLink>|Find Services<\/NavLink>|Contact<\/NavLink>|My profile<\/NavLink>/)
})

test('shared footer exposes product, account, help and legal navigation', async () => {
  const [source, brandLockup, siteLayout, authLayout, adminLayout] = await Promise.all([
    readFile(footerPath, 'utf8'),
    readFile(brandLockupPath, 'utf8'),
    readFile(siteLayoutPath, 'utf8'),
    readFile(authLayoutPath, 'utf8'),
    readFile(adminLayoutPath, 'utf8'),
  ])
  const exploreBlock = source.match(/const exploreLinks = \[[\s\S]*?\n\]/)?.[0]
  const accountBlock = source.match(/const accountLinks = \[[\s\S]*?\n\]/)?.[0]
  const helpLegalBlock = source.match(/const helpLegalLinks = \[[\s\S]*?\n\]/)?.[0]

  assert.ok(exploreBlock)
  assert.match(
    exploreBlock,
    /\[\s*\{ product: 'services', labelKey: 'nav\.services', to: '\/services' \},\s*\{ product: 'events', labelKey: 'nav\.events', to: '\/events' \},\s*\{ product: 'community', labelKey: 'nav\.community', to: '\/community' \},\s*\]/,
  )
  assert.doesNotMatch(exploreBlock, /nav\.home|nav\.findServices|footer\.contact|to: '\/'/)
  assert.match(source, /exploreLinks\.map\(\(link\) => \(/)
  assert.match(source, /className=\{`site-footer__link site-footer__link--\$\{link\.product\}`\}/)
  assert.match(source, /footer\.exploreLabel/)
  assert.match(source, /footer\.explore/)

  assert.ok(accountBlock)
  assert.match(
    accountBlock,
    /\[\s*\{ labelKey: 'account\.signIn', to: '\/login' \},\s*\{ labelKey: 'nav\.join', to: '\/register' \},\s*\]/,
  )
  assert.doesNotMatch(accountBlock, /product:|dashboard|business|events|subscription/)
  assert.match(source, /footer\.accountLabel/)
  assert.match(source, /footer\.account/)

  assert.ok(helpLegalBlock)
  assert.match(
    helpLegalBlock,
    /\[\s*\{ labelKey: 'footer\.contact', to: '\/contact' \},\s*\{ labelKey: 'footer\.privacy', to: '\/privacy' \},\s*\{ labelKey: 'footer\.terms', to: '\/terms' \},\s*\]/,
  )
  assert.doesNotMatch(helpLegalBlock, /product:|nav\.home|nav\.services/)
  assert.match(source, /footer\.helpLegalLabel/)
  assert.match(source, /footer\.helpLegal/)

  assert.match(source, /<BrandLockup \/>/)
  assert.match(brandLockup, /to = '\/'/)
  assert.match(source, /footer\.description/)
  assert.match(source, /<LanguageSwitcher \/>/)
  assert.match(source, /footer\.language/)
  assert.match(source, /footer\.poweredBy/)
  assert.match(source, /footer\.copyright/)
  assert.doesNotMatch(source, /My Events|my-events|\/events\/manage|dashboard|subscription/)

  assert.match(siteLayout, /<SiteFooter \/>/)
  assert.match(authLayout, /<SiteFooter \/>/)
  assert.doesNotMatch(adminLayout, /SiteFooter/)
})

test('legal pages render structured i18n content without changing consent logic', async () => {
  const [privacy, terms, routes, register] = await Promise.all([
    readFile(privacyPath, 'utf8'),
    readFile(termsPath, 'utf8'),
    readFile(routesPath, 'utf8'),
    readFile(path.resolve(__dirname, '../src/pages/auth/RegisterPage.jsx'), 'utf8'),
  ])

  assert.match(privacy, /t\('legalPages\.privacy\.sections', \{ returnObjects: true \}\)/)
  assert.match(terms, /t\('legalPages\.terms\.sections', \{ returnObjects: true \}\)/)
  assert.match(privacy, /<LegalSectionContent/)
  assert.match(terms, /<LegalSectionContent/)
  assert.doesNotMatch(privacy, /HolaLocal is being developed for customers/)
  assert.doesNotMatch(terms, /HolaLocal is a developing local marketplace/)
  assert.match(routes, /<Route path="privacy" element=\{<PrivacyPage \/>\} \/>/)
  assert.match(routes, /<Route path="terms" element=\{<TermsPage \/>\} \/>/)
  assert.match(register, /termsVersion/)
  assert.match(register, /privacyVersion/)
  assert.doesNotMatch(`${privacy}\n${terms}`, /Google Translate|Cloud Translation|translateCreatedMessage/)
})

test('homepage actions use production public routes', async () => {
  const source = await readFile(homePath, 'utf8')
  const heroStart = source.indexOf('<section className="marketing-hero">')
  const heroEnd = source.indexOf('</section>', heroStart)
  const hero = source.slice(heroStart, heroEnd)

  assert.match(source, /audience === 'customer'\) return '\/services'/)
  assert.match(source, /if \(!user\) return '\/register\?intent=business'/)
  assert.match(source, /roles\?\.includes\('business'\)\) return '\/business\/dashboard'/)
  assert.match(source, /return '\/profile\?intent=business#business-upgrade-title'/)
  assert.match(source, /to="\/services"/)
  assert.doesNotMatch(hero, /marketing\.homepage\.hero\.customerAction|to="\/services"/)
  assert.match(hero, /marketing\.homepage\.hero\.searchAction/)
  assert.match(hero, /marketing\.homepage\.hero\.businessAction/)
  assert.doesNotMatch(source, /<Link[^>]+to="\/business\/dashboard"/)
  assert.doesNotMatch(source, /to="\/(events|community)"/)
  assert.doesNotMatch(source, /href="#|to="#/)
})

test('homepage preview uses only real directory businesses and canonical display labels', async () => {
  const home = await readFile(homePath, 'utf8')

  assert.match(home, /getFeaturedActiveBusinesses\(60\)/)
  assert.match(home, /setFeaturedBusinesses\(businesses\.slice\(0, 3\)\)/)
  assert.match(home, /featuredBusinesses\.map\(\(business\) =>/)
  assert.match(home, /getPublicBusinessPrimaryServiceLabel\(business, taxonomyLabel\)/)
  assert.match(home, /to=\{`\/services\/\$\{business\.businessId\}`\}/)
  assert.doesNotMatch(home, /fallbackBusinessExamples|isDemo|exampleCleaningName|exampleGardenName|exampleRepairsName/)
})

test('homepage keeps real directory preview failure recoverable without fake data', async () => {
  const home = await readFile(homePath, 'utf8')

  assert.match(home, /setDirectoryStatus\('success'\)/)
  assert.match(home, /setDirectoryStatus\('error'\)/)
  assert.match(home, /featuredBusinesses\.length > 0 \|\| directoryStatus === 'error'/)
  assert.match(home, /t\('marketing\.hero\.loadFailure'\)/)
  assert.match(home, /className="homepage-business-preview__error" role="alert"/)
  assert.match(home, /onClick=\{retryDirectoryLoad\}/)
  assert.match(home, /t\('common\.retry'\)/)
  assert.match(home, /setFeaturedBusinesses\(\[\]\)[\s\S]*?setDirectoryStatus\('loading'\)/)
  assert.doesNotMatch(home, /localStorage|sessionStorage|minInstances|billing|fallbackBusinessExamples/)
})

test('homepage service and platform controls use semantic links without dead routes', async () => {
  const [home, styles] = await Promise.all([
    readFile(homePath, 'utf8'),
    readFile(globalStylesPath, 'utf8'),
  ])

  assert.match(home, /<nav className="homepage-service-groups"/)
  assert.match(home, /SERVICE_TAXONOMY_GROUPS\.map/)
  assert.match(home, /<Link data-service-group=\{group\.id\} key=\{group\.id\} to="\/services">/)
  assert.match(home, /getHomepageServiceHref\(serviceId\)/)
  assert.match(home, /\{ key: 'events', icon: 'calendar', state: 'upcoming', to: '\/events' \}/)
  assert.match(home, /\{ key: 'community', icon: 'people', state: 'upcoming', to: '\/community' \}/)
  assert.doesNotMatch(home, /\?group=|\?category=/)
  assert.match(styles, /\.homepage-services \.homepage-service-groups a\s*\{[\s\S]*?min-height: 9rem;/)
  assert.match(styles, /\.homepage-service-groups a:focus-visible/)
})

test('homepage hero preview metadata remains row-grouped and screen-reader friendly', async () => {
  const [card, styles] = await Promise.all([
    readFile(path.resolve(__dirname, '../src/components/common/PublicBusinessCard.jsx'), 'utf8'),
    readFile(globalStylesPath, 'utf8'),
  ])

  assert.match(card, /<dl className="public-business-card__hero-meta">/)
  assert.match(card, /<span aria-hidden="true">📍<\/span>/)
  assert.match(card, /<span className="visually-hidden">\{t\('marketing\.hero\.locationLabel'\)\}<\/span>/)
  assert.match(card, /<span aria-hidden="true">🌐<\/span>/)
  assert.match(card, /<span className="visually-hidden">\{t\('marketing\.hero\.languagesLabel'\)\}<\/span>/)
  assert.match(styles, /\.public-business-card dl:not\(\.public-business-card__hero-meta\) div\s*\{[\s\S]*?display: grid;/)
  assert.match(styles, /\.public-business-card__hero-meta div\s*\{[\s\S]*?display: flex;[\s\S]*?gap: 0\.34rem;[\s\S]*?align-items: flex-start;/)
  assert.match(styles, /\.public-business-card__hero-meta dt\s*\{[\s\S]*?flex: 0 0 auto;/)
  assert.match(styles, /\.public-business-card__hero-meta dd\s*\{[\s\S]*?flex: 1 1 auto;[\s\S]*?min-width: 0;[\s\S]*?line-height: 1\.35;/)
})

test('public business cards suppress planned ratings, reviews, and verification UI', async () => {
  const [card, styles] = await Promise.all([
    readFile(path.resolve(__dirname, '../src/components/common/PublicBusinessCard.jsx'), 'utf8'),
    readFile(globalStylesPath, 'utf8'),
  ])
  const heroLink = readCssBlock(styles, '.public-business-card--hero[href]')
  const heroHover = readCssBlock(styles, '.public-business-card--hero[href]:hover')
  const heroFocus = readCssBlock(styles, '.public-business-card--hero[href]:focus-visible')
  const resultCard = readCssBlock(styles, '.public-business-card--result')
  const resultHover = styles.match(/\.public-business-card--result:hover,[\s\S]*?\n\}/)?.[0] ?? ''

  assert.match(card, /const CardElement = isCardLink \? Link : 'article'/)
  assert.match(card, /<dl className="public-business-card__hero-meta">/)
  assert.match(card, /<dl className="public-business-card__result-meta">/)
  assert.doesNotMatch(card, /ratingAverage|ratingCount/)
  assert.doesNotMatch(card, /services\.(?:noReviews|verified)/)
  assert.doesNotMatch(card, /public-business-card__(?:rating|verified)/)
  assert.doesNotMatch(`${heroLink}\n${heroHover}\n${resultCard}\n${resultHover}`, /transform:|translate:|transition:/)
  assert.match(heroHover, /border-color:/)
  assert.match(heroHover, /box-shadow:/)
  assert.match(resultHover, /border-color:/)
  assert.match(resultHover, /box-shadow:/)
  assert.match(heroFocus, /outline: 3px solid/)
  assert.match(styles, /\.public-business-card--result:focus-visible\s*\{[^}]*outline: 3px solid/)
})

test('public business detail uses i18n while preserving business data and action wiring', async () => {
  const [detail, services, styles] = await Promise.all([
    readFile(businessDetailPath, 'utf8'),
    readFile(servicesPath, 'utf8'),
    readFile(globalStylesPath, 'utf8'),
  ])

  for (const text of [
    'Back to results',
    'Active profile',
    'Not verified',
    'Message business',
    'Report business',
    'About this business',
    'Services offered',
    'Work gallery',
    'Customer feedback',
    'Contact information',
    'No public contact details have been added.',
  ]) {
    assert.doesNotMatch(detail, new RegExp(`['">][^\\n]*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
  }

  assert.match(detail, /const \{ i18n, t \} = useTranslation\(\)/)
  assert.match(detail, /<h1 id="business-detail-title">\{business\.name\}<\/h1>/)
  assert.doesNotMatch(detail, /<h2 id="business-detail-title"/)
  assert.match(detail, /<h2>\{t\('publicBusinessDetail\.aboutBusiness'\)\}<\/h2>/)
  assert.match(detail, /aria-label=\{t\('publicBusinessDetail\.sectionsLabel'\)\}/)
  assert.match(detail, /alt=\{t\('publicBusinessDetail\.workImageAlt'/)
  assert.match(detail, /className="business-detail__disclosure"/)
  assert.match(detail, /t\('publicBusinessDetail\.profileInformationProvided'\)/)
  assert.doesNotMatch(detail, /href="#business-reviews"/)
  assert.doesNotMatch(detail, /id="business-reviews"/)
  assert.doesNotMatch(detail, /business-detail__rating|ratingAverage|ratingCount/)
  assert.doesNotMatch(
    detail,
    /publicBusinessDetail\.(?:verificationComingSoon|reviews|customerFeedback|reviewsUnavailable|noReceivedReviews|noReviews|reviewCount)/,
  )
  assert.doesNotMatch(detail, /verificationStatus === 'verified'/)
  assert.match(styles, /\.business-detail__identity h1\s*\{[\s\S]*?font-size: clamp\(1\.65rem, 4vw, 2\.25rem\);[\s\S]*?overflow-wrap: anywhere;/)
  assert.doesNotMatch(styles, /\.business-detail__identity h2/)

  assert.match(detail, /\{business\.name\}/)
  assert.match(detail, /business\.description \|\| t\('publicBusinessDetail\.noDescription'\)/)
  assert.match(detail, /business\.services\.map|services\.map/)
  assert.match(detail, /\{business\.contact\.phone\}/)
  assert.match(detail, /\{business\.contact\.email\}/)
  assert.match(detail, /\{business\.contact\.website\}/)

  assert.match(detail, /onClick=\{onMessage\}/)
  assert.match(detail, /onClick=\{onReport\}/)
  assert.match(services, /onMessage=\{\(\) => void handleMessageBusiness\(\)\}/)
  assert.match(services, /onReport=\{handleReportBusiness\}/)
  assert.match(services, /getOrCreateConversationForBusiness\(user\.uid, selectedBusiness\.businessId\)/)
  assert.match(services, /createBusinessReport\(\{/)
})

test('public business unavailable and action errors use translated labels', async () => {
  const services = await readFile(servicesPath, 'utf8')

  assert.match(services, /t\('publicBusinessDetail\.unavailableTitle'\)/)
  assert.match(services, /t\('publicBusinessDetail\.unavailableDescription'\)/)
  assert.match(services, /t\('publicBusinessDetail\.backToResults'\)/)
  assert.match(services, /setMessagingError\(t\('publicBusinessDetail\.messageError'\)\)/)
  assert.match(services, /setReportError\(t\('publicBusinessDetail\.reportError'\)\)/)
  assert.doesNotMatch(services, /<h1>Business unavailable<\/h1>/)
  assert.doesNotMatch(services, />\\s*Back to results\\s*</)
  assert.doesNotMatch(services, /Unable to open this conversation\./)
  assert.doesNotMatch(services, /Unable to submit this report\./)
})

test('homepage makes only supported present-day trust claims', async () => {
  const home = await readFile(homePath, 'utf8')

  assert.match(home, /\{ key: 'local', icon: 'identity', accent: 'blue' \}/)
  assert.match(home, /\{ key: 'multilingual', icon: 'language', accent: 'purple' \}/)
  assert.match(home, /\{ key: 'real', icon: 'briefcase', accent: 'green' \}/)
  assert.doesNotMatch(home, /verified|background check|testimonial|ratingCount|customerCount/i)
})

test('footer uses a calm branded responsive layout with accessible interactions', async () => {
  const styles = await readFile(globalStylesPath, 'utf8')
  const footer = readCssBlock(styles, '.site-footer')
  const brand = readCssBlock(styles, '.site-footer .brand-lockup')
  const navigation = readCssBlock(styles, '.site-footer__navigation')
  const groups = readCssBlock(styles, `.site-footer__group,
.site-footer__language`)
  const links = readCssBlock(styles, '.site-footer__links a')
  const neutralHover = readCssBlock(styles, '.site-footer__links a:hover')
  const focus = readCssBlock(styles, '.site-footer__links a:focus-visible')

  assert.match(footer, /border-top: 3px solid/)
  assert.match(footer, /border-image: linear-gradient\([\s\S]*?var\(--product-services\)[\s\S]*?var\(--product-events\)[\s\S]*?var\(--product-community\)[\s\S]*?\) 1/)
  assert.match(footer, /background: var\(--brand-navy\)/)
  assert.match(brand, /padding: 0\.35rem 0\.55rem/)
  assert.match(brand, /border-radius: 0\.65rem/)
  assert.match(brand, /background: #f8fafc/)
  assert.match(brand, /box-shadow: none/)
  assert.doesNotMatch(brand, /border:/)

  assert.match(navigation, /grid-template-columns: minmax\(0, 1fr\)/)
  assert.match(navigation, /justify-items: stretch/)
  assert.match(styles, /@media \(min-width: 22rem\) \{[\s\S]*?\.site-footer__navigation \{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(styles, /@media \(min-width: 64rem\)[\s\S]*?\.site-footer__navigation\s*\{[\s\S]*?repeat\(4, minmax\(7rem, 1fr\)\)/)
  assert.match(groups, /justify-items: start/)
  assert.doesNotMatch(groups, /background|border|box-shadow/)

  assert.match(links, /min-height: 2\.75rem/)
  assert.match(links, /padding: 0\.45rem 0/)
  assert.match(links, /color: rgb\(255 255 255 \/ 76%\)/)
  assert.match(styles, /@media \(min-width: 64rem\)[\s\S]*?\.site-footer__links a \{[\s\S]*?min-height: 2rem;[\s\S]*?padding-block: 0\.15rem;/)
  assert.match(neutralHover, /color: #ffffff/)
  assert.match(readCssBlock(styles, '.site-footer__link--services'), /var\(--product-services\)/)
  assert.match(readCssBlock(styles, '.site-footer__link--events'), /var\(--product-events\)/)
  assert.match(readCssBlock(styles, '.site-footer__link--community'), /var\(--product-community\)/)
  assert.match(readCssBlock(styles, '.site-footer__links .site-footer__link:hover'), /var\(--footer-link-accent\)/)
  assert.match(focus, /outline: 2px solid #ffffff/)
  assert.match(focus, /outline-offset: 3px/)
  assert.doesNotMatch(`${links}\n${neutralHover}`, /transform|translate|animation/)
})

test('homepage service groups use a compact responsive grid', async () => {
  const [home, styles] = await Promise.all([
    readFile(homePath, 'utf8'),
    readFile(globalStylesPath, 'utf8'),
  ])

  assert.match(home, /SERVICE_TAXONOMY_GROUPS\.map/)
  assert.match(styles, /\.homepage-service-groups\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/)
  assert.match(styles, /@media \(min-width: 24rem\)[\s\S]*?\.homepage-service-groups\s*\{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(styles, /@media \(min-width: 48rem\)[\s\S]*?\.homepage-service-groups\s*\{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(styles, /@media \(min-width: 72rem\)[\s\S]*?\.homepage-service-groups\s*\{[\s\S]*?repeat\(6, minmax\(0, 1fr\)\)/)
  assert.doesNotMatch(styles, /\.homepage-service-groups[\s\S]*?white-space:\s*nowrap/)
})

test('homepage card sections use compact content-driven vertical rhythm', async () => {
  const styles = await readFile(globalStylesPath, 'utf8')
  const howListBlock = readCssBlock(styles, '.homepage-how__list')
  const howItemBlock = readCssBlock(styles, '.homepage-how__item')
  const journeyCardBlock = readCssBlock(styles, '.journey-card')

  assert.match(styles, /\.marketing-section\s*\{[\s\S]*?padding-block: 4rem;/)
  assert.match(styles, /\.marketing-home\s*\{[\s\S]*?--homepage-section-spacing: clamp\(2\.75rem, 4\.75vw, 3\.25rem\);/)
  assert.match(styles, /\.marketing-home \.marketing-section\s*\{[\s\S]*?padding-block: var\(--homepage-section-spacing\);/)
  assert.match(howListBlock, /margin: 1\.75rem 0 0;/)
  assert.match(styles, /\.journey-grid\s*\{[\s\S]*?margin-top: 1\.6rem;/)
  assert.match(howItemBlock, /display: grid;/)
  assert.match(howItemBlock, /min-width: 0;/)
  assert.match(styles, /\.journey-card\s*\{[\s\S]*?display: flex;[\s\S]*?min-width: 0;[\s\S]*?flex-direction: column;[\s\S]*?padding: clamp\(1\.4rem, 5vw, 2rem\);/)
  assert.match(styles, /\.journey-card__action\s*\{[\s\S]*?min-height: 2\.75rem;[\s\S]*?margin-top: 0\.6rem;/)
  assert.doesNotMatch(howItemBlock, /\n\s{2}height:\s*\d|min-height:\s*100%/)
  assert.doesNotMatch(journeyCardBlock, /\n\s{2}height:\s*\d/)
  assert.match(journeyCardBlock, /background-color: color-mix\(in srgb, var\(--journey-accent\) 5%, var\(--surface\)\);/)
  assert.match(journeyCardBlock, /box-shadow: inset 3px 0 0 color-mix\(in srgb, var\(--journey-accent\) 38%, transparent\);/)
  assert.doesNotMatch(journeyCardBlock, /min-height:\s*100%|transition:|transform:/)
})

test('homepage hero fills the viewport below the responsive header without clipping content', async () => {
  const styles = await readFile(globalStylesPath, 'utf8')

  const mediumBreakpoint = styles.match(/@media \(min-width: 48rem\) \{[\s\S]*?\n\}/)?.[0] ?? ''
  const wideHeaderBreakpoint = styles.match(/@media \(min-width: 64rem\) \{[\s\S]*?\.messages-layout/)?.[0] ?? ''
  const desktopBreakpoint = styles.match(/@media \(min-width: 72rem\) \{[\s\S]*?\.service-browser__groups/)?.[0] ?? ''
  const desktopHeroBlock = desktopBreakpoint.match(/\.marketing-hero__inner\s*\{[^}]*\}/)?.[0] ?? ''
  const stackedBreakpoint = styles.match(/@media \(max-width: 71\.999rem\) \{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.doesNotMatch(mediumBreakpoint, /grid-template-columns:[^;]*marketing-hero|\.marketing-hero__inner\s*\{[\s\S]*?grid-template-columns/)
  assert.match(styles, /\.site-shell\s*\{[\s\S]*?--site-header-height: calc\(4\.75rem \+ 1px\);/)
  assert.match(styles, /\.site-header__inner\s*\{[\s\S]*?min-height: calc\(var\(--site-header-height\) - 1px\);/)
  assert.match(styles, /\.marketing-home > \[id\]\s*\{[\s\S]*?scroll-margin-top: var\(--site-header-height\);/)
  assert.match(styles, /\.marketing-hero\s*\{[\s\S]*?width: 100%;[\s\S]*?min-height: calc\(100vh - var\(--site-header-height\)\);[\s\S]*?min-height: calc\(100svh - var\(--site-header-height\)\);[\s\S]*?min-height: calc\(100dvh - var\(--site-header-height\)\);[\s\S]*?margin: 0;/)
  assert.match(styles, /\.marketing-hero__inner\s*\{[\s\S]*?width: min\(calc\(100% - 2rem\), 80rem\);[\s\S]*?min-height: inherit;/)
  assert.match(wideHeaderBreakpoint, /\.site-shell\s*\{[\s\S]*?--site-header-height: calc\(6rem \+ 1px\);/)
  assert.doesNotMatch(styles, /--homepage-header-height/)
  assert.doesNotMatch(desktopBreakpoint, /min-height: min\(34rem/)
  assert.match(desktopHeroBlock, /grid-template-columns: minmax\(0, 1\.6fr\) minmax\(23rem, 0\.7fr\);/)
  assert.match(stackedBreakpoint, /\.marketing-hero__content\s*\{[\s\S]*?text-align: center;/)
  assert.match(styles, /\.marketing-hero h1\s*\{[\s\S]*?font-size: clamp\(3rem, 8vw, 6\.5rem\);/)
  assert.match(desktopBreakpoint, /\.marketing-hero h1\s*\{[\s\S]*?font-size: clamp\(5\.25rem, 6vw, 6rem\);/)
  assert.doesNotMatch(styles, /marketing-hero__(visual|viewport|track|carousel-controls|load-error)|\.trust-strip|\.trust-card/)
})

test('homepage real business preview stays compact and responsive', async () => {
  const styles = await readFile(globalStylesPath, 'utf8')
  const previewGrid = readCssBlock(styles, '.homepage-business-preview__grid')

  assert.match(previewGrid, /display: grid;/)
  assert.match(previewGrid, /gap: 1rem;/)
  assert.match(styles, /\.homepage-business-preview__grid\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/)
  assert.match(styles, /@media \(min-width: 48rem\)[\s\S]*?\.homepage-business-preview__grid\s*\{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(styles, /@media \(min-width: 80rem\)[\s\S]*?\.homepage-business-preview__grid\s*\{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/)
  const tabletStart = styles.indexOf('@media (min-width: 48rem) {', styles.indexOf('@keyframes spin'))
  const tabletPreview = styles.slice(tabletStart, styles.indexOf('@media (min-width: 64rem)', tabletStart))
  const tabletPreviewGrid = tabletPreview.match(/\.homepage-business-preview__grid\s*\{[^}]*\}/)?.[0] ?? ''
  assert.match(tabletPreviewGrid, /repeat\(2, minmax\(0, 1fr\)\)/)
  assert.doesNotMatch(tabletPreviewGrid, /repeat\(3, minmax\(0, 1fr\)\)/)
  assert.doesNotMatch(previewGrid, /(?:min-)?height:|overflow-x:|grid-auto-rows:/)
  assert.doesNotMatch(previewGrid, /homepage-why/)
})

test('mobile header keeps the full brand visible while preserving controls', async () => {
  const styles = await readFile(globalStylesPath, 'utf8')
  const headerBlock = readCssBlock(styles, '.site-header__inner')
  const brandBlock = readCssBlock(styles, '.brand-lockup')
  const brandTextBlock = readCssBlock(styles, '.brand-lockup__text')
  const mobileHeaderBreakpoint = styles.match(/@media \(max-width: 63\.999rem\) \{[\s\S]*?@media \(max-width: 71\.999rem\)/)?.[0] ?? ''

  assert.match(headerBlock, /grid-template-columns: minmax\(0, 1fr\) auto;/)
  assert.match(headerBlock, /width: min\(calc\(100% - 1\.5rem\), 80rem\);/)
  assert.match(brandBlock, /min-width: 0;[\s\S]*?max-width: 100%;/)
  assert.match(brandTextBlock, /min-width: 0;[\s\S]*?max-width: 100%;[\s\S]*?flex: 1 1 auto;/)
  assert.match(mobileHeaderBreakpoint, /\.site-header \.brand-lockup__icon\s*\{[\s\S]*?width: 2\.4rem;/)
  assert.match(mobileHeaderBreakpoint, /\.site-header \.brand-lockup__text\s*\{[\s\S]*?width: clamp\(7rem, 31vw, 8\.5rem\);/)
  assert.match(mobileHeaderBreakpoint, /\.site-header \.select-field__button\s*\{[\s\S]*?min-width: 5rem;/)
})

test('services page uses the shared directory implementation and safe states', async () => {
  const [source, businessService, publicBusinessDirectory] = await Promise.all([
    readFile(servicesPath, 'utf8'),
    readFile(businessServicePath, 'utf8'),
    readFile(publicBusinessDirectoryPath, 'utf8'),
  ])

  assert.match(source, /getActivePublicBusinesses/)
  assert.match(source, /PublicBusinessCard/)
  assert.match(source, /businesses\.find\(\(candidate\) => candidate\.businessId === businessId\)/)
  assert.match(source, /parseServiceDiscoveryQuery\(searchParamsKey\)/)
  assert.match(source, /buildServiceSelectionSearchParams\(currentParams, serviceId\)/)
  assert.match(source, /serviceQuery\.type !== SERVICE_DISCOVERY_QUERY_TYPES\.NONE/)
  assert.match(source, /SERVICE_TAXONOMY_GROUPS\.map/)
  assert.match(source, /getServiceIdsForGroup\(selectedGroupId\)/)
  assert.match(source, /aria-pressed=\{selectedGroupId === group\.id\}/)
  assert.match(source, /const taxonomyStateToken = useMemo\(\(\) => \(\{ taxonomyQueryKey \}\), \[taxonomyQueryKey\]\)/)
  assert.match(source, /browseGroupOverride\.taxonomyStateToken === taxonomyStateToken/)
  assert.match(source, /setBrowseGroupOverride\(\{ groupId: group\.id, taxonomyStateToken \}\)/)
  assert.match(source, /activeBrowseGroupOverride \|\| derivedBrowseSelection\.groupId/)
  assert.doesNotMatch(source, /set\(['"]group['"]/)
  assert.match(source, /setSearchParams\(new URLSearchParams\(\), \{ replace: true \}\)/)
  assert.match(source, /publicBusinessDetail\.unavailableTitle/)
  assert.match(source, /publicBusinessDetail\.unavailableDescription/)
  assert.match(source, /services\.emptyTitle/)
  assert.match(source, /services\.emptyAction/)
  assert.match(source, /services\.loadError/)
  assert.match(source, /to=\{`\/services\/\$\{business\.businessId\}/)
  const listPublicGetter = readExportedFunction(
    businessService,
    'getActivePublicBusinesses',
    'getFeaturedActiveBusinesses',
  )
  const detailPublicGetter = readExportedFunction(
    businessService,
    'getPublicBusinessById',
    'getOwnerSubscriptionStatus',
  )
  assert.match(listPublicGetter, /loadPublicBusinessDirectory\(\{/)
  assert.match(listPublicGetter, /callPublicBusinesses: dependencies\.callPublicBusinesses \?\? listPublicBusinessesCallable/)
  assert.match(listPublicGetter, /maxResults: resultLimit/)
  assert.match(detailPublicGetter, /getPublicBusinessCallable\(\{ businessId \}\)/)
  for (const publicGetter of [listPublicGetter, detailPublicGetter]) {
    assert.doesNotMatch(publicGetter, /\b(?:getDoc|getDocs|collection|query)\s*\(/)
  }
  assert.match(publicBusinessDirectory, /isPublicBusinessEligible\(rawDocument\)/)
  assert.match(publicBusinessDirectory, /projectPublicContact\(business\.contact\)\.contact/)
  assert.match(publicBusinessDirectory, /resolveAuthoritativeBusinessEntitlements\(/)
  assert.doesNotMatch(publicBusinessDirectory, /return \{\s*business(?:es)?:\s*(?:business|snapshot)\.data\(\)/)
  assert.doesNotMatch(source, /example-|isDemo/)
})

test('account onboarding uses the trusted callable instead of direct role writes', async () => {
  const [
    userService,
    functionsClient,
    onboarding,
    businessRoute,
    businessService,
    businessDashboard,
    editBusiness,
    subscription,
    authenticationProvider,
    protectedRoute,
    routePolicy,
    profilePage,
    brandLockup,
  ] = await Promise.all([
    readFile(userServicePath, 'utf8'),
    readFile(functionsClientPath, 'utf8'),
    readFile(onboardingPath, 'utf8'),
    readFile(businessRoutePath, 'utf8'),
    readFile(businessServicePath, 'utf8'),
    readFile(businessDashboardPath, 'utf8'),
    readFile(editBusinessPath, 'utf8'),
    readFile(subscriptionPath, 'utf8'),
    readFile(authenticationProviderPath, 'utf8'),
    readFile(protectedRoutePath, 'utf8'),
    readFile(path.resolve(__dirname, '../src/routes/accountRoutePolicy.js'), 'utf8'),
    readFile(profilePagePath, 'utf8'),
    readFile(brandLockupPath, 'utf8'),
  ])

  assert.match(functionsClient, /httpsCallable\(functions, 'updateAccountRole'\)/)
  assert.match(userService, /updateAccountRoleCallable\(\{ accountType \}\)/)
  assert.doesNotMatch(userService, /roles,\s*$/m)
  assert.doesNotMatch(userService, /businessProfileRequired: roles\.includes/)
  assert.match(onboarding, /const fallback = requiresBusinessProfile \? '\/business\/dashboard' : '\/profile'/)
  assert.match(onboarding, /navigate\(internalPathFromLocation\(intendedLocation\(location\), fallback\)/)
  assert.match(onboarding, /<BrandLockup className="onboarding-card__logo" label=\{t\('onboarding\.logoAlt'\)\} linked=\{false\} variant="icon" \/>/)
  assert.doesNotMatch(onboarding, /logo-icon-display\.png/)
  assert.doesNotMatch(onboarding, /`\$\{brand\.name\} logo`/)
  assert.match(brandLockup, /if \(!linked\) \{[\s\S]*?<span className=\{classes\} role="img" aria-label=\{accessibleLabel\}>\{content\}<\/span>/)
  assert.match(brandLockup, /return <Link className=\{classes\} to=\{to\} aria-label=\{accessibleLabel\}>\{content\}<\/Link>/)
  assert.match(businessRoute, /userProfile\?\.roles\?\.includes\('business'\)/)
  assert.match(functionsClient, /httpsCallable\(functions, 'ensureOwnerBusiness'\)/)
  assert.match(businessService, /if \(userProfile\.businessId\)/)
  assert.match(businessService, /getManagedBusinessById\(userProfile\.businessId\)/)
  assert.match(businessService, /ensureOwnerBusinessCallable\(\)/)
  assert.match(businessService, /return getManagedBusinessById\(businessId\)/)
  assert.match(businessService, /return createBusinessProfile\(\)/)
  assert.match(businessDashboard, /ensureBusinessProfile\(userId, \{\s*businessId: userBusinessId,\s*roles: hasBusinessRole \? \['business'\] : \[\],\s*\}\)/s)
  assert.match(editBusiness, /ensureBusinessProfile\(userId, \{\s*businessId: userBusinessId,\s*roles: hasBusinessRole \? \['business'\] : \[\],\s*\}\)/s)
  for (const source of [businessDashboard, editBusiness]) {
    assert.match(source, /const attemptedProfileRefreshBusinessIdRef = useRef\(null\)/)
    assert.match(source, /profile\?\.businessId\s*&& profile\.businessId !== userBusinessId\s*&& attemptedProfileRefreshBusinessIdRef\.current !== profile\.businessId/s)
    assert.match(source, /attemptedProfileRefreshBusinessIdRef\.current = profile\.businessId\s*await refreshUserProfile\(\{ uid: userId \}, \{ background: true \}\)\.catch\(\(\) => undefined\)/s)
    assert.doesNotMatch(source, /\}, \[[^\]]*\buser,\s*user\.uid[^\]]*\]\)/s)
    assert.doesNotMatch(source, /\}, \[[^\]]*\buserProfile\b[^\]]*\]\)/s)
    assert.doesNotMatch(source, /refreshUserProfile\(user\)/)
  }
  assert.match(authenticationProvider, /refreshUserProfile = useCallback\(async \(firebaseUser = user, options = \{\}\)/)
  assert.match(authenticationProvider, /const background = options\.background === true/)
  assert.match(authenticationProvider, /setProfileLoading\(true\)/)
  assert.match(
    authenticationProvider,
    /if \(!background && requestId === profileRequestIdRef\.current\) setProfileLoading\(false\)/,
  )
  assert.match(routePolicy, /profileLoading \|\| profileStatus === 'loading'/)
  assert.match(businessRoute, /loading \|\| profileLoading \|\| profileStatus === 'loading'/)
  assert.match(profilePage, /refreshUserProfile\(user\)/)
  assert.doesNotMatch(profilePage, /refreshUserProfile\(user, \{ background: true \}\)/)
  assert.match(businessDashboard, /\}, \[hasBusinessRole, loadAttempt, refreshUserProfile, t, userBusinessId, userId\]\)/)
  assert.match(editBusiness, /hasBusinessRole,\s*loadAttempt,\s*refreshUserProfile,\s*t,\s*userBusinessId,\s*userCity,\s*userEmail,\s*userId,\s*userPreferredLocale,/s)
  assert.doesNotMatch(editBusiness, /getBusinessByOwnerId\(|createBusinessProfile\(/)
  assert.doesNotMatch(subscription, /ensureBusinessProfile|getBusinessByOwnerId|getOwnerSubscriptionStatus/)
  assert.doesNotMatch(businessService, /doc\(collection\(db, 'businesses'\)\)/)
  assert.doesNotMatch(businessService, /transaction\.set\(reference/)
})

test('profile restoration failures remain distinct from confirmed incomplete profiles', async () => {
  const [provider, protectedRoute, publicRoute, routePolicy, businessRoute, unavailableScreen] =
    await Promise.all([
      readFile(authenticationProviderPath, 'utf8'),
      readFile(protectedRoutePath, 'utf8'),
      readFile(publicRoutePath, 'utf8'),
      readFile(path.resolve(__dirname, '../src/routes/accountRoutePolicy.js'), 'utf8'),
      readFile(businessRoutePath, 'utf8'),
      readFile(blockedAccountScreenPath, 'utf8'),
    ])

  assert.match(provider, /useState\('loading'\)/)
  assert.match(provider, /setProfileStatus\(profile \? 'loaded' : 'absent'\)/)
  assert.match(
    provider,
    /catch \(error\) \{\s*if \(!background && requestId === profileRequestIdRef\.current\) \{\s*setUserProfile\(null\)\s*setProfileStatus\('unavailable'\)/s,
  )
  assert.match(
    provider,
    /setUserProfile\(profile\)\s*setProfileStatus\(profile \? 'loaded' : 'absent'\)[\s\S]*void updateLastActive\(user\.uid\)\.catch\(\(\) => undefined\)/,
  )
  assert.match(provider, /retryUserProfile/)
  assert.match(provider, /retainUnavailable: true/)

  for (const route of [protectedRoute, publicRoute]) {
    assert.match(route, /decision === 'profile_unavailable'/)
    assert.match(route, /<ProfileUnavailableScreen \/>/)
  }
  assert.match(businessRoute, /profileStatus === 'unavailable'/)
  assert.match(businessRoute, /<ProfileUnavailableScreen \/>/)

  assert.ok(routePolicy.indexOf("profileStatus === 'unavailable'") < routePolicy.indexOf('!allowUnverified && !emailVerified'))
  assert.ok(routePolicy.indexOf('!allowUnverified && !emailVerified') < routePolicy.indexOf('!allowMissingConsent && !hasCurrentLegalConsent'))
  assert.ok(routePolicy.indexOf('!allowMissingConsent && !hasCurrentLegalConsent') < routePolicy.indexOf("userProfile?.profileCompleted !== true"))
  assert.match(protectedRoute, /decision === 'profile_unavailable'/)
  assert.match(publicRoute, /decision === 'profile_unavailable'/)
  assert.match(unavailableScreen, /retryUserProfile/)
  assert.match(unavailableScreen, /signOutUser/)
  assert.match(unavailableScreen, /account\.profileUnavailable\.description/)
  assert.match(unavailableScreen, /getAuthenticationErrorMessage\(error, t\)/)
  assert.doesNotMatch(unavailableScreen, /error\.message/)
  assert.doesNotMatch(unavailableScreen, /complete-profile|onboarding/)
})

test('profile completion cannot fabricate legal consent for an absent profile', async () => {
  const [provider, completionPage, userService, rules] = await Promise.all([
    readFile(authenticationProviderPath, 'utf8'),
    readFile(path.resolve(__dirname, '../src/pages/auth/CompleteProfilePage.jsx'), 'utf8'),
    readFile(userServicePath, 'utf8'),
    readFile(path.resolve(__dirname, '../../../firestore.rules'), 'utf8'),
  ])

  assert.match(completionPage, /completeUserProfile\(\{/)
  assert.doesNotMatch(completionPage, /createUserProfile|completeAbsentUserProfile|setDoc|runTransaction/)
  assert.match(
    provider,
    /profileStatus === 'absent'\s*\? await completeAbsentUserProfile\(user, updates\)\s*: await updateUserProfileDocument\(user\.uid, updates\)/s,
  )
  assert.match(provider, /setUserProfile\(profile\)\s*setProfileStatus\('loaded'\)/)
  assert.match(userService, /export async function completeAbsentUserProfile\(firebaseUser, updates\)[\s\S]*?hasCurrentLegalConsent\(existingProfile\)/s)
  assert.doesNotMatch(userService, /completeAbsentUserProfile[\s\S]*?termsAccepted: true/)
  assert.doesNotMatch(userService, /completeAbsentUserProfile[\s\S]*?privacyAccepted: true/)
  assert.match(userService, /return updateUserProfile\(firebaseUser\.uid, updates\)/)
  assert.doesNotMatch(userService, /completeAbsentUserProfile[\s\S]*?(?:businesses|businessPrivate)/)
  assert.match(rules, /request\.resource\.data\.profileCompleted == false/)
  assert.match(rules, /validProfileCompletedUpdate\(\)/)
})

test('dirty business editor protects browser history with its existing confirmation dialog', async () => {
  const source = await readFile(editBusinessPath, 'utf8')

  assert.match(source, /window\.addEventListener\('beforeunload', warnBeforeUnload\)/)
  assert.match(source, /if \(!isDirty\) return undefined/)
  assert.match(source, /window\.addEventListener\('popstate', warnBeforeHistoryNavigation, true\)/)
  assert.match(source, /window\.removeEventListener\('popstate', warnBeforeHistoryNavigation, true\)/)
  assert.match(source, /document\.addEventListener\('click', warnBeforeInternalNavigation, true\)/)
  assert.match(source, /event\.stopImmediatePropagation\(\)/)
  assert.match(source, /delta: targetIndex - currentIndex/)
  assert.match(source, /window\.history\.go\(currentIndex - targetIndex\)/)
  assert.match(source, /if \(historyNavigation\.allowNext\) \{\s*historyNavigation\.allowNext = false/s)
  assert.match(source, /historyNavigationRef\.current\.allowNext = true/)
  assert.match(source, /window\.history\.go\(action\.delta\)/)
  assert.match(source, /const savedTaxonomy = deriveBusinessTaxonomyForm\(savedBusiness\)[\s\S]*setTaxonomyDirty\(false\)[\s\S]*setInitialDraftSignature\(draftSignature\(form, customLanguage, savedTaxonomy, false\)\)[\s\S]*setSaveSuccess\(true\)/)
  assert.match(source, /action\?\.type === 'signOut'[\s\S]*await signOutUser\(\)/)
  assert.match(source, /onClose=\{cancelPendingNavigation\}/)
  assert.equal((source.match(/id="unsaved-business-title"/g) ?? []).length, 1)
  assert.doesNotMatch(source, /window\.confirm\(/)
  assert.doesNotMatch(source, /useBlocker|unstable_useBlocker/)
})

test('shared header sign-out is awaited, classified, and duplicate-safe', async () => {
  const [header, styles] = await Promise.all([
    readFile(headerPath, 'utf8'),
    readFile(globalStylesPath, 'utf8'),
  ])

  assert.match(header, /async function handleSignOut\(\)/)
  assert.match(header, /if \(signOutPendingRef\.current\) return/)
  assert.match(header, /signOutPendingRef\.current = true/)
  assert.match(header, /await signOutUser\(\)/)
  assert.match(header, /catch \(signOutFailure\)/)
  assert.match(header, /getAuthenticationErrorMessage\(signOutFailure, t\)/)
  assert.match(header, /finally \{\s*signOutPendingRef\.current = false/s)
  assert.equal((header.match(/onClick=\{\(\) => void handleSignOut\(\)\}/g) ?? []).length, 2)
  assert.equal((header.match(/disabled=\{signingOut\}/g) ?? []).length, 2)
  assert.equal((header.match(/aria-busy=\{signingOut \|\| undefined\}/g) ?? []).length, 2)
  assert.match(header, /site-header__auth-error form-message form-message--error" role="alert"/)
  assert.match(header, /accountMenuRef\.current\?\.removeAttribute\('open'\)/)
  assert.match(header, /closeMobileMenu\(\)/)
  assert.doesNotMatch(header, /signOutFailure\.message|error\.message/)
  assert.doesNotMatch(header, /void signOutUser\(\)/)
  assert.doesNotMatch(header, /handleMobileSignOut/)
  assert.match(styles, /\.site-header__auth-error \{/)
})
