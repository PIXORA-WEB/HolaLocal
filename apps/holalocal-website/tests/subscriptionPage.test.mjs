import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const pageUrl = new URL('../src/pages/business/SubscriptionPage.jsx', import.meta.url)
const stylesUrl = new URL('../src/styles/global.css', import.meta.url)

test('subscription page presents exactly two honest product statuses', async () => {
  const source = await readFile(pageUrl, 'utf8')
  const productCards = source.match(/<article className="subscription-product-card[^>]*>/g) ?? []

  assert.equal((source.match(/<h1[ >]/g) ?? []).length, 1)
  assert.equal((source.match(/<h2[ >]/g) ?? []).length, 2)
  assert.equal(productCards.length, 2)
  assert.match(source, /<h1 id="subscription-products-title">\{t\('subscriptionProducts\.title'\)\}<\/h1>/)
  assert.match(source, /<p>\{t\('subscriptionProducts\.description'\)\}<\/p>/)
  assert.match(source, /subscription-product-card--business/)
  assert.match(source, /<h2>\{t\('subscriptionProducts\.business\.title'\)\}<\/h2>/)
  assert.match(source, /subscriptionProducts\.business\.status/)
  assert.match(source, /subscriptionProducts\.business\.description/)
  assert.match(source, /subscription-product-card--events/)
  assert.match(source, /<h2>\{t\('subscriptionProducts\.events\.title'\)\}<\/h2>/)
  assert.match(source, /subscriptionProducts\.events\.status/)
  assert.match(source, /subscriptionProducts\.events\.description/)
  assert.equal((source.match(/subscription-product-card__status/g) ?? []).length, 2)
  assert.doesNotMatch(source, /<button|disabled|aria-current/)
  assert.doesNotMatch(source, /<Link|<NavLink|to=|href=/)
})

test('subscription page has no internal plan comparison or entitlement limits', async () => {
  const source = await readFile(pageUrl, 'utf8')

  assert.doesNotMatch(source, /PLAN_DEFINITIONS|PLAN_IDS|SUBSCRIPTION_LIMIT_UNLIMITED/)
  assert.doesNotMatch(source, /PLAN_ORDER|PLAN_LIMIT_KEYS|planCapabilityKeys|formatPlanLimit/)
  assert.doesNotMatch(source, /starter|growth|recommended|subscription\.plans|subscription\.limits?/i)
  assert.doesNotMatch(source, /galleryImages|categoryIds|serviceAreas|translatedMessagesPerMonth/)
  assert.doesNotMatch(source, /@holalocal\/firebase-contract/)
  assert.doesNotMatch(source, /stripe|checkout|price|payment|billing/i)
})

test('subscription page is independent of business and subscription projection loading', async () => {
  const source = await readFile(pageUrl, 'utf8')

  assert.doesNotMatch(source, /ensureBusinessProfile|getOwnerSubscriptionStatus/)
  assert.doesNotMatch(source, /loadOwnerSubscriptionProjection|safeSubscriptionPlanId|safeSubscriptionAccessStatus/)
  assert.doesNotMatch(source, /useAuthentication|userProfile|hasBusinessRole|businessProfile/)
  assert.doesNotMatch(source, /useEffect|useState|useRef|LoadingScreen|RecoveryMessage/)
})

test('subscription product statuses use a calm responsive product treatment', async () => {
  const styles = await readFile(stylesUrl, 'utf8')
  const start = styles.indexOf('.subscription-products-page {')
  const end = styles.indexOf('.marketing-home {', start)
  const subscriptionStyles = styles.slice(start, end)

  assert.notEqual(start, -1)
  assert.notEqual(end, -1)
  for (const selector of [
    '.subscription-products-page',
    '.subscription-products-page__header',
    '.subscription-products-grid',
    '.subscription-product-card',
    '.subscription-product-card__status',
    '.subscription-product-card__description',
  ]) {
    assert.match(subscriptionStyles, new RegExp(selector.replaceAll('.', '\\.')))
  }

  assert.match(subscriptionStyles, /\.subscription-products-page \{[\s\S]*?width: min\(calc\(100% - 2rem\), 64rem\);[\s\S]*?min-width: 0;/)
  assert.match(subscriptionStyles, /\.subscription-products-grid \{[\s\S]*?min-width: 0;[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/)
  assert.match(subscriptionStyles, /@media \(min-width: 48rem\) \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(subscriptionStyles, /\.subscription-product-card--business \{\s*--subscription-product-accent: var\(--product-services\)/)
  assert.match(subscriptionStyles, /\.subscription-product-card--events \{\s*--subscription-product-accent: var\(--product-events\)/)
  assert.match(subscriptionStyles, /\.subscription-product-card \{[\s\S]*?box-shadow: inset 0\.25rem 0 0 var\(--subscription-product-accent\)/)
  assert.match(subscriptionStyles, /\.subscription-product-card__status \{[\s\S]*?width: fit-content;[\s\S]*?border-radius: 999px;/)
  assert.doesNotMatch(subscriptionStyles, /\.subscription-product-card::before/)
  assert.doesNotMatch(subscriptionStyles, /:hover|transform:|animation:|transition:/)
})

test('removed four-plan comparison CSS has no customer-facing remnants', async () => {
  const styles = await readFile(stylesUrl, 'utf8')

  for (const obsoleteSelector of [
    '.subscription-content',
    '.subscription-current-card',
    '.subscription-plans',
    '.subscription-plan-grid',
    '.subscription-plan-item',
    '.subscription-plan-card',
  ]) {
    assert.equal(styles.includes(obsoleteSelector), false, obsoleteSelector)
  }
})
