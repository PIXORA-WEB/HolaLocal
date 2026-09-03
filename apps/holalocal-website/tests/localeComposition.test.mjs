import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  adminEnglishTranslations,
  ownerEnglishRejectionTranslations,
} from '../src/i18n/defaultTranslations.js'
import { englishLegalPages } from '../src/i18n/englishLegalPages.js'
import { legalConsentEnglishTranslations } from '../src/i18n/legalConsentEnglishTranslations.js'
import { accountDeletionEnglishTranslations } from '../src/i18n/accountDeletionEnglishTranslations.js'
import { conversationTerminalTranslations } from '../src/i18n/conversationTerminalTranslations.js'
import { adminDeletionTranslations } from '../src/i18n/adminDeletionTranslations.js'
import { englishAuthenticatedResidual } from '../src/i18n/englishAuthenticatedResidual.js'
import { authenticatedTranslations } from '../src/i18n/locales/authenticatedTranslations.js'
import { businessTaxonomyEditorTranslations } from '../src/i18n/locales/businessTaxonomyEditorTranslations.js'
import { footerNavigationTranslations } from '../src/i18n/locales/footerNavigationTranslations.js'
import { homepagePlatformTranslations } from '../src/i18n/locales/homepagePlatformTranslations.js'
import { productLandingTranslations } from '../src/i18n/locales/productLandingTranslations.js'
import { productNavigationTranslations } from '../src/i18n/locales/productNavigationTranslations.js'
import { savedBusinessTranslations } from '../src/i18n/locales/savedBusinessTranslations.js'
import { serviceBrowseTranslations } from '../src/i18n/locales/serviceBrowseTranslations.js'
import { serviceTaxonomyTranslations } from '../src/i18n/locales/serviceTaxonomyTranslations.js'
import { subscriptionProductTranslations } from '../src/i18n/locales/subscriptionProductTranslations.js'
import { mergeLocale } from '../src/i18n/locales/mergeLocale.js'
import {
  composeEnglishTranslationResource,
  composeTranslationResource,
  ENGLISH_TRANSLATION_SOURCE_ORDER,
  LOCALE_TRANSLATION_SOURCE_ORDER,
  validateLocalePack,
} from '../src/i18n/translationComposition.js'
import { serviceAreaLabels } from '../src/utils/locations.js'
import { supportedUILanguages } from '../src/utils/languages.js'
import {
  ENGLISH_ADMIN_SOURCE_NAME,
  ENGLISH_ONLY_ADMIN_PLURAL_KEY,
  isApprovedEnglishAdminPluralFallback,
} from '../scripts/localePluralValidation.js'

const approvedResidualPaths = [
  'account.profileUnavailable.description',
  'workflow.actions.refreshAccount',
  'workflow.actions.contactSupport',
  'profile.errors.savePermissionDenied',
  'profile.errors.saveNetworkUnavailable',
  'profile.errors.saveFailed',
  'business.form.location.selectedContext',
  'business.form.errors.savePermissionDenied',
  'business.form.errors.saveNetworkUnavailable',
  'business.form.errors.saveFailed',
  'common.change',
  'common.changeImage',
  'common.loadingAccount',
  'language.saveError',
].sort()

function leafMap(value, path = '', result = new Map()) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      leafMap(child, path ? `${path}.${key}` : key, result)
    }
  } else result.set(path, value)
  return result
}

function getPath(resource, path) {
  return path.split('.').reduce((current, part) => current?.[part], resource)
}

const english = JSON.parse(await readFile(
  new URL('../src/i18n/locales/en.json', import.meta.url),
  'utf8',
))
const englishSources = {
  baseLocaleJson: english,
  productNavigationTranslations: productNavigationTranslations.en,
  footerNavigationTranslations: footerNavigationTranslations.en,
  subscriptionProductTranslations: subscriptionProductTranslations.en,
  savedBusinessTranslations: savedBusinessTranslations.en,
  englishAuthenticatedResidual,
  adminEnglishTranslations,
  ownerEnglishRejectionTranslations,
  englishLegalPages: { legalPages: englishLegalPages },
  legalConsentEnglishTranslations,
  accountDeletionEnglishTranslations,
  conversationTerminalTranslations: conversationTerminalTranslations.en,
  adminDeletionTranslations: adminDeletionTranslations.en,
  serviceTaxonomyTranslations: serviceTaxonomyTranslations.en,
  businessTaxonomyEditorTranslations: businessTaxonomyEditorTranslations.en,
  serviceBrowseTranslations: serviceBrowseTranslations.en,
  homepagePlatformTranslations: homepagePlatformTranslations.en,
  productLandingTranslations: productLandingTranslations.en,
  serviceAreaLabels: { locations: { areas: serviceAreaLabels } },
}

test('English authenticated residual contains exactly the approved authoritative leaves', () => {
  const residualLeaves = leafMap(englishAuthenticatedResidual)
  assert.deepEqual([...residualLeaves.keys()].sort(), approvedResidualPaths)
  assert.equal(residualLeaves.size, 14)
  for (const path of approvedResidualPaths) {
    assert.equal(residualLeaves.get(path), getPath(authenticatedTranslations.en, path))
  }
})

test('each residual value has one authoritative literal across its source and consumer', async () => {
  const source = await readFile(
    new URL('../src/i18n/englishAuthenticatedResidual.js', import.meta.url),
    'utf8',
  )
  const consumer = await readFile(
    new URL('../src/i18n/locales/authenticatedTranslations.js', import.meta.url),
    'utf8',
  )
  for (const value of leafMap(englishAuthenticatedResidual).values()) {
    const occurrences = `${source}\n${consumer}`.split(value).length - 1
    assert.equal(occurrences, 1, value)
  }
})

test('English residual composition adds 14 leaves without changing existing values', () => {
  const withoutResidual = mergeLocale(
    ...ENGLISH_TRANSLATION_SOURCE_ORDER
      .filter((name) => name !== 'englishAuthenticatedResidual')
      .map((name) => englishSources[name]),
  )
  const withResidual = composeEnglishTranslationResource(englishSources)
  const before = leafMap(withoutResidual)
  const after = leafMap(withResidual)
  const additions = [...after.keys()].filter((path) => !before.has(path)).sort()

  assert.deepEqual(additions, approvedResidualPaths)
  assert.equal(after.size - before.size, 14)
  for (const [path, value] of before) assert.equal(after.get(path), value, path)
})

test('composition manifests reject removal, reordering, count drift, and malformed sources', () => {
  assert.throws(
    () => composeEnglishTranslationResource({ ...englishSources, englishAuthenticatedResidual: undefined }),
    /englishAuthenticatedResidual.*must be an object/,
  )
  const reordered = Object.fromEntries([
    ...Object.entries(englishSources).slice(1),
    Object.entries(englishSources)[0],
  ])
  assert.throws(() => composeEnglishTranslationResource(reordered), /Translation source mismatch/)
  assert.throws(
    () => composeEnglishTranslationResource({ ...englishSources, unexpectedPack: {} }),
    /Translation source mismatch/,
  )
  assert.throws(
    () => composeTranslationResource(ENGLISH_TRANSLATION_SOURCE_ORDER, null),
    /ordered manifest and source map/,
  )
})

test('all runtime packs and 17 supported locales remain represented', () => {
  assert.equal(supportedUILanguages.length, 17)
  assert.deepEqual(
    supportedUILanguages.map(({ code }) => code),
    ['en', 'es', 'fr', 'de', 'nl', 'pt', 'pl', 'ro', 'cs', 'sk', 'hu', 'uk', 'it', 'sv', 'da', 'fi', 'no'],
  )
  for (const name of [
    'productNavigationTranslations', 'footerNavigationTranslations',
    'subscriptionProductTranslations', 'savedBusinessTranslations',
    'productLandingTranslations', 'authenticatedTranslations',
    'fallbackLocaleCompletionTranslations', 'legalConsentTranslations',
    'universalOperationalTranslations', 'accountDeletionTranslations',
    'conversationTerminalTranslations', 'adminDeletionTranslations',
  ]) {
    assert.ok(
      ENGLISH_TRANSLATION_SOURCE_ORDER.includes(name)
        || LOCALE_TRANSLATION_SOURCE_ORDER.includes(name),
      name,
    )
  }
  assert.deepEqual(validateLocalePack('testPack', { en: {} }, ['en']), [])
  assert.deepEqual(validateLocalePack('testPack', {}, ['en']), ['testPack: missing locale en'])
})

test('only the exact English-admin plural fallback is approved', () => {
  assert.equal(isApprovedEnglishAdminPluralFallback({
    key: ENGLISH_ONLY_ADMIN_PLURAL_KEY,
    locale: 'pl',
    sourceName: ENGLISH_ADMIN_SOURCE_NAME,
  }), true)
  assert.equal(isApprovedEnglishAdminPluralFallback({
    key: 'admin.review.anotherCount',
    locale: 'pl',
    sourceName: ENGLISH_ADMIN_SOURCE_NAME,
  }), false)
  assert.equal(isApprovedEnglishAdminPluralFallback({
    key: 'services.resultCount',
    locale: 'pl',
    sourceName: ENGLISH_ADMIN_SOURCE_NAME,
  }), false)
  assert.equal(isApprovedEnglishAdminPluralFallback({
    key: ENGLISH_ONLY_ADMIN_PLURAL_KEY,
    locale: 'de',
    sourceName: ENGLISH_ADMIN_SOURCE_NAME,
  }), false)
  assert.equal(isApprovedEnglishAdminPluralFallback({
    key: ENGLISH_ONLY_ADMIN_PLURAL_KEY,
    locale: 'pl',
    sourceName: 'anotherSource',
  }), false)
})

test('runtime and checker share composition functions while authenticated locales stay lazy', async () => {
  const runtimeSource = await readFile(new URL('../src/i18n/index.js', import.meta.url), 'utf8')
  const checkerSource = await readFile(new URL('../scripts/checkLocales.js', import.meta.url), 'utf8')

  for (const functionName of ['composeEnglishTranslationResource', 'composeLocaleTranslationResource']) {
    assert.match(runtimeSource, new RegExp(`\\b${functionName}\\b`))
    assert.match(checkerSource, new RegExp(`\\b${functionName}\\b`))
  }
  assert.match(runtimeSource, /import\('\.\/locales\/authenticatedTranslations\.js'\)/)
  assert.doesNotMatch(runtimeSource, /^import .*authenticatedTranslations\.js/m)
  assert.match(runtimeSource, /import \{ englishAuthenticatedResidual \} from '\.\/englishAuthenticatedResidual\.js'/)
})
