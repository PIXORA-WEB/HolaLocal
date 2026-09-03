import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ENGLISH_TRANSLATION_SOURCE_ORDER,
  LOCALE_TRANSLATION_SOURCE_ORDER,
} from '../src/i18n/translationComposition.js'
import { productNavigationTranslations } from '../src/i18n/locales/productNavigationTranslations.js'

const expectedLocales = [
  'en', 'es', 'fr', 'de', 'nl', 'pt', 'pl', 'ro', 'cs',
  'sk', 'hu', 'uk', 'it', 'sv', 'da', 'fi', 'no',
]

test('product navigation translations cover every website locale', () => {
  assert.deepEqual(
    Object.keys(productNavigationTranslations).sort(),
    [...expectedLocales].sort(),
  )

  for (const locale of expectedLocales) {
    const navigation = productNavigationTranslations[locale]?.nav

    for (const key of ['services', 'events', 'community']) {
      assert.equal(typeof navigation?.[key], 'string', `${locale}: nav.${key}`)
      assert.notEqual(navigation[key].trim(), '', `${locale}: nav.${key}`)
    }
  }

  assert.deepEqual(productNavigationTranslations.en.nav, {
    services: 'Services',
    events: 'Events',
    community: 'Community',
  })
})

test('product navigation translations retain their authoritative composition position', () => {
  assert.equal(ENGLISH_TRANSLATION_SOURCE_ORDER[1], 'productNavigationTranslations')
  assert.equal(LOCALE_TRANSLATION_SOURCE_ORDER[2], 'productNavigationTranslations')
})
