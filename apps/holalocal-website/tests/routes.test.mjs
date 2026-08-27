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
const authLayoutPath = path.resolve(__dirname, '../src/components/layout/AuthLayout.jsx')
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

test('normal push navigation scrolls to the top without overriding history or anchors', async () => {
  const [routes, scrollNavigation] = await Promise.all([
    readFile(routesPath, 'utf8'),
    readFile(scrollNavigationPath, 'utf8'),
  ])

  assert.match(routes, /<BrowserRouter>[\s\S]*?<ScrollToTopOnNavigation \/>/)
  assert.match(scrollNavigation, /useNavigationType\(\)/)
  assert.match(scrollNavigation, /navigationType !== 'PUSH'/)
  assert.match(scrollNavigation, /location\.hash/)
  assert.match(scrollNavigation, /window\.scrollTo\(\{ top: 0, left: 0, behavior: 'auto' \}\)/)
  assert.doesNotMatch(scrollNavigation, /popstate|onClick|scrollRestoration/)
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

test('signed-in mobile menu keeps public navigation and role-based account links together', async () => {
  const source = await readFile(headerPath, 'utf8')

  assert.match(source, /const publicNavigationLinks = \[/)
  assert.match(source, /mobile-navigation__group/)
  assert.match(source, /mobile-navigation__group--account/)
  assert.match(source, /publicNavigationLinks\.map\(\(link\) => \(/)
  assert.match(source, /<NavLink end=\{link\.to === '\/'\} key=\{link\.to\} onClick=\{closeMobileMenu\} to=\{link\.to\}>/)
  assert.match(source, /to="\/profile">\{t\('account\.profile'\)\}/)
  assert.match(source, /hasBusinessAccess && \(/)
  assert.match(source, /to="\/business\/dashboard">\{t\('account\.business'\)\}/)
  assert.match(source, /to="\/business\/subscription">\{t\('business\.subscription'\)\}/)
  assert.match(source, /to="\/messages"/)
  assert.match(source, /async function handleSignOut\(\)/)
  assert.match(source, /useLocation\(\)/)
  assert.match(source, /location\.pathname/)
  assert.match(source, /location\.search/)
  assert.match(source, /useCallback\(function closeMobileMenu/)
  assert.doesNotMatch(source, /Home<\/NavLink>|Find Services<\/NavLink>|Contact<\/NavLink>|My profile<\/NavLink>/)
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

test('homepage CTAs use production public routes', async () => {
  const source = await readFile(homePath, 'utf8')

  assert.match(source, /to: '\/services'/)
  assert.match(source, /to: '\/register\?intent=business'/)
  assert.match(source, /to="\/services"/)
  assert.match(source, /marketing\.homepage\.hero\.customerAction/)
  assert.match(source, /marketing\.homepage\.hero\.businessAction/)
  assert.doesNotMatch(source, /to="\/business\/dashboard"/)
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
  assert.match(home, /<Link key=\{group\.id\} to="\/services">/)
  assert.match(home, /getHomepageServiceHref\(serviceId\)/)
  assert.match(home, /\{ key: 'events', live: false \}/)
  assert.match(home, /\{ key: 'community', live: false \}/)
  assert.doesNotMatch(home, /to="\/(events|community)"|\?group=|\?category=/)
  assert.match(styles, /\.homepage-service-groups a\s*\{[\s\S]*?min-height: 3\.75rem;/)
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

test('public business detail uses i18n while preserving business data and action wiring', async () => {
  const [detail, services] = await Promise.all([
    readFile(businessDetailPath, 'utf8'),
    readFile(servicesPath, 'utf8'),
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
  assert.match(detail, /t\('publicBusinessDetail\.verificationComingSoon'\)/)
  assert.doesNotMatch(detail, /verificationStatus === 'verified'/)

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

  assert.match(home, /\{ key: 'local', icon: 'identity' \}/)
  assert.match(home, /\{ key: 'multilingual', icon: 'language' \}/)
  assert.match(home, /\{ key: 'real', icon: 'briefcase' \}/)
  assert.doesNotMatch(home, /verified|background check|testimonial|ratingCount|customerCount/i)
})

test('footer layout uses a single aligned responsive grid', async () => {
  const styles = await readFile(globalStylesPath, 'utf8')

  assert.match(styles, /\.site-footer__inner\s*\{[\s\S]*?text-align: left;/)
  assert.match(styles, /\.site-footer__navigation\s*\{[\s\S]*?repeat\(auto-fit, minmax\(8\.75rem, 1fr\)\)/)
  assert.match(styles, /@media \(min-width: 64rem\)[\s\S]*?\.site-footer__navigation\s*\{[\s\S]*?repeat\(4, minmax\(7rem, 1fr\)\)/)
  assert.match(styles, /\.site-footer__links\s*\{[\s\S]*?gap: 0\.15rem;/)
  assert.match(styles, /\.site-footer__links a\s*\{[\s\S]*?min-height: 2rem;[\s\S]*?padding: 0\.2rem 0;[\s\S]*?overflow-wrap: anywhere;/)
  assert.match(styles, /@media \(max-width: 47\.999rem\)[\s\S]*?\.site-footer__links a\s*\{[\s\S]*?min-height: 2\.35rem;/)
  assert.doesNotMatch(styles, /\.site-footer__navigation\s*\{[\s\S]*?justify-content: end;/)
  assert.doesNotMatch(styles, /\.site-footer__links\s*\{[\s\S]*?align-items: flex-end;/)
})

test('homepage service groups use a compact responsive grid', async () => {
  const [home, styles] = await Promise.all([
    readFile(homePath, 'utf8'),
    readFile(globalStylesPath, 'utf8'),
  ])

  assert.match(home, /SERVICE_TAXONOMY_GROUPS\.map/)
  assert.match(styles, /\.homepage-service-groups\s*\{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(styles, /@media \(min-width: 48rem\)[\s\S]*?\.homepage-service-groups,[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(styles, /@media \(min-width: 72rem\)[\s\S]*?\.homepage-service-groups\s*\{[\s\S]*?repeat\(6, minmax\(0, 1fr\)\)/)
  assert.doesNotMatch(styles, /\.homepage-service-groups[\s\S]*?white-space:\s*nowrap/)
})

test('homepage card sections use compact content-driven vertical rhythm', async () => {
  const styles = await readFile(globalStylesPath, 'utf8')
  const marketingCardBlock = readCssBlock(styles, '.marketing-card')
  const journeyCardBlock = readCssBlock(styles, '.journey-card')

  assert.match(styles, /\.marketing-section\s*\{[\s\S]*?padding-block: 4rem;/)
  assert.match(styles, /\.marketing-home \.marketing-section\s*\{[\s\S]*?padding-block: clamp\(2\.75rem, 6vw, 4\.25rem\);/)
  assert.match(styles, /\.marketing-card-grid\s*\{[\s\S]*?margin-top: 1\.6rem;/)
  assert.match(styles, /\.journey-grid\s*\{[\s\S]*?margin-top: 1\.6rem;/)
  assert.match(styles, /\.marketing-card\s*\{[\s\S]*?display: grid;[\s\S]*?min-width: 0;[\s\S]*?align-content: start;[\s\S]*?padding: 1\.35rem;/)
  assert.match(styles, /\.journey-card\s*\{[\s\S]*?display: flex;[\s\S]*?min-width: 0;[\s\S]*?flex-direction: column;[\s\S]*?padding: 1\.35rem;/)
  assert.match(styles, /\.journey-card > a\s*\{[\s\S]*?margin-top: auto;[\s\S]*?padding-top: 1\.1rem;/)
  assert.match(styles, /@media \(min-width: 48rem\)[\s\S]*?\.marketing-card\s*\{[\s\S]*?padding: 2rem;/)
  assert.match(styles, /@media \(min-width: 48rem\)[\s\S]*?\.journey-card\s*\{[\s\S]*?padding: 2rem;/)
  assert.doesNotMatch(marketingCardBlock, /\n\s{2}height:\s*\d/)
  assert.doesNotMatch(journeyCardBlock, /\n\s{2}height:\s*\d/)
})

test('homepage hero fills the viewport below the responsive header without clipping content', async () => {
  const styles = await readFile(globalStylesPath, 'utf8')

  const mediumBreakpoint = styles.match(/@media \(min-width: 48rem\) \{[\s\S]*?\n\}/)?.[0] ?? ''
  const wideHeaderBreakpoint = styles.match(/@media \(min-width: 64rem\) \{[\s\S]*?\.messages-layout/)?.[0] ?? ''
  const desktopBreakpoint = styles.match(/@media \(min-width: 72rem\) \{[\s\S]*?\.service-browser__groups/)?.[0] ?? ''
  const stackedBreakpoint = styles.match(/@media \(max-width: 71\.999rem\) \{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.doesNotMatch(mediumBreakpoint, /grid-template-columns:[^;]*marketing-hero|\.marketing-hero\s*\{[\s\S]*?grid-template-columns/)
  assert.match(styles, /\.marketing-hero\s*\{[\s\S]*?--homepage-header-height: calc\(4\.75rem \+ 1px\);[\s\S]*?min-height: calc\(100vh - var\(--homepage-header-height\) - 1rem\);[\s\S]*?min-height: calc\(100svh - var\(--homepage-header-height\) - 1rem\);[\s\S]*?min-height: calc\(100dvh - var\(--homepage-header-height\) - 1rem\);/)
  assert.match(wideHeaderBreakpoint, /\.marketing-hero\s*\{[\s\S]*?--homepage-header-height: calc\(6rem \+ 1px\);/)
  assert.doesNotMatch(desktopBreakpoint, /min-height: min\(34rem/)
  assert.doesNotMatch(desktopBreakpoint, /grid-template-columns:[^;]*24rem/)
  assert.match(stackedBreakpoint, /\.marketing-hero__content\s*\{[\s\S]*?text-align: center;/)
  assert.match(styles, /\.marketing-hero h1\s*\{[\s\S]*?font-size: clamp\(3rem, 8vw, 6\.5rem\);/)
  assert.doesNotMatch(styles, /marketing-hero__(visual|viewport|track|carousel-controls|load-error)|\.trust-strip|\.trust-card/)
})

test('homepage real business preview stays compact and responsive', async () => {
  const styles = await readFile(globalStylesPath, 'utf8')
  const previewGrid = readCssBlock(styles, '.homepage-platform__grid,\n.homepage-why__grid,\n.homepage-business-preview__grid')

  assert.match(previewGrid, /display: grid;/)
  assert.match(previewGrid, /gap: 1rem;/)
  assert.match(styles, /\.homepage-business-preview__grid\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/)
  assert.match(styles, /@media \(min-width: 48rem\)[\s\S]*?\.homepage-business-preview__grid\s*\{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/)
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
  assert.match(listPublicGetter, /listPublicBusinessesCallable\(\{ maxResults: resultLimit \}\)/)
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
  assert.match(onboarding, /navigate\(internalPathFromLocation\(location\.state\?\.from, fallback\)/)
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
  assert.match(subscription, /ensureBusinessProfile\(userId, \{\s*businessId: userBusinessId,\s*roles: hasBusinessRole \? \['business'\] : \[\],\s*\}\)/s)
  for (const source of [businessDashboard, editBusiness, subscription]) {
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
  assert.match(subscription, /\}, \[hasBusinessRole, loadAttempt, refreshUserProfile, t, userBusinessId, userId\]\)/)
  assert.match(editBusiness, /hasBusinessRole,\s*loadAttempt,\s*refreshUserProfile,\s*t,\s*userBusinessId,\s*userCity,\s*userEmail,\s*userId,\s*userPreferredLocale,/s)
  assert.doesNotMatch(editBusiness, /getBusinessByOwnerId\(|createBusinessProfile\(/)
  assert.doesNotMatch(subscription, /getBusinessByOwnerId\(/)
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
