import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  NON_ENGLISH_TRANSLATION_PACK_LOCALES,
  getNonEnglishTranslationSlices,
} from '../src/i18n/locales/nonEnglishTranslationPacks.js'
import { businessTaxonomyEditorTranslations } from '../src/i18n/locales/businessTaxonomyEditorTranslations.js'
import { footerNavigationTranslations } from '../src/i18n/locales/footerNavigationTranslations.js'
import { homepagePlatformTranslations } from '../src/i18n/locales/homepagePlatformTranslations.js'
import { productLandingTranslations } from '../src/i18n/locales/productLandingTranslations.js'
import { productNavigationTranslations } from '../src/i18n/locales/productNavigationTranslations.js'
import { savedBusinessTranslations } from '../src/i18n/locales/savedBusinessTranslations.js'
import { serviceBrowseTranslations } from '../src/i18n/locales/serviceBrowseTranslations.js'
import { serviceTaxonomyTranslations } from '../src/i18n/locales/serviceTaxonomyTranslations.js'
import { subscriptionProductTranslations } from '../src/i18n/locales/subscriptionProductTranslations.js'
import { businessTaxonomyEditorEnglishTranslations } from '../src/i18n/businessTaxonomyEditorEnglishTranslations.js'
import { footerNavigationEnglishTranslations } from '../src/i18n/footerNavigationEnglishTranslations.js'
import { homepagePlatformEnglishTranslations } from '../src/i18n/homepagePlatformEnglishTranslations.js'
import { productLandingEnglishTranslations } from '../src/i18n/productLandingEnglishTranslations.js'
import { productNavigationEnglishTranslations } from '../src/i18n/productNavigationEnglishTranslations.js'
import { savedBusinessEnglishTranslations } from '../src/i18n/savedBusinessEnglishTranslations.js'
import { serviceBrowseEnglishTranslations } from '../src/i18n/serviceBrowseEnglishTranslations.js'
import { serviceTaxonomyEnglishTranslations } from '../src/i18n/serviceTaxonomyEnglishTranslations.js'
import { subscriptionProductEnglishTranslations } from '../src/i18n/subscriptionProductEnglishTranslations.js'
import {
  ENGLISH_TRANSLATION_SOURCE_ORDER,
  LOCALE_TRANSLATION_SOURCE_ORDER,
} from '../src/i18n/translationComposition.js'

const packDefinitions = [
  ['serviceTaxonomyTranslations', serviceTaxonomyTranslations, serviceTaxonomyEnglishTranslations],
  ['businessTaxonomyEditorTranslations', businessTaxonomyEditorTranslations, businessTaxonomyEditorEnglishTranslations],
  ['serviceBrowseTranslations', serviceBrowseTranslations, serviceBrowseEnglishTranslations],
  ['homepagePlatformTranslations', homepagePlatformTranslations, homepagePlatformEnglishTranslations],
  ['productLandingTranslations', productLandingTranslations, productLandingEnglishTranslations],
  ['productNavigationTranslations', productNavigationTranslations, productNavigationEnglishTranslations],
  ['footerNavigationTranslations', footerNavigationTranslations, footerNavigationEnglishTranslations],
  ['subscriptionProductTranslations', subscriptionProductTranslations, subscriptionProductEnglishTranslations],
  ['savedBusinessTranslations', savedBusinessTranslations, savedBusinessEnglishTranslations],
]

const expectedLocales = [
  'en', 'es', 'fr', 'de', 'nl', 'pt', 'pl', 'ro', 'cs',
  'sk', 'hu', 'uk', 'it', 'sv', 'da', 'fi', 'no',
]

test('combined packs use the extracted English sources as their single authority', () => {
  for (const [name, pack, englishSource] of packDefinitions) {
    assert.equal(pack.en, englishSource, name)
    assert.deepEqual(Object.keys(pack).sort(), [...expectedLocales].sort(), name)
  }
})

test('the fixed non-English aggregator supplies every pack for all 16 locales', () => {
  assert.deepEqual(NON_ENGLISH_TRANSLATION_PACK_LOCALES, expectedLocales.slice(1))
  for (const code of NON_ENGLISH_TRANSLATION_PACK_LOCALES) {
    const slices = getNonEnglishTranslationSlices(code)
    assert.deepEqual(Object.keys(slices), [
      'productNavigationTranslations',
      'footerNavigationTranslations',
      'subscriptionProductTranslations',
      'savedBusinessTranslations',
      'serviceTaxonomyTranslations',
      'businessTaxonomyEditorTranslations',
      'serviceBrowseTranslations',
      'homepagePlatformTranslations',
      'productLandingTranslations',
    ])
    for (const [name, pack] of packDefinitions) assert.equal(slices[name], pack[code], `${code}.${name}`)
  }
  assert.throws(() => getNonEnglishTranslationSlices('en'), /Unsupported non-English/)
  assert.throws(() => getNonEnglishTranslationSlices('xx'), /Unsupported non-English/)
})

test('the synchronous English graph imports only English sources for guarded packs', async () => {
  const indexSource = await readFile(new URL('../src/i18n/index.js', import.meta.url), 'utf8')
  for (const [name] of packDefinitions) {
    assert.doesNotMatch(indexSource, new RegExp(`^import .*locales/${name}\\.js`, 'm'), name)
    const englishName = name.replace(/Translations$/, 'EnglishTranslations')
    assert.match(indexSource, new RegExp(`^import .*${englishName}.*\\./${englishName}\\.js`, 'm'), englishName)
  }
  assert.match(indexSource, /import\('\.\/locales\/nonEnglishTranslationPacks\.js'\)/)
  assert.doesNotMatch(indexSource, /^import .*nonEnglishTranslationPacks\.js/m)
})

test('English source modules cannot import combined or non-English resources', async () => {
  for (const [name] of packDefinitions) {
    const englishName = name.replace(/Translations$/, 'EnglishTranslations')
    const source = await readFile(new URL(`../src/i18n/${englishName}.js`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /\bimport\b/, englishName)
    assert.doesNotMatch(source, /locales\//, englishName)
    assert.doesNotMatch(source, new RegExp(name), englishName)
  }
})

test('runtime source manifests retain the nine names and authoritative order', () => {
  const expectedEnglishPositions = {
    productNavigationTranslations: 1,
    footerNavigationTranslations: 2,
    subscriptionProductTranslations: 3,
    savedBusinessTranslations: 4,
    serviceTaxonomyTranslations: 13,
    businessTaxonomyEditorTranslations: 14,
    serviceBrowseTranslations: 15,
    homepagePlatformTranslations: 16,
    productLandingTranslations: 17,
  }
  const expectedLocalePositions = {
    productNavigationTranslations: 2,
    footerNavigationTranslations: 3,
    subscriptionProductTranslations: 4,
    savedBusinessTranslations: 5,
    serviceTaxonomyTranslations: 15,
    businessTaxonomyEditorTranslations: 16,
    serviceBrowseTranslations: 17,
    homepagePlatformTranslations: 18,
    productLandingTranslations: 19,
  }
  for (const [name, position] of Object.entries(expectedEnglishPositions)) {
    assert.equal(ENGLISH_TRANSLATION_SOURCE_ORDER.indexOf(name), position, name)
  }
  for (const [name, position] of Object.entries(expectedLocalePositions)) {
    assert.equal(LOCALE_TRANSLATION_SOURCE_ORDER.indexOf(name), position, name)
  }
})
