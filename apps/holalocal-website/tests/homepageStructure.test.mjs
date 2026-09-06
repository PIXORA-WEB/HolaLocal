import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'
import { SERVICE_TAXONOMY_GROUPS } from '../../../shared/firebase-contract/index.js'

const homeUrl = new URL('../src/pages/HomePage.jsx', import.meta.url)
const stylesUrl = new URL('../src/styles/global.css', import.meta.url)
const translationsUrl = new URL('../src/i18n/locales/homepagePlatformTranslations.js', import.meta.url)
const illustrationsUrl = new URL('../src/assets/illustrations/', import.meta.url)
const heroSceneUrls = [
  new URL('../src/assets/illustrations/homepage-coastal-community.webp', import.meta.url),
  new URL('../src/assets/illustrations/homepage-coastal-community-mobile.webp', import.meta.url),
  new URL('../src/assets/illustrations/homepage-coastal-community-tablet.webp', import.meta.url),
]

test('homepage uses the six central groups and canonical service handoff', async () => {
  const source = await readFile(homeUrl, 'utf8')

  assert.equal(SERVICE_TAXONOMY_GROUPS.length, 6)
  assert.match(source, /SERVICE_TAXONOMY_GROUPS\.map\(\(group\) =>/)
  assert.match(source, /<Link data-service-group=\{group\.id\} key=\{group\.id\} to="\/services">/)
  assert.match(source, /getHomepageServiceHref\(serviceId\)/)
  assert.doesNotMatch(source, /\?group=|\?category=/)
})

test('homepage service categories use one complete decorative icon map', async () => {
  const [source, iconSource] = await Promise.all([
    readFile(homeUrl, 'utf8'),
    readFile(new URL('../src/components/common/ServiceCategoryIcon.jsx', import.meta.url), 'utf8'),
  ])
  const iconMap = iconSource.match(/const SERVICE_CATEGORY_ICONS = Object\.freeze\(\{[\s\S]*?\n\}\)/)?.[0] ?? ''
  const iconComponent = iconSource.match(/function ServiceCategoryIcon\(\{ groupId \}\) \{[\s\S]*?\n\}/)?.[0] ?? ''

  for (const { id } of SERVICE_TAXONOMY_GROUPS) {
    assert.match(iconMap, new RegExp(`['"]?${id}['"]?:`), `${id} icon mapping`)
  }
  assert.equal((iconMap.match(/^  (?:'[^']+'|pets):/gm) ?? []).length, 6)
  assert.match(iconComponent, /if \(!icon\) throw new Error/)
  assert.match(iconComponent, /aria-hidden="true"/)
  assert.match(iconComponent, /focusable="false"/)
  assert.match(iconComponent, /fill="none"/)
  assert.match(iconComponent, /stroke="currentColor"/)
  assert.match(iconComponent, /strokeWidth="1\.8"/)
  assert.match(iconComponent, /strokeLinecap="round"/)
  assert.match(iconComponent, /strokeLinejoin="round"/)
  assert.match(iconComponent, /viewBox="0 0 24 24"/)
  assert.equal(iconSource.match(/function ServiceCategoryIcon/g)?.length, 1)
  assert.match(source, /import ServiceCategoryIcon from '\.\.\/components\/common\/ServiceCategoryIcon\.jsx'/)
  assert.match(source, /<ServiceCategoryIcon groupId=\{group\.id\} \/>/)
  assert.match(source, /className="homepage-service-group__label">\{taxonomyLabel\(group\)\}<\/span>/)
  assert.doesNotMatch(source, /homepage-service-group__arrow/)
  assert.doesNotMatch(source, /from ['"](?:lucide|@heroicons|react-icons|@fortawesome)/)
})

test('homepage presents Services as live and Events and Community as coming soon', async () => {
  const source = await readFile(homeUrl, 'utf8')

  assert.match(source, /\{ key: 'services', icon: 'briefcase', state: 'available', to: '\/services' \}/)
  assert.match(source, /\{ key: 'events', icon: 'calendar', state: 'upcoming', to: '\/events' \}/)
  assert.match(source, /\{ key: 'community', icon: 'people', state: 'upcoming', to: '\/community' \}/)
})

test('homepage hero renders one accessible two-part translated heading', async () => {
  const [source, styles] = await Promise.all([
    readFile(homeUrl, 'utf8'),
    readFile(stylesUrl, 'utf8'),
  ])
  const heroStart = source.indexOf('<section className="marketing-hero">')
  const heroEnd = source.indexOf('</section>', heroStart)
  const hero = source.slice(heroStart, heroEnd)
  const headingStart = hero.indexOf('<h1')
  const headingEnd = hero.indexOf('</h1>', headingStart) + 5
  const heading = hero.slice(headingStart, headingEnd)
  const lineRule = styles.match(/\.marketing-hero__title-line \{[^}]*\}/)?.[0] ?? ''

  assert.equal(hero.match(/<h1/g)?.length, 1)
  assert.equal(hero.match(/className="marketing-hero__title-line"/g)?.length, 2)
  assert.match(hero, /<h1 className="marketing-hero__title">[\s\S]*?titleFirstLine[\s\S]*?\{' '\}[\s\S]*?titleSecondLine[\s\S]*?<\/h1>/)
  assert.doesNotMatch(hero, /marketing\.homepage\.hero\.title['"]|<br\s*\/?\s*>/)
  assert.doesNotMatch(heading, /aria-label=/)
  assert.match(lineRule, /display: block;/)
  assert.doesNotMatch(lineRule, /width:|height:|white-space:\s*nowrap|overflow:/)
  assert.equal(styles.match(/\.marketing-hero__title-line \{/g)?.length, 1)
})

test('homepage journey cards preserve honest role-aware destinations and accessible structure', async () => {
  const [source, styles] = await Promise.all([
    readFile(homeUrl, 'utf8'),
    readFile(stylesUrl, 'utf8'),
  ])
  const data = source.match(/const journeyCards = Object\.freeze\(\[[\s\S]*?\n\]\)/)?.[0] ?? ''
  const helper = source.match(/function getHomepageJourneyHref[\s\S]*?\n\}/)?.[0] ?? ''
  const start = source.indexOf('<section className="marketing-section journey-section"')
  const end = source.indexOf('</section>', start)
  const markup = source.slice(start, end)
  const cssStart = styles.indexOf('.journey-grid {')
  const cssEnd = styles.indexOf('.language-section,', cssStart)
  const journeyStyles = styles.slice(cssStart, cssEnd)
  const cardStyles = journeyStyles.match(/\.journey-card \{[^}]*\}/)?.[0] ?? ''

  assert.equal((data.match(/\{ key:/g) ?? []).length, 2)
  assert.ok(data.indexOf("key: 'customers'") < data.indexOf("key: 'businesses'"))
  assert.match(data, /key: 'customers', audience: 'customer'/)
  assert.match(data, /key: 'businesses', audience: 'business'/)
  assert.match(helper, /audience === 'customer'\) return '\/services'/)
  assert.match(helper, /if \(!user\) return '\/register\?intent=business'/)
  assert.match(helper, /userProfile\?\.roles\?\.includes\('business'\)\) return '\/business\/dashboard'/)
  assert.match(helper, /return '\/profile\?intent=business#business-upgrade-title'/)
  assert.doesNotMatch(helper, /accountType|enableBusiness|updateAccountRole/)

  assert.equal(markup.match(/<article/g)?.length, 1, 'one mapped article implementation')
  assert.match(markup, /<section className="marketing-section journey-section" id="for-businesses">/)
  assert.match(markup, /journeyCards\.map\(\(\{ audience, key \}\) => \(/)
  assert.match(markup, /<article[\s\S]*?className="journey-card"[\s\S]*?data-audience=\{audience\}/)
  assert.match(markup, /className="journey-card__content"/)
  assert.doesNotMatch(markup, /JourneyIllustration|journey-card__(?:icon|visual)|<svg/)
  assert.doesNotMatch(source, /function JourneyIllustration|journey-illustration__/)
  assert.match(markup, /<h3>\{t\(`marketing\.journeys\.\$\{key\}\.title`\)\}<\/h3>/)
  assert.match(markup, /className="journey-card__action"/)
  assert.match(markup, /getHomepageJourneyHref\(audience, \{ user, userProfile \}\)/)
  assert.match(markup, /aria-hidden="true" className="journey-card__arrow"/)
  assert.doesNotMatch(markup, /<Link[^>]*className="journey-card"|<button/)

  assert.match(journeyStyles, /--journey-accent: var\(--brand-blue\)/)
  assert.match(journeyStyles, /\[data-audience='business'\][\s\S]*?var\(--product-services\)/)
  assert.match(journeyStyles, /\.journey-grid \{[\s\S]*?border: 1px solid[\s\S]*?border-radius: 1\.5rem;[\s\S]*?box-shadow:/)
  assert.match(cardStyles, /background-color: color-mix\(in srgb, var\(--journey-accent\) 5%, var\(--surface\)\)/)
  assert.match(cardStyles, /background-image: radial-gradient\(circle at 0 100%/)
  assert.match(journeyStyles, /\.journey-card__content \{[\s\S]*?grid-template-rows: auto minmax\(0, 1fr\) auto;/)
  assert.doesNotMatch(journeyStyles, /journey-card__(?:icon|visual)|journey-illustration__/)
  assert.doesNotMatch(styles, /@media \(min-width: 72rem\) \{[\s\S]*?\.journey-card/)
  assert.doesNotMatch(`${source}\n${journeyStyles}`, /(?:business|customer)Panel(?:375|768|1440)|panel-(?:375|768|1440)px|JourneyArtwork|journey-card__artwork|--journey-artwork/)
  assert.match(journeyStyles, /\.journey-card__action \{[\s\S]*?min-height: 2\.75rem;[\s\S]*?color: var\(--brand-navy\)/)
  assert.match(styles, /@media \(min-width: 48rem\) \{[\s\S]*?\.journey-grid \{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/)
  assert.doesNotMatch(cardStyles, /(?:^|[;{]\s*)height:|min-height:|overflow:\s*(?:hidden|clip)|cursor:\s*pointer/)
  assert.doesNotMatch(journeyStyles, /\.journey-card:hover|translate|transform|transition|animation|white-space:\s*nowrap|!important/)
})

test('final business CTA reuses role-aware routing and has one motion-free closing-band implementation', async () => {
  const [source, styles] = await Promise.all([
    readFile(homeUrl, 'utf8'),
    readFile(stylesUrl, 'utf8'),
  ])
  const helper = source.match(/function getHomepageJourneyHref[\s\S]*?\n\}/)?.[0] ?? ''
  const start = source.indexOf('<section className="marketing-cta">')
  const end = source.indexOf('</section>', start)
  const markup = source.slice(start, end)
  const styleStart = styles.lastIndexOf('.marketing-cta {', styles.indexOf('.site-footer {'))
  const styleEnd = styles.indexOf('.site-footer {', styleStart)
  const ctaStyles = styles.slice(styleStart, styleEnd)
  const ctaBlock = ctaStyles.match(/\.marketing-cta \{[^}]*\}/)?.[0] ?? ''
  const desktopCtaStart = styles.indexOf('  .marketing-cta {', styleEnd)
  const desktopCtaBlock = styles.slice(desktopCtaStart, styles.indexOf('  }', desktopCtaStart) + 3)

  assert.equal(source.match(/function getHomepageJourneyHref/g)?.length, 1)
  assert.match(helper, /if \(!user\) return '\/register\?intent=business'/)
  assert.match(helper, /roles\?\.includes\('business'\)\) return '\/business\/dashboard'/)
  assert.match(helper, /return '\/profile\?intent=business#business-upgrade-title'/)
  assert.equal(source.match(/<section className="marketing-cta">/g)?.length, 1)
  assert.equal(markup.match(/<h2>/g)?.length, 1)
  assert.equal(markup.match(/<Link/g)?.length, 1)
  assert.match(markup, /className="marketing-cta__content"/)
  assert.match(markup, /className="marketing-cta__description"/)
  assert.match(markup, /className="marketing-cta__action"/)
  assert.match(markup, /to=\{getHomepageJourneyHref\('business', \{ user, userProfile \}\)\}/)
  assert.match(markup, /<span aria-hidden="true">→<\/span>/)
  assert.doesNotMatch(markup, /to="\/register\?intent=business"|<button|tabIndex|tabindex/)
  assert.ok(markup.indexOf('marketing-cta__description') < markup.indexOf('<Link'))

  assert.match(ctaBlock, /gap: 1\.25rem;/)
  assert.match(ctaBlock, /padding: 1\.25rem;/)
  assert.match(ctaBlock, /box-shadow: 0 0\.75rem 2rem rgb\(7 29 53 \/ 12%\);/)
  assert.match(ctaBlock, /radial-gradient\(circle at 92% 8%, rgb\(107 56 232 \/ 16%\), transparent 34%\)/)
  assert.match(ctaBlock, /radial-gradient\(circle at 8% 100%, rgb\(255 122 26 \/ 15%\), transparent 32%\)/)
  assert.match(ctaBlock, /linear-gradient\(135deg, var\(--brand-navy\), #0a2b50 58%, #111f45\)/)
  assert.match(ctaBlock, /border: 1px solid color-mix\(in srgb, var\(--brand-blue\) 25%, #ffffff 10%\);/)
  assert.match(ctaStyles, /var\(--brand-orange\)/)
  assert.match(ctaBlock, /border-radius: 1\.5rem/)
  assert.match(ctaBlock, /margin-bottom: clamp\(3rem, 6vw, 5rem\)/)
  assert.doesNotMatch(ctaBlock, /(?:^|[;{]\s*)(?:min-)?height:/)
  assert.match(ctaStyles, /\.marketing-cta__action \{[\s\S]*?width: 100%;[\s\S]*?min-height: 2\.75rem;[\s\S]*?color: var\(--brand-navy\);[\s\S]*?background: #fffaf4;/)
  assert.match(ctaStyles, /\.marketing-cta__action:focus-visible \{[\s\S]*?outline: 3px solid/)
  assert.match(desktopCtaBlock, /grid-template-columns: minmax\(0, 1fr\) auto;/)
  assert.match(desktopCtaBlock, /padding: clamp\(2rem, 3vw, 2\.5rem\);/)
  assert.doesNotMatch(ctaStyles, /var\(--cta-gradient\)|var\(--cta-shadow\)|transform|transition|animation|white-space:\s*nowrap|margin-bottom:\s*-|!important/)
  assert.doesNotMatch(styles, /\.button--light/)
  assert.match(styles, /@media \(min-width: 48rem\) \{[\s\S]*?\.marketing-cta \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto;[\s\S]*?\.marketing-cta__action \{[\s\S]*?width: fit-content;/)
})

test('homepage Why section is one open, static and responsive feature list', async () => {
  const [source, styles] = await Promise.all([
    readFile(homeUrl, 'utf8'),
    readFile(stylesUrl, 'utf8'),
  ])
  const data = source.match(/const whyCards = Object\.freeze\(\[[\s\S]*?\n\]\)/)?.[0] ?? ''
  const start = source.indexOf('<section className="marketing-section homepage-why">')
  const end = source.indexOf('</section>', start)
  const markup = source.slice(start, end)
  const listStyles = styles.match(/\.homepage-why__list \{[^}]*\}/)?.[0] ?? ''
  const itemStyles = styles.match(/\.homepage-why__item \{[^}]*\}/)?.[0] ?? ''
  const desktopStyles = styles.match(/@media \(min-width: 64rem\) \{[\s\S]*?\.messages-layout/)?.[0] ?? ''

  assert.equal((data.match(/\{ key:/g) ?? []).length, 3)
  assert.ok(data.indexOf("key: 'local'") < data.indexOf("key: 'multilingual'"))
  assert.ok(data.indexOf("key: 'multilingual'") < data.indexOf("key: 'real'"))
  assert.match(data, /key: 'local', icon: 'identity', accent: 'blue'/)
  assert.match(data, /key: 'multilingual', icon: 'language', accent: 'purple'/)
  assert.match(data, /key: 'real', icon: 'briefcase', accent: 'green'/)

  assert.match(markup, /<h2>\{t\('marketing\.homepage\.why\.title'\)\}<\/h2>/)
  assert.equal(markup.match(/<ul className="homepage-why__list">/g)?.length, 1)
  assert.equal(markup.match(/<li className="homepage-why__item"/g)?.length, 1, 'one mapped list-item implementation')
  assert.match(markup, /whyCards\.map\(\(\{ accent, icon, key \}\) => \(/)
  assert.match(markup, /data-accent=\{accent\}/)
  assert.match(markup, /<span className="homepage-why__icon"><MarketingIcon name=\{icon\} \/><\/span>/)
  assert.match(source, /<svg viewBox="0 0 24 24" aria-hidden="true"[\s\S]*?focusable="false"/)
  assert.match(markup, /<h3>\{t\(`marketing\.homepage\.why\.\$\{key\}\.title`\)\}<\/h3>/)
  assert.match(markup, /<p>\{t\(`marketing\.homepage\.why\.\$\{key\}\.description`\)\}<\/p>/)
  assert.doesNotMatch(markup, /<a\b|<Link\b|<button\b|tabindex|tabIndex|onClick|cursor/)

  assert.match(listStyles, /grid-template-columns: minmax\(0, 1fr\)/)
  assert.match(listStyles, /gap: clamp\(1\.5rem, 3vw, 2\.25rem\)/)
  assert.doesNotMatch(listStyles, /border(?:-radius)?:|background:|box-shadow:/)
  assert.match(itemStyles, /min-width: 0/)
  assert.match(itemStyles, /padding: 0\.25rem/)
  assert.doesNotMatch(itemStyles, /border:|background:|box-shadow:/)
  assert.doesNotMatch(styles, /\.homepage-why__item \+ \.homepage-why__item/)
  assert.match(styles, /\.homepage-why__icon \{[\s\S]*?color: var\(--why-accent\)/)
  assert.match(desktopStyles, /\.homepage-why__list \{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/)
  assert.doesNotMatch(styles, /homepage-why__grid|homepage-why__card/)
  assert.doesNotMatch(`${listStyles}\n${itemStyles}`, /(?:^|[;{]\s*)height:|min-height:\s*100%|white-space:\s*nowrap|overflow:\s*(?:hidden|clip)|:hover|transition:|transform:|animation:|cursor:\s*pointer|!important/)
})

test('homepage How section is one truthful semantic process rail', async () => {
  const [source, styles] = await Promise.all([
    readFile(homeUrl, 'utf8'),
    readFile(stylesUrl, 'utf8'),
  ])
  const data = source.match(/const howItWorksCards = Object\.freeze\(\[[\s\S]*?\n\]\)/)?.[0] ?? ''
  const start = source.indexOf('<section className="marketing-section homepage-how">')
  const end = source.indexOf('</section>', start)
  const markup = source.slice(start, end)
  const stylesStart = styles.indexOf('.homepage-how__list {')
  const stylesEnd = styles.indexOf('.journey-grid {', stylesStart)
  const howStyles = styles.slice(stylesStart, stylesEnd)
  const listStyles = howStyles.match(/\.homepage-how__list \{[^}]*\}/)?.[0] ?? ''
  const itemStyles = howStyles.match(/\.homepage-how__item \{[^}]*\}/)?.[0] ?? ''
  const iconStyles = howStyles.match(/\.homepage-how__icon \{[^}]*\}/)?.[0] ?? ''
  const numberStyles = howStyles.match(/\.homepage-how__number \{[^}]*\}/)?.[0] ?? ''
  const desktopStyles = styles.match(/@media \(min-width: 64rem\) \{[\s\S]*?\.messages-layout/)?.[0] ?? ''

  assert.equal((data.match(/\{ key:/g) ?? []).length, 3)
  assert.ok(data.indexOf("key: 'browse'") < data.indexOf("key: 'review'"))
  assert.ok(data.indexOf("key: 'review'") < data.indexOf("key: 'connect'"))
  assert.match(data, /key: 'browse', icon: 'search', accent: 'blue'/)
  assert.match(data, /key: 'review', icon: 'identity', accent: 'purple'/)
  assert.match(data, /key: 'connect', icon: 'message', accent: 'orange'/)
  assert.doesNotMatch(data, /choose|icon: 'check'/)

  assert.match(markup, /<h2>\{t\('marketing\.how\.title'\)\}<\/h2>/)
  assert.match(markup, /<p>\{t\('marketing\.how\.description'\)\}<\/p>/)
  assert.equal(markup.match(/<ol className="homepage-how__list">/g)?.length, 1)
  assert.equal(markup.match(/<li className="homepage-how__item"/g)?.length, 1, 'one mapped list-item implementation')
  assert.match(markup, /howItWorksCards\.map\(\(\{ accent, icon, key \}, index\) => \(/)
  assert.match(markup, /data-accent=\{accent\}/)
  assert.match(markup, /aria-hidden="true" className="homepage-how__number">0\{index \+ 1\}<\/span>/)
  assert.match(markup, /<span className="homepage-how__icon"><MarketingIcon name=\{icon\} \/><\/span>/)
  assert.match(source, /<svg viewBox="0 0 24 24" aria-hidden="true"[\s\S]*?focusable="false"/)
  assert.match(markup, /<h3>\{t\(`marketing\.how\.\$\{key\}\.title`\)\}<\/h3>/)
  assert.match(markup, /<p>\{t\(`marketing\.how\.\$\{key\}\.description`\)\}<\/p>/)
  assert.doesNotMatch(markup, /<a\b|<Link\b|<button\b|tabindex|tabIndex|onClick|cursor/)

  assert.match(listStyles, /grid-template-columns: minmax\(0, 1fr\)/)
  assert.match(listStyles, /gap: 1\.75rem/)
  assert.match(itemStyles, /grid-template-columns: 5\.25rem minmax\(0, 1fr\)/)
  assert.match(itemStyles, /min-width: 0/)
  assert.match(itemStyles, /padding: 0;/)
  assert.doesNotMatch(itemStyles, /border:|background:|box-shadow:/)
  assert.doesNotMatch(howStyles, /bottom:\s*-|width:\s*1px/)
  assert.match(iconStyles, /width: 5\.25rem;[\s\S]*?height: 5\.25rem;/)
  assert.match(iconStyles, /border: 1px solid[\s\S]*?border-radius: 50%/)
  assert.match(iconStyles, /background: color-mix\(in srgb, var\(--how-accent\) 8%, var\(--surface\)\)/)
  assert.match(desktopStyles, /\.homepage-how__list \{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(desktopStyles, /\.homepage-how__item:not\(:last-child\)::after \{[\s\S]*?height: 1px;[\s\S]*?pointer-events: none;/)
  assert.doesNotMatch(desktopStyles.match(/\.homepage-how__list \{[^}]*\}/)?.[0] ?? '', /repeat\(2/)
  assert.doesNotMatch(numberStyles, /position:\s*absolute/)
  assert.doesNotMatch(`${listStyles}\n${itemStyles}`, /(?:^|[;{]\s*)height:\s*\d|min-height:\s*100%/)
  assert.doesNotMatch(howStyles, /white-space:\s*nowrap|overflow:\s*(?:hidden|clip)|:hover|transition:|transform:|animation:|cursor:\s*pointer|!important/)
  assert.doesNotMatch(styles, /\.marketing-card(?:-grid|__|\s|:|\{)/)
})

test('homepage platform uses one honest accessible product-card implementation', async () => {
  const [source, styles] = await Promise.all([
    readFile(homeUrl, 'utf8'),
    readFile(stylesUrl, 'utf8'),
  ])
  const data = source.match(/const platformPillars = Object\.freeze\(\[[\s\S]*?\n\]\)/)?.[0] ?? ''
  const platformStart = source.indexOf('<section className="marketing-section homepage-platform">')
  const platformEnd = source.indexOf('</section>', platformStart)
  const platformSource = source.slice(platformStart, platformEnd)
  const stylesStart = styles.indexOf('.homepage-platform__grid {')
  const stylesEnd = styles.indexOf(
    '.homepage-business-preview__grid {',
    styles.indexOf('.homepage-platform__action > span', stylesStart),
  )
  const platformStyles = styles.slice(stylesStart, stylesEnd)
  const cardStyles = platformStyles.match(/\.homepage-platform__card \{[^}]*\}/)?.[0] ?? ''
  const descriptionStyles = platformStyles.match(/\.homepage-platform__card p \{[^}]*\}/)?.[0] ?? ''
  const badgeStyles = platformStyles.match(/\.homepage-platform__badge \{[^}]*\}/)?.[0] ?? ''
  const actionStyles = platformStyles.match(/\.homepage-platform__action \{[^}]*\}/)?.[0] ?? ''

  assert.equal((data.match(/\{ key:/g) ?? []).length, 3)
  assert.ok(data.indexOf("key: 'services'") < data.indexOf("key: 'events'"))
  assert.ok(data.indexOf("key: 'events'") < data.indexOf("key: 'community'"))
  assert.match(data, /\{ key: 'services', icon: 'briefcase', state: 'available', to: '\/services' \}/)
  assert.match(data, /\{ key: 'events', icon: 'calendar', state: 'upcoming', to: '\/events' \}/)
  assert.match(data, /\{ key: 'community', icon: 'people', state: 'upcoming', to: '\/community' \}/)
  assert.match(source, /calendar: <><rect[\s\S]*?<\/>,/)
  assert.equal(source.match(/calendar: /g)?.length, 1)
  assert.match(source, /if \(!icon\) throw new Error\(`Missing marketing icon for \$\{name\}`\)/)
  assert.match(source, /<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" focusable="false" stroke="currentColor" strokeWidth="1\.8" strokeLinecap="round" strokeLinejoin="round">/)
  assert.match(platformSource, /<article className="homepage-platform__card" data-product=\{key\} data-state=\{state\} key=\{key\}>/)
  assert.equal(platformSource.match(/<article/g)?.length, 1)
  assert.match(platformSource, /className="homepage-platform__meta"/)
  assert.match(platformSource, /className="homepage-platform__icon"><MarketingIcon name=\{icon\} \/><\/span>/)
  assert.match(platformSource, /className="homepage-platform__badge"[\s\S]*?state === 'available' \? 'availableNow' : 'comingSoon'/)
  assert.match(platformSource, /<Link className="homepage-platform__action" to=\{to\}>[\s\S]*?platform\.\$\{key\}\.action/)
  assert.equal(platformSource.match(/<Link/g)?.length, 1)
  assert.doesNotMatch(platformSource, /aria-disabled|disabled=|role="(?:button|status)"|<article[^>]*onClick=|<Link[^>]*homepage-platform__card/)
  assert.doesNotMatch(platformSource, /spacer|style=\{\{[^}]*height|offsetHeight|clientHeight|getBoundingClientRect/)
  assert.match(platformStyles, /\[data-product='events'\][\s\S]*?var\(--product-events\)/)
  assert.match(platformStyles, /\[data-product='community'\][\s\S]*?var\(--product-community\)/)
  assert.match(platformStyles, /--platform-accent: var\(--product-services\)/)
  assert.doesNotMatch(platformStyles, /\.is-live|:not\(\.is-live\)|#f5faff|#f8fafc/)
  assert.doesNotMatch(badgeStyles, /position:\s*absolute|white-space:\s*nowrap/)
  assert.match(actionStyles, /min-height: 2\.75rem/)
  assert.match(actionStyles, /color: var\(--brand-navy\)/)
  assert.match(actionStyles, /var\(--platform-accent\)/)
  assert.doesNotMatch(actionStyles, /position:\s*absolute/)
  assert.match(cardStyles, /display: grid/)
  assert.match(cardStyles, /grid-template-rows: auto auto 1fr auto/)
  assert.doesNotMatch(cardStyles, /(?:^|[;{]\s*)height:\s*\d/)
  assert.doesNotMatch(descriptionStyles, /(?:^|[;{]\s*)(?:min-)?height:/)
  assert.doesNotMatch(platformStyles, /animation:|transition:|transform:|translate:|cursor:\s*pointer|!important/)
  assert.match(styles, /@media \(min-width: 48rem\) \{[\s\S]*?\.homepage-platform__grid \{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(styles, /@media \(min-width: 64rem\) \{[\s\S]*?\.homepage-platform__grid \{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/)
  assert.doesNotMatch(source, /from ['"](?:lucide|@heroicons|react-icons|@fortawesome)/)
})

test('homepage proposition contains no Places pillar or unsupported social proof', async () => {
  const [source, translations] = await Promise.all([
    readFile(homeUrl, 'utf8'),
    readFile(translationsUrl, 'utf8'),
  ])

  assert.doesNotMatch(`${source}\n${translations}`, /\bPlaces\b|\bplaces\b/)
  assert.doesNotMatch(`${source}\n${translations}`, /testimonial|thousands of|\d+\+ businesses|verified businesses/i)
})

test('homepage hero uses one inert responsive coastal and community WebP scene', async () => {
  const [source, styles, scenes, illustrationFiles] = await Promise.all([
    readFile(homeUrl, 'utf8'),
    readFile(stylesUrl, 'utf8'),
    Promise.all(heroSceneUrls.map((sceneUrl) => readFile(sceneUrl))),
    readdir(illustrationsUrl),
  ])
  const heroStart = styles.indexOf('.marketing-hero {')
  const heroEnd = styles.indexOf('.marketing-hero__content {', heroStart)
  const heroStyles = styles.slice(heroStart, heroEnd)

  const heroStartInSource = source.indexOf('<section className="marketing-hero">')
  const heroEndInSource = source.indexOf('</section>', heroStartInSource)
  const heroSource = source.slice(heroStartInSource, heroEndInSource)
  const sceneStart = styles.indexOf('.marketing-hero__scene {', heroStart)
  const sceneEnd = styles.indexOf('.marketing-hero__inner {', sceneStart)
  const sceneStyles = styles.slice(sceneStart, sceneEnd)

  assert.deepEqual(illustrationFiles.sort(), [
    'homepage-coastal-community-mobile.webp',
    'homepage-coastal-community-tablet.webp',
    'homepage-coastal-community.webp',
  ])
  assert.match(source, /import homepageCoastalCommunity from '\.\.\/assets\/illustrations\/homepage-coastal-community\.webp'/)
  assert.match(source, /import homepageCoastalCommunityMobile from '\.\.\/assets\/illustrations\/homepage-coastal-community-mobile\.webp'/)
  assert.match(source, /import homepageCoastalCommunityTablet from '\.\.\/assets\/illustrations\/homepage-coastal-community-tablet\.webp'/)
  assert.match(heroSource, /<picture>[\s\S]*?media="\(max-width: 47\.999rem\)"[\s\S]*?srcSet=\{homepageCoastalCommunityMobile\}[\s\S]*?media="\(max-width: 71\.999rem\)"[\s\S]*?srcSet=\{homepageCoastalCommunityTablet\}[\s\S]*?<img[\s\S]*?alt=""[\s\S]*?aria-hidden="true"[\s\S]*?fetchPriority="high"[\s\S]*?height="864"[\s\S]*?src=\{homepageCoastalCommunity\}[\s\S]*?width="1821"[\s\S]*?<\/picture>/)
  assert.equal(source.match(/className="marketing-hero__scene"/g)?.length, 1)
  assert.equal(heroSource.match(/<picture>/g)?.length, 1)
  assert.equal(heroSource.match(/<source/g)?.length, 2)
  assert.equal(heroSource.match(/<img/g)?.length, 1)
  assert.ok(heroSource.indexOf('47.999rem') < heroSource.indexOf('71.999rem'))
  assert.doesNotMatch(heroStyles, /url\(|https?:\/\//)
  assert.match(heroStyles, /radial-gradient\([\s\S]*?var\(--product-services\)/)
  assert.match(heroStyles, /radial-gradient\([\s\S]*?var\(--brand-blue\)/)
  assert.match(heroStyles, /radial-gradient\([\s\S]*?var\(--product-events\)/)
  assert.match(heroStyles, /radial-gradient\([\s\S]*?var\(--product-community\)/)
  assert.match(heroStyles, /#fffbf6;/)
  assert.match(sceneStyles, /position: absolute;/)
  assert.match(sceneStyles, /top: 0;/)
  assert.match(sceneStyles, /bottom: 0;/)
  assert.match(sceneStyles, /inset-inline: 0;/)
  assert.match(sceneStyles, /pointer-events: none;/)
  assert.match(sceneStyles, /user-select: none;/)
  assert.match(sceneStyles, /\.marketing-hero__scene picture \{[\s\S]*?display: block;[\s\S]*?width: 100%;[\s\S]*?height: 100%;/)
  assert.match(sceneStyles, /\.marketing-hero__scene img \{[\s\S]*?display: block;[\s\S]*?width: 100%;[\s\S]*?height: 100%;/)
  assert.match(sceneStyles, /object-fit: cover;/)
  assert.match(sceneStyles, /object-position: center bottom;/)
  assert.doesNotMatch(sceneStyles, /max-width:|margin:/)
  assert.match(styles, /\.marketing-hero__inner \{[\s\S]*?position: relative;[\s\S]*?z-index: 1;/)
  assert.doesNotMatch(styles, /\.marketing-hero::(?:before|after)/)
  assert.doesNotMatch(`${heroStyles}\n${sceneStyles}`, /animation:|transition:|!important/)
  for (const scene of scenes) {
    assert.equal(scene.subarray(0, 4).toString('ascii'), 'RIFF')
    assert.equal(scene.subarray(8, 12).toString('ascii'), 'WEBP')
  }
  assert.doesNotMatch(source, /homepage-coastal-community\.(?:svg|png)|data:image|https?:\/\//)
  assert.doesNotMatch(source, /matchMedia|innerWidth|resize|useMediaQuery/)
  assert.doesNotMatch(`${source}\n${heroStyles}`, /fake-app|fake-screen|mockup|statistic|testimonial|verified businesses/i)
})

test('homepage hero is full width beneath the header with constrained content-driven inner layout', async () => {
  const [source, styles] = await Promise.all([
    readFile(homeUrl, 'utf8'),
    readFile(stylesUrl, 'utf8'),
  ])
  const heroStart = styles.indexOf('.marketing-hero {')
  const heroEnd = styles.indexOf('.marketing-hero__content {', heroStart)
  const heroStyles = styles.slice(heroStart, heroEnd)
  const outerHeroEnd = styles.indexOf('.marketing-hero__scene {', heroStart)
  const outerHeroStyles = styles.slice(heroStart, outerHeroEnd)

  assert.match(outerHeroStyles, /width: 100%;/)
  assert.match(outerHeroStyles, /margin: 0;/)
  for (const viewportUnit of ['vh', 'svh', 'dvh']) {
    assert.match(
      outerHeroStyles,
      new RegExp(`min-height: calc\\(100${viewportUnit} - var\\(--site-header-height\\)\\);`),
    )
  }
  assert.doesNotMatch(outerHeroStyles, /--homepage-header-height/)
  assert.doesNotMatch(outerHeroStyles, /(?:^|\n)\s*height:/)
  assert.doesNotMatch(outerHeroStyles, /border(?:-radius)?:|box-shadow:/)
  assert.match(styles, /\.marketing-hero__inner \{[\s\S]*?width: min\(calc\(100% - 2rem\), 80rem\);[\s\S]*?min-height: inherit;[\s\S]*?box-sizing: border-box;[\s\S]*?margin: 0 auto;[\s\S]*?padding-block: clamp\(2\.75rem, 8vw, 5rem\);/)
  assert.match(
    source,
    /<section className="marketing-hero">\s*<div className="marketing-hero__scene"[\s\S]*?<\/div>\s*<div className="marketing-hero__inner">/,
  )
})

test('homepage hero provides a semantic translated search handoff without loading directory data', async () => {
  const source = await readFile(homeUrl, 'utf8')
  const submitStart = source.indexOf('function submitHeroSearch')
  const submitEnd = source.indexOf('\n  }', submitStart) + 4
  const submitHandler = source.slice(submitStart, submitEnd)

  assert.match(source, /useNavigate\(\)/)
  assert.match(source, /<form[\s\S]*?role="search"[\s\S]*?<\/form>/)
  assert.match(source, /aria-label=\{t\('marketing\.homepage\.hero\.searchFormLabel'\)\}/)
  assert.match(source, /<label htmlFor="homepage-service-search">\{t\('services\.searchLabel'\)\}<\/label>/)
  assert.match(source, /<label htmlFor="homepage-area-search">\{t\('services\.locationLabel'\)\}<\/label>/)
  assert.match(source, /name="q"[\s\S]*?type="search"/)
  assert.match(source, /name="area"[\s\S]*?type="text"/)
  assert.match(source, /<button className="button button--primary" type="submit">/)
  assert.match(submitHandler, /event\.preventDefault\(\)/)
  assert.match(submitHandler, /navigate\(buildHomepageSearchHref\(\{ searchTerm, area: searchArea \}\)\)/)
  assert.doesNotMatch(submitHandler, /getFeaturedActiveBusinesses|Firebase|service=/)
  assert.doesNotMatch(source, /geolocation|navigator\.geolocation|autocomplete=/i)
})

test('homepage hero search stacks narrowly and uses normal two-region flow on wide screens', async () => {
  const source = await readFile(homeUrl, 'utf8')
  const styles = await readFile(stylesUrl, 'utf8')
  const formStart = styles.indexOf('.marketing-hero__search {')
  const formEnd = styles.indexOf('.marketing-actions {', formStart)
  const formStyles = styles.slice(formStart, formEnd)
  const wideStart = styles.indexOf('@media (min-width: 72rem)')
  const wideEnd = styles.indexOf('@media (max-width: 63.999rem)', wideStart)
  const wideStyles = styles.slice(wideStart, wideEnd)

  assert.match(formStyles, /display: grid;/)
  assert.match(formStyles, /width: min\(100%, 32rem\);/)
  assert.doesNotMatch(formStyles, /position: absolute|transform:|animation:/)
  assert.doesNotMatch(styles, /\.marketing-hero__(?:content|search)\s*\{[^}]*position:\s*absolute/)
  assert.doesNotMatch(styles, /\.marketing-hero__inner\s*>\s*\.marketing-actions\s*\{[^}]*position:\s*absolute/)
  assert.match(wideStyles, /\.marketing-hero__inner \{[\s\S]*?grid-template-columns: minmax\(0, 1\.6fr\) minmax\(23rem, 0\.7fr\);/)
  assert.match(wideStyles, /column-gap: clamp\(2rem, 3vw, 3rem\);/)
  assert.match(wideStyles, /\.marketing-hero h1 \{[\s\S]*?font-size: clamp\(5\.25rem, 6vw, 6rem\);/)
  assert.doesNotMatch(styles, /\.marketing-hero h1 \{[^}]*max-width:/)
  assert.match(wideStyles, /\.marketing-hero__search \{[\s\S]*?grid-column: 2;[\s\S]*?grid-row: 1 \/ span 2;/)
  assert.match(wideStyles, /\.marketing-hero__inner > \.marketing-actions \{[\s\S]*?grid-column: 1;[\s\S]*?grid-row: 2;/)
  assert.doesNotMatch(wideStyles, /position: absolute|transform:|animation:|white-space: nowrap/)
  assert.doesNotMatch(source, /<br\s*\/?\s*>|\.split\(/)

  const contentPosition = source.indexOf('<div className="marketing-hero__content">')
  const formPosition = source.indexOf('<form', contentPosition)
  const actionsPosition = source.indexOf('<div className="marketing-actions">', formPosition)
  assert.ok(contentPosition < formPosition && formPosition < actionsPosition)
})

test('homepage hero keeps its responsive picture scene visible at tablet and mobile widths', async () => {
  const styles = await readFile(stylesUrl, 'utf8')
  const tabletStart = styles.indexOf('@media (max-width: 71.999rem)')
  const mobileStart = styles.indexOf('@media (max-width: 47.999rem)', tabletStart)
  const tabletStyles = styles.slice(tabletStart, mobileStart)
  const mobileStyles = styles.slice(mobileStart)

  assert.doesNotMatch(tabletStyles, /\.marketing-hero__scene|height: min\(|top: auto|opacity:/)
  assert.doesNotMatch(mobileStyles, /\.marketing-hero__scene\s*\{[\s\S]*?display: none;/)
  assert.doesNotMatch(mobileStyles, /\.marketing-hero__(?:content|lead)|\.marketing-hero h1|\.marketing-actions/)
})

test('homepage hero search replaces the customer CTA while preserving business access', async () => {
  const source = await readFile(homeUrl, 'utf8')
  const translations = await readFile(translationsUrl, 'utf8')
  const heroStart = source.indexOf('<section className="marketing-hero">')
  const heroEnd = source.indexOf('</section>', heroStart)
  const hero = source.slice(heroStart, heroEnd)

  assert.doesNotMatch(hero, /marketing\.homepage\.hero\.customerAction|to="\/services"/)
  assert.match(hero, /type="submit"[\s\S]*?marketing\.homepage\.hero\.searchAction/)
  assert.match(hero, /to="\/register\?intent=business"[\s\S]*?marketing\.homepage\.hero\.businessAction/)
  assert.match(source, /navigate\(buildHomepageSearchHref\(\{ searchTerm, area: searchArea \}\)\)/)
  assert.match(translations, /customerAction:/)
  assert.match(source.slice(heroEnd), /to="\/services"/)
})

test('homepage uses tighter outer section rhythm without adding a gap around the full-width hero', async () => {
  const styles = await readFile(stylesUrl, 'utf8')
  const homeStart = styles.indexOf('.marketing-home {')
  const heroStart = styles.indexOf('.marketing-hero {', homeStart)
  const heroEnd = styles.indexOf('.marketing-hero__inner {', heroStart)
  const homeStyles = styles.slice(homeStart, heroStart)
  const heroStyles = styles.slice(heroStart, heroEnd)

  assert.match(homeStyles, /--homepage-section-spacing: clamp\(2\.75rem, 4\.75vw, 3\.25rem\);/)
  assert.match(styles, /\.marketing-home \.marketing-section \{\s*padding-block: var\(--homepage-section-spacing\);\s*\}/)
  assert.match(heroStyles, /width: 100%;/)
  assert.match(heroStyles, /margin: 0;/)
  assert.doesNotMatch(heroStyles, /--homepage-hero-gap|margin-block:/)
})

test('homepage Services discovery uses accessible icon-led category cards', async () => {
  const [source, styles] = await Promise.all([
    readFile(homeUrl, 'utf8'),
    readFile(stylesUrl, 'utf8'),
  ])
  const servicesStart = styles.indexOf('.homepage-services .marketing-eyebrow {')
  const servicesEnd = styles.indexOf('.homepage-platform__grid {', servicesStart)
  const servicesStyles = styles.slice(servicesStart, servicesEnd)
  const markupStart = source.indexOf('<section className="marketing-section homepage-services"')
  const markupEnd = source.indexOf('</section>', markupStart)
  const markup = source.slice(markupStart, markupEnd)
  const categoryNav = markup.slice(markup.indexOf('<nav'), markup.indexOf('</nav>') + 6)

  assert.match(servicesStyles, /\.homepage-services \.marketing-eyebrow \{\s*color: var\(--product-services\);/)
  assert.match(servicesStyles, /\.homepage-service-groups \{[\s\S]*?grid-auto-rows: 1fr;/)
  assert.match(servicesStyles, /\.homepage-services \.homepage-service-groups a \{[\s\S]*?min-height: 9rem;[\s\S]*?grid-template-rows: 3\.4rem minmax\(3\.1rem, auto\);[\s\S]*?cursor: pointer;[\s\S]*?overflow-wrap: anywhere;[\s\S]*?hyphens: auto;/)
  assert.match(servicesStyles, /\.homepage-service-group__icon \{[\s\S]*?width: 3\.4rem;[\s\S]*?height: 3\.4rem;[\s\S]*?grid-column: 1 \/ -1;/)
  assert.doesNotMatch(servicesStyles.match(/\.homepage-service-group__icon \{[^}]*\}/)?.[0] ?? '', /background:|border-radius:/)
  assert.match(servicesStyles, /\.homepage-service-group__icon svg \{[\s\S]*?width: 3\.15rem;[\s\S]*?height: 3\.15rem;[\s\S]*?vector-effect: non-scaling-stroke;/)
  assert.match(servicesStyles, /\.homepage-service-group__label \{[\s\S]*?color: var\(--brand-navy\);/)
  assert.match(servicesStyles, /\.homepage-services \.homepage-service-groups a:hover,[\s\S]*?color: var\(--brand-navy\);[\s\S]*?background: color-mix\(in srgb, var\(--service-category-accent\) 6%, var\(--surface\)\);/)
  assert.doesNotMatch(categoryNav, /homepage-service-group__arrow|→/)
  assert.match(markup, /homepage-section-link[\s\S]*?<span aria-hidden="true">→<\/span>/)
  assert.doesNotMatch(servicesStyles, /homepage-service-group__arrow/)
  assert.match(servicesStyles, /\.homepage-services \.homepage-featured-services a \{[\s\S]*?border: 1px solid color-mix\(in srgb, var\(--product-services\) 30%, var\(--line\)\);[\s\S]*?color: var\(--brand-navy\);/)
  assert.match(servicesStyles, /\.homepage-services \.homepage-featured-services a \{[\s\S]*?display: inline-flex;[\s\S]*?min-height: 2\.75rem;[\s\S]*?align-items: center;[\s\S]*?justify-content: center;/)
  assert.match(servicesStyles, /\.homepage-services \.homepage-section-link \{[\s\S]*?color: var\(--brand-navy\);/)
  assert.doesNotMatch(servicesStyles, /(?:^|[;{]\s*)height:\s*7\.25rem|white-space: nowrap|transform:|translate:|animation:|transition:/)
  assert.doesNotMatch(styles, /\.homepage-(?:platform|why|how|business-preview)[^\n{]*\.homepage-services/)
  assert.match(styles, /\.section-heading h2,[\s\S]*?color: var\(--brand-navy\);/)
})

test('homepage moves its single real-business preview directly after Services', async () => {
  const source = await readFile(homeUrl, 'utf8')
  const servicesPosition = source.indexOf('<section className="marketing-section homepage-services"')
  const previewPosition = source.indexOf('<section className="marketing-section homepage-business-preview"')
  const platformPosition = source.indexOf('<section className="marketing-section homepage-platform"')
  const journeyPosition = source.indexOf('<section className="marketing-section journey-section"')
  const whyPosition = source.indexOf('<section className="marketing-section homepage-why"')
  const howPosition = source.indexOf('<section className="marketing-section homepage-how"')
  const ctaPosition = source.indexOf('<section className="marketing-cta"')

  assert.ok(
    servicesPosition < previewPosition
      && previewPosition < platformPosition
      && platformPosition < journeyPosition
      && journeyPosition < whyPosition
      && whyPosition < howPosition
      && howPosition < ctaPosition,
  )
  assert.equal(source.match(/className="marketing-section homepage-business-preview"/g)?.length, 1)
  assert.equal(source.match(/getFeaturedActiveBusinesses\(60\)/g)?.length, 1)
  assert.match(source, /setFeaturedBusinesses\(businesses\.slice\(0, 3\)\)/)
  assert.match(source, /featuredBusinesses\.length > 0 \|\| directoryStatus === 'error'/)
  assert.match(source, /className="homepage-business-preview__error" role="alert"/)
  assert.match(source, /setDirectoryLoadAttempt\(\(attempt\) => attempt \+ 1\)/)
  assert.match(source, /return \(\) => \{\s*isCurrent = false\s*\}/)
  assert.match(source, /featuredBusinesses\.map\(\(business\) => \([\s\S]*?<PublicBusinessCard/)
  assert.doesNotMatch(source, /isDemo|exampleBusinesses|fallbackBusinesses|placeholderBusinesses/)
})
