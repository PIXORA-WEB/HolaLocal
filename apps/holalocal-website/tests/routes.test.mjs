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

function readCssBlock(styles, selector) {
  const start = styles.indexOf(`${selector} {`)
  assert.notEqual(start, -1, `Expected CSS selector ${selector}`)
  const end = styles.indexOf('\n}', start)
  assert.notEqual(end, -1, `Expected CSS block for ${selector}`)
  return styles.slice(start, end + 2)
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
  assert.match(source, /to="\/register\?intent=customer"/)
  assert.match(source, /to="\/services"/)
  assert.doesNotMatch(source, /to="\/business\/dashboard"/)
  assert.doesNotMatch(source, /href="#|to="#/)
})

test('homepage example cards are generic, translated, labelled, and non-clickable', async () => {
  const [home, card] = await Promise.all([
    readFile(homePath, 'utf8'),
    readFile(path.resolve(__dirname, '../src/components/common/PublicBusinessCard.jsx'), 'utf8'),
  ])

  assert.match(home, /nameKey: 'marketing\.hero\.exampleCleaningName'/)
  assert.match(home, /nameKey: 'marketing\.hero\.exampleGardenName'/)
  assert.match(home, /nameKey: 'marketing\.hero\.exampleRepairsName'/)
  assert.match(home, /name: t\(business\.nameKey\)/)
  assert.doesNotMatch(home, /Costa Clean Marbella|Sol Garden Care|Gibraltar Home Fix/)
  assert.match(home, /category: 'Cleaning'/)
  assert.match(home, /category: 'Gardening'/)
  assert.match(home, /category: 'Handyman'/)
  assert.match(home, /languages: \['en', 'es'\]/)
  assert.match(home, /to=\{business\.isDemo \? undefined : `\/services\/\$\{business\.businessId\}`\}/)
  assert.match(card, /getBusinessCategoryLabel\(business\.category, t\)/)
  assert.match(card, /formatLanguageList\(languages, i18n\.resolvedLanguage \?\? i18n\.language\)/)
  assert.match(card, /t\('services\.noReviews'\)/)
  assert.match(card, /t\(business\.isDemo \? 'marketing\.hero\.exampleProfile' : 'marketing\.hero\.activeProfile'\)/)
  assert.doesNotMatch(card, /marketing\.hero\.verifiedProfile/)
  assert.doesNotMatch(card, /isHero && isVerified && <span aria-hidden="true">✓<\/span>/)
  assert.doesNotMatch(await readFile(globalStylesPath, 'utf8'), /\.public-business-card--hero \.public-business-card__heading > span\.is-verified/)
})

test('homepage only supplements successful directory results with examples', async () => {
  const home = await readFile(homePath, 'utf8')

  assert.match(home, /setDirectoryStatus\('success'\)/)
  assert.match(home, /setDirectoryStatus\('error'\)/)
  assert.match(home, /const businesses = directoryStatus === 'success'/)
  assert.match(home, /fallbackBusinesses\.slice\(0, Math\.max\(0, 3 - featuredBusinesses\.length\)\)/)
  assert.match(home, /directoryStatus === 'error' \? \(/)
  assert.match(home, /t\('marketing\.hero\.loadFailure'\)/)
  assert.match(home, /className="marketing-hero__load-error" role="alert"/)
  assert.match(home, /onClick=\{retryDirectoryLoad\}/)
  assert.match(home, /t\('common\.retry'\)/)
  assert.doesNotMatch(home, /\.catch\(\(\) => \{\s*if \(isCurrent\) setFeaturedBusinesses\(\[\]\)/)
})

test('homepage hero preview uses accessible native carousel controls on mobile', async () => {
  const [home, styles] = await Promise.all([
    readFile(homePath, 'utf8'),
    readFile(globalStylesPath, 'utf8'),
  ])
  const tabletBreakpoint = styles.match(/@media \(min-width: 48rem\) \{[\s\S]*?\n\}\n\n@media \(min-width: 64rem\)/)?.[0] ?? ''

  assert.match(home, /useRef\(null\)/)
  assert.match(home, /const HERO_DESKTOP_MEDIA_QUERY = '\(min-width: 72rem\)'/)
  assert.match(home, /function getScrollBehavior\(\)/)
  assert.match(home, /function getCardScrollLeft\(track, card\)/)
  assert.match(home, /prefers-reduced-motion: reduce/)
  assert.match(home, /className="marketing-hero__track"/)
  assert.match(home, /onScroll=\{updateCurrentHeroIndex\}/)
  assert.match(home, /ref=\{heroTrackRef\}/)
  assert.match(home, /className="marketing-hero__carousel-controls"/)
  assert.match(home, /aria-label=\{t\('marketing\.hero\.previousBusiness'\)\}/)
  assert.match(home, /aria-label=\{t\('marketing\.hero\.nextBusiness'\)\}/)
  assert.match(home, /id="marketing-hero-preview-position" aria-live="polite"/)
  assert.match(home, /t\('marketing\.hero\.businessPosition'/)
  assert.match(home, /const displayedHeroIndex = Math\.min\(currentHeroIndex, Math\.max\(0, businesses\.length - 1\)\)/)
  assert.match(home, /disabled=\{displayedHeroIndex === 0\}/)
  assert.match(home, /disabled=\{displayedHeroIndex >= businesses\.length - 1\}/)
  assert.match(home, /track\.scrollTo\(\{ left: getCardScrollLeft\(track, card\), behavior \}\)/)
  assert.match(home, /window\.matchMedia\(HERO_DESKTOP_MEDIA_QUERY\)/)
  assert.match(home, /mediaQuery\.addEventListener\('change', handleHeroModeChange\)/)
  assert.match(home, /mediaQuery\.removeEventListener\('change', handleHeroModeChange\)/)
  assert.match(home, /track\.scrollTo\(\{ left: 0, behavior: 'auto' \}\)/)
  assert.match(home, /new ResizeObserver\(\(\) => \{/)
  assert.match(home, /observer\.disconnect\(\)/)
  assert.doesNotMatch(home, /card\.scrollIntoView/)
  assert.doesNotMatch(home, /window\.addEventListener\('resize'/)
  assert.doesNotMatch(home, /setInterval|setTimeout|autoplay|autoPlay/)
  assert.match(styles, /\.marketing-hero__track\s*\{[\s\S]*?display: flex;[\s\S]*?overflow-x: auto;[\s\S]*?scroll-snap-type: x mandatory;/)
  assert.match(styles, /\.marketing-hero__carousel-controls button\s*\{[\s\S]*?width: 2\.35rem;[\s\S]*?height: 2\.35rem;/)
  assert.doesNotMatch(tabletBreakpoint, /\.marketing-hero__carousel-controls\s*\{[\s\S]*?display: none;/)
  assert.match(styles, /@media \(min-width: 72rem\)[\s\S]*?\.marketing-hero__carousel-controls\s*\{[\s\S]*?display: none;/)
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
  assert.match(services, /getOrCreateConversationForBusiness\(user\.uid, selectedBusiness\)/)
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

test('homepage trust card presents business verification as coming soon', async () => {
  const [home, styles] = await Promise.all([
    readFile(homePath, 'utf8'),
    readFile(globalStylesPath, 'utf8'),
  ])

  assert.match(home, /\{ key: 'verified', icon: 'shield', statusKey: 'comingSoon' \}/)
  assert.match(home, /shield: <><path d="M12 3\.5 19 6v5\.6c0 4\.2-2\.6 7\.4-7 8\.9-4\.4-1\.5-7-4\.7-7-8\.9V6l7-2\.5Z" \/><path d="M9 12h6" \/><\/>/)
  assert.match(home, /<div className="trust-card__heading">/)
  assert.match(home, /\{statusKey && <span>\{t\(`marketing\.trust\.\$\{key\}\.\$\{statusKey\}`\)\}<\/span>\}/)
  assert.doesNotMatch(home, /\{ key: 'verified', icon: 'verified' \}/)
  assert.doesNotMatch(home, /m8\.4 12\.1 2\.3 2\.3 4\.9-5/)
  assert.match(styles, /\.trust-card__heading\s*\{[\s\S]*?flex-wrap: wrap;[\s\S]*?align-items: center;/)
  assert.match(styles, /\.trust-card__heading span\s*\{[\s\S]*?color: #475569;[\s\S]*?background: #eef2f7;[\s\S]*?overflow-wrap: anywhere;/)
  assert.doesNotMatch(styles, /\.trust-card__heading span[\s\S]*?background:[^;]*var\(--brand-green\)/)
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

test('homepage benefits strip centers grouped labels without forcing no-wrap text', async () => {
  const [home, styles] = await Promise.all([
    readFile(homePath, 'utf8'),
    readFile(globalStylesPath, 'utf8'),
  ])

  assert.match(home, /<section className="trust-strip"/)
  assert.match(home, /<p key=\{item\}><span>✓<\/span>\{t\(`marketing\.trustStrip\.\$\{item\}`\)\}<\/p>/)
  assert.match(styles, /\.trust-strip p\s*\{[\s\S]*?align-items: center;[\s\S]*?justify-content: center;[\s\S]*?min-width: 0;[\s\S]*?text-align: center;[\s\S]*?overflow-wrap: anywhere;/)
  assert.match(styles, /\.trust-strip span\s*\{[\s\S]*?flex: 0 0 auto;/)
  assert.match(styles, /@media \(min-width: 48rem\)[\s\S]*?\.trust-strip\s*\{[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/)
  assert.match(styles, /@media \(min-width: 48rem\)[\s\S]*?\.trust-strip p\s*\{[\s\S]*?border-right: 1px solid var\(--line\);[\s\S]*?border-bottom: 0;/)
  assert.doesNotMatch(styles, /\.trust-strip[\s\S]*?white-space:\s*nowrap/)
})

test('homepage card sections use compact content-driven vertical rhythm', async () => {
  const styles = await readFile(globalStylesPath, 'utf8')
  const marketingCardBlock = readCssBlock(styles, '.marketing-card')
  const journeyTrustCardBlock = readCssBlock(styles, '.journey-card,\n.trust-card')

  assert.match(styles, /\.marketing-section\s*\{[\s\S]*?padding-block: 4rem;/)
  assert.match(styles, /@media \(min-width: 48rem\)[\s\S]*?\.marketing-section\s*\{[\s\S]*?padding-block: 4\.75rem;/)
  assert.match(styles, /\.marketing-card-grid\s*\{[\s\S]*?margin-top: 1\.6rem;/)
  assert.match(styles, /\.journey-grid,\n\.trust-card-grid\s*\{[\s\S]*?margin-top: 1\.6rem;/)
  assert.match(styles, /\.marketing-card\s*\{[\s\S]*?display: grid;[\s\S]*?min-width: 0;[\s\S]*?align-content: start;[\s\S]*?padding: 1\.35rem;/)
  assert.match(styles, /\.journey-card,\n\.trust-card\s*\{[\s\S]*?display: flex;[\s\S]*?min-width: 0;[\s\S]*?flex-direction: column;[\s\S]*?padding: 1\.35rem;/)
  assert.match(styles, /\.journey-card > a\s*\{[\s\S]*?margin-top: auto;[\s\S]*?padding-top: 1\.1rem;/)
  assert.match(styles, /@media \(min-width: 48rem\)[\s\S]*?\.marketing-card\s*\{[\s\S]*?padding: 2rem;/)
  assert.match(styles, /@media \(min-width: 48rem\)[\s\S]*?\.journey-card,\n  \.trust-card\s*\{[\s\S]*?padding: 2rem;/)
  assert.doesNotMatch(marketingCardBlock, /\n\s{2}height:\s*\d/)
  assert.doesNotMatch(journeyTrustCardBlock, /\n\s{2}height:\s*\d/)
})

test('homepage hero stacks before intermediate-width column collision', async () => {
  const styles = await readFile(globalStylesPath, 'utf8')

  const mediumBreakpoint = styles.match(/@media \(min-width: 48rem\) \{[\s\S]*?\n\}/)?.[0] ?? ''
  const desktopBreakpoint = styles.match(/@media \(min-width: 72rem\) \{[\s\S]*?\.trust-card-grid/)?.[0] ?? ''
  const stackedBreakpoint = styles.match(/@media \(max-width: 71\.999rem\) \{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.doesNotMatch(mediumBreakpoint, /grid-template-columns:[^;]*marketing-hero|\.marketing-hero\s*\{[\s\S]*?grid-template-columns/)
  assert.match(desktopBreakpoint, /\.marketing-hero\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1\.05fr\) minmax\(24rem, 0\.95fr\)/)
  assert.match(stackedBreakpoint, /\.marketing-hero__content\s*\{[\s\S]*?text-align: center;/)
  assert.match(styles, /\.marketing-hero__visual\s*\{[\s\S]*?width: min\(100%, 39rem\);/)
  assert.match(styles, /\.marketing-hero h1\s*\{[\s\S]*?font-size: clamp\(3rem, 8vw, 6\.5rem\);/)
})

test('homepage hero preview cards stay compact and content-driven', async () => {
  const styles = await readFile(globalStylesPath, 'utf8')
  const previewPanelBlock = readCssBlock(styles, '.marketing-hero__visual')
  const trackBlock = readCssBlock(styles, '.marketing-hero__track')
  const heroCardBlock = readCssBlock(styles, '.public-business-card--hero')
  const heroHeadingBlock = readCssBlock(styles, '.public-business-card--hero .public-business-card__heading')
  const heroBodyBlock = readCssBlock(styles, '.public-business-card__hero-body')
  const desktopBreakpoint = styles.match(/@media \(min-width: 72rem\) \{[\s\S]*?\.trust-card-grid/)?.[0] ?? ''

  assert.match(previewPanelBlock, /gap: 0\.75rem;/)
  assert.match(previewPanelBlock, /padding: 0\.85rem;/)
  assert.match(previewPanelBlock, /box-sizing: border-box;/)
  assert.match(previewPanelBlock, /margin-inline: auto;/)
  assert.doesNotMatch(previewPanelBlock, /\n\s{2}height:\s*\d|\n\s{2}min-height:\s*\d/)
  assert.match(trackBlock, /overflow-x: auto;/)
  assert.match(trackBlock, /scroll-snap-type: x mandatory;/)
  assert.match(heroCardBlock, /grid-template-columns: 3\.75rem minmax\(0, 1fr\);/)
  assert.match(heroCardBlock, /grid-template-rows: auto auto;/)
  assert.match(heroCardBlock, /width: 100%;/)
  assert.match(heroCardBlock, /flex: 0 0 100%;/)
  assert.match(heroCardBlock, /padding: 0\.85rem;/)
  assert.doesNotMatch(heroCardBlock, /\n\s{2}height:\s*\d|\n\s{2}min-height:\s*\d/)
  assert.match(heroHeadingBlock, /display: flex;[\s\S]*?flex-wrap: wrap;[\s\S]*?align-items: flex-start;/)
  assert.match(styles, /\.public-business-card--hero \.public-business-card__heading > div\s*\{[\s\S]*?flex: 1 1 8rem;[\s\S]*?min-width: 0;/)
  assert.match(styles, /\.public-business-card--hero \.public-business-card__heading > span\s*\{[\s\S]*?flex: 0 1 auto;[\s\S]*?margin-left: auto;[\s\S]*?overflow-wrap: anywhere;/)
  assert.match(heroBodyBlock, /gap: 0\.45rem 0\.8rem;/)
  assert.match(styles, /\.public-business-card__hero-meta\s*\{[\s\S]*?gap: 0\.25rem;/)
  assert.match(styles, /\.public-business-card__hero-meta div\s*\{[\s\S]*?gap: 0\.34rem;[\s\S]*?align-items: flex-start;/)
  assert.doesNotMatch(styles, /@media \(min-width: 48rem\)[\s\S]*?\.public-business-card--hero\s*\{[\s\S]*?flex-basis: min\(82vw, 20rem\);/)
  assert.match(desktopBreakpoint, /\.marketing-hero__track\s*\{[\s\S]*?display: grid;[\s\S]*?overflow: visible;[\s\S]*?scroll-snap-type: none;/)
  assert.match(desktopBreakpoint, /\.public-business-card--hero\s*\{[\s\S]*?flex-basis: auto;/)
  assert.doesNotMatch(desktopBreakpoint, /\.marketing-hero__visual\s*\{[\s\S]*?min-height: 36rem;/)
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
  const [source, businessService] = await Promise.all([
    readFile(servicesPath, 'utf8'),
    readFile(businessServicePath, 'utf8'),
  ])

  assert.match(source, /getActivePublicBusinesses/)
  assert.match(source, /PublicBusinessCard/)
  assert.match(source, /const selectedBusiness = businesses\.find/)
  assert.match(source, /publicBusinessDetail\.unavailableTitle/)
  assert.match(source, /publicBusinessDetail\.unavailableDescription/)
  assert.match(source, /services\.emptyTitle/)
  assert.match(source, /services\.emptyAction/)
  assert.match(source, /services\.loadError/)
  assert.match(source, /to=\{`\/services\/\$\{business\.businessId\}/)
  assert.match(businessService, /toPublicBusiness\(snapshot\)/)
  assert.match(businessService, /listPublicBusinessesCallable\(\{ maxResults: resultLimit \}\)/)
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
    profilePage,
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
    readFile(profilePagePath, 'utf8'),
  ])

  assert.match(functionsClient, /httpsCallable\(functions, 'updateAccountRole'\)/)
  assert.match(userService, /updateAccountRoleCallable\(\{ accountType \}\)/)
  assert.doesNotMatch(userService, /roles,\s*$/m)
  assert.doesNotMatch(userService, /businessProfileRequired: roles\.includes/)
  assert.match(onboarding, /navigate\(requiresBusinessProfile \? '\/business\/dashboard' : '\/profile'/)
  assert.match(onboarding, /alt=\{t\('onboarding\.logoAlt'\)\}/)
  assert.doesNotMatch(onboarding, /`\$\{brand\.name\} logo`/)
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
  assert.match(protectedRoute, /profileLoading \|\| profileStatus === 'loading'/)
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
  const [provider, protectedRoute, publicRoute, businessRoute, unavailableScreen] =
    await Promise.all([
      readFile(authenticationProviderPath, 'utf8'),
      readFile(protectedRoutePath, 'utf8'),
      readFile(publicRoutePath, 'utf8'),
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

  for (const route of [protectedRoute, publicRoute, businessRoute]) {
    assert.match(route, /profileStatus === 'unavailable'/)
    assert.match(route, /<ProfileUnavailableScreen \/>/)
  }

  assert.ok(
    protectedRoute.indexOf("profileStatus === 'unavailable'") <
      protectedRoute.indexOf("userProfile?.profileCompleted !== true"),
  )
  assert.ok(
    protectedRoute.indexOf('!allowUnverified && !emailVerified') <
      protectedRoute.indexOf("profileStatus === 'unavailable'"),
  )
  assert.ok(
    publicRoute.indexOf("profileStatus === 'unavailable'") <
      publicRoute.indexOf("userProfile?.profileCompleted !== true"),
  )
  assert.ok(
    publicRoute.indexOf('!emailVerified') <
      publicRoute.indexOf("profileStatus === 'unavailable'"),
  )
  assert.match(unavailableScreen, /retryUserProfile/)
  assert.match(unavailableScreen, /signOutUser/)
  assert.match(unavailableScreen, /account\.profileUnavailable\.description/)
  assert.match(unavailableScreen, /getAuthenticationErrorMessage\(error, t\)/)
  assert.doesNotMatch(unavailableScreen, /error\.message/)
  assert.doesNotMatch(unavailableScreen, /complete-profile|onboarding/)
})

test('confirmed absent profile completion uses the canonical race-safe creation path', async () => {
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
  assert.match(
    userService,
    /export async function completeAbsentUserProfile\(firebaseUser, updates\)[\s\S]*?runTransaction\(db, async \(transaction\) => \{[\s\S]*?if \(snapshot\.exists\(\)\) return[\s\S]*?transaction\.set\(reference, buildNewProfile\(firebaseUser\.uid,/s,
  )
  assert.match(userService, /termsAccepted: true,\s*termsVersion: POLICY_VERSION/s)
  assert.match(userService, /privacyAccepted: true,\s*privacyVersion: POLICY_VERSION/s)
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
  assert.match(source, /setInitialDraftSignature\(currentDraftSignature\)\s*setSaveSuccess\(true\)/)
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
