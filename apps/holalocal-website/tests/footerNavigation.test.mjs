import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ENGLISH_TRANSLATION_SOURCE_ORDER,
  LOCALE_TRANSLATION_SOURCE_ORDER,
} from '../src/i18n/translationComposition.js'
import { footerNavigationTranslations } from '../src/i18n/locales/footerNavigationTranslations.js'

const expectedLocales = [
  'en', 'es', 'fr', 'de', 'nl', 'pt', 'pl', 'ro', 'cs',
  'sk', 'hu', 'uk', 'it', 'sv', 'da', 'fi', 'no',
]

test('footer navigation translations cover every website locale', () => {
  assert.deepEqual(
    Object.keys(footerNavigationTranslations).sort(),
    [...expectedLocales].sort(),
  )

  for (const locale of expectedLocales) {
    const resource = footerNavigationTranslations[locale]
    const footer = resource?.footer

    for (const key of ['explore', 'exploreLabel', 'helpLegal', 'helpLegalLabel']) {
      assert.equal(typeof footer?.[key], 'string', `${locale}: footer.${key}`)
      assert.notEqual(footer[key].trim(), '', `${locale}: footer.${key}`)
    }

    assert.equal(Object.hasOwn(resource, 'nav'), false, `${locale}: must not duplicate nav product labels`)
  }

  assert.deepEqual(footerNavigationTranslations.en.footer, {
    explore: 'Explore',
    exploreLabel: 'Explore HolaLocal',
    helpLegal: 'Help & Legal',
    helpLegalLabel: 'Help and legal information',
  })
})

test('footer navigation translations retain their authoritative composition position', () => {
  assert.equal(
    ENGLISH_TRANSLATION_SOURCE_ORDER.indexOf('footerNavigationTranslations'),
    ENGLISH_TRANSLATION_SOURCE_ORDER.indexOf('productNavigationTranslations') + 1,
  )
  assert.equal(
    LOCALE_TRANSLATION_SOURCE_ORDER.indexOf('footerNavigationTranslations'),
    LOCALE_TRANSLATION_SOURCE_ORDER.indexOf('productNavigationTranslations') + 1,
  )
})
