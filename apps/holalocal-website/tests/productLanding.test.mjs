import assert from 'node:assert/strict'
import test from 'node:test'
import { productLandingTranslations } from '../src/i18n/locales/productLandingTranslations.js'
import { readFile } from 'node:fs/promises'

const expectedLocales = [
  'en', 'es', 'fr', 'de', 'nl', 'pt', 'pl', 'ro', 'cs',
  'sk', 'hu', 'uk', 'it', 'sv', 'da', 'fi', 'no',
]

const requiredPageKeys = [
  'eyebrow',
  'title',
  'description',
  'supportingMessage',
]

test('product landing translations cover every website locale', () => {
  assert.deepEqual(
    Object.keys(productLandingTranslations).sort(),
    [...expectedLocales].sort(),
  )

  for (const locale of expectedLocales) {
    const translations = productLandingTranslations[locale]?.productLanding

    assert.ok(translations?.comingSoon?.trim(), `${locale}: comingSoon`)

    for (const product of ['events', 'community']) {
      for (const key of requiredPageKeys) {
        assert.ok(
          translations?.[product]?.[key]?.trim(),
          `${locale}: ${product}.${key}`,
        )
      }
    }
  }
})

test('English landing copy matches the approved honest product status', () => {
  const translations = productLandingTranslations.en.productLanding

  assert.equal(translations.comingSoon, 'Coming soon')
  assert.equal(
    translations.events.title,
    'Discover what’s happening locally.',
  )
  assert.equal(
    translations.community.title,
    'Connect with your local area.',
  )

  const combinedCopy = JSON.stringify(translations)

  assert.doesNotMatch(
    combinedCopy,
    /event listing|calendar|category|organiser profile|post|comment|like|feed/i,
  )
})

test('public Events and Community routes reuse one honest landing component', async () => {
  const [routes, eventsPage, communityPage, sharedPage] = await Promise.all([
    readFile(new URL('../src/routes/AppRoutes.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/EventsPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/CommunityPage.jsx', import.meta.url), 'utf8'),
    readFile(
      new URL(
        '../src/components/common/ProductComingSoonPage.jsx',
        import.meta.url,
      ),
      'utf8',
    ),
  ])

  assert.match(
    routes,
    /const EventsPage = lazy\(\(\) => import\('\.\.\/pages\/EventsPage\.jsx'\)\)/,
  )
  assert.match(
    routes,
    /const CommunityPage = lazy\(\(\) => import\('\.\.\/pages\/CommunityPage\.jsx'\)\)/,
  )
  assert.match(
    routes,
    /<Route path="events" element=\{<EventsPage \/>\} \/>/,
  )
  assert.match(
    routes,
    /<Route path="community" element=\{<CommunityPage \/>\} \/>/,
  )

  assert.match(eventsPage, /<ProductComingSoonPage product="events" \/>/)
  assert.match(
    communityPage,
    /<ProductComingSoonPage product="community" \/>/,
  )
  assert.match(sharedPage, /productLanding\.\$\{product\}/)
  assert.match(sharedPage, /productLanding\.comingSoon/)

  assert.doesNotMatch(
    `${eventsPage}\n${communityPage}\n${sharedPage}`,
    /firebase|firestore|event card|calendar|fake listing|feed|comments|likes/i,
  )
})