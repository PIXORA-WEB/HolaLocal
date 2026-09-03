import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ENGLISH_TRANSLATION_SOURCE_ORDER,
  LOCALE_TRANSLATION_SOURCE_ORDER,
} from '../src/i18n/translationComposition.js'
import { subscriptionProductTranslations } from '../src/i18n/locales/subscriptionProductTranslations.js'

const expectedLocales = [
  'en', 'es', 'fr', 'de', 'nl', 'pt', 'pl', 'ro', 'cs',
  'sk', 'hu', 'uk', 'it', 'sv', 'da', 'fi', 'no',
]

const requiredPaths = [
  'title',
  'description',
  'business.title',
  'business.status',
  'business.description',
  'events.title',
  'events.status',
  'events.description',
]

function valueAtPath(resource, path) {
  return path.split('.').reduce((value, key) => value?.[key], resource)
}

function collectPropertyNames(value) {
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, nestedValue]) => [
    key,
    ...collectPropertyNames(nestedValue),
  ])
}

function collectStrings(value) {
  if (typeof value === 'string') return [value]
  if (!value || typeof value !== 'object') return []
  return Object.values(value).flatMap(collectStrings)
}

test('subscription product translations cover every website locale', () => {
  assert.deepEqual(
    Object.keys(subscriptionProductTranslations).sort(),
    [...expectedLocales].sort(),
  )

  for (const locale of expectedLocales) {
    const resource = subscriptionProductTranslations[locale]
    assert.deepEqual(Object.keys(resource), ['subscriptionProducts'])
    assert.equal(Object.isFrozen(resource), true, `${locale}: locale resource is frozen`)
    assert.equal(Object.isFrozen(resource.subscriptionProducts), true, `${locale}: namespace is frozen`)
    assert.equal(Object.isFrozen(resource.subscriptionProducts.business), true, `${locale}: business group is frozen`)
    assert.equal(Object.isFrozen(resource.subscriptionProducts.events), true, `${locale}: events group is frozen`)

    for (const path of requiredPaths) {
      const value = valueAtPath(resource.subscriptionProducts, path)
      assert.equal(typeof value, 'string', `${locale}: subscriptionProducts.${path}`)
      assert.notEqual(value.trim(), '', `${locale}: subscriptionProducts.${path}`)
    }

    assert.equal(Object.hasOwn(resource, 'nav'), false, `${locale}: must not duplicate navigation labels`)
  }

  assert.deepEqual(subscriptionProductTranslations.en.subscriptionProducts, {
    title: 'Your subscriptions',
    description: 'See what’s included today and what’s coming next.',
    business: {
      title: 'Business',
      status: 'Free during Early Access',
      description: 'Create and manage your business profile free while HolaLocal is in Early Access.',
    },
    events: {
      title: 'Events',
      status: 'Coming soon',
      description: 'Subscription options for Events will be introduced when HolaLocal Events is ready.',
    },
  })
})

test('subscription product translations contain no internal plan or payment vocabulary', () => {
  const propertyNames = collectPropertyNames(subscriptionProductTranslations)
    .map((key) => key.toLowerCase())
  const englishCopy = collectStrings(subscriptionProductTranslations.en)
    .join(' ')
    .toLowerCase()

  for (const forbidden of [
    'early_access', 'starter', 'growth', 'pro', 'limits', 'prices',
    'stripe', 'checkout', 'payment',
  ]) {
    assert.equal(propertyNames.includes(forbidden), false, `property: ${forbidden}`)
  }
  assert.doesNotMatch(
    englishCopy,
    /\b(?:starter|growth|pro|limits?|prices?|stripe|checkout|payments?)\b/,
  )
})

test('subscription product translations retain their authoritative composition position', () => {
  assert.equal(
    ENGLISH_TRANSLATION_SOURCE_ORDER.indexOf('subscriptionProductTranslations'),
    ENGLISH_TRANSLATION_SOURCE_ORDER.indexOf('footerNavigationTranslations') + 1,
  )
  assert.equal(
    LOCALE_TRANSLATION_SOURCE_ORDER.indexOf('subscriptionProductTranslations'),
    LOCALE_TRANSLATION_SOURCE_ORDER.indexOf('footerNavigationTranslations') + 1,
  )
})
