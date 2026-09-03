import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import i18next from 'i18next'
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
import { ownerRejectionTranslations } from '../src/i18n/adminTranslations.js'
import { accountDeletionTranslations } from '../src/i18n/accountDeletionTranslations.js'
import { authenticatedTranslations } from '../src/i18n/locales/authenticatedTranslations.js'
import { fallbackLocaleCompletionTranslations } from '../src/i18n/locales/fallbackLocaleCompletionTranslations.js'
import { legalConsentTranslations } from '../src/i18n/locales/legalConsentTranslations.js'
import { legalPageContent } from '../src/i18n/locales/legalContent.js'
import { universalOperationalTranslations } from '../src/i18n/locales/universalOperationalTranslations.js'
import { publicBusinessDetailTranslations } from '../src/i18n/locales/publicBusinessDetailTranslations.js'
import { serviceAreaLabels } from '../src/utils/locations.js'
import { supportedUILanguages } from '../src/utils/languages.js'
import {
  SERVICE_TAXONOMY_GROUPS, SERVICE_TAXONOMY_SERVICES,
} from '../../../shared/firebase-contract/index.js'
import { serviceTaxonomyTranslations } from '../src/i18n/locales/serviceTaxonomyTranslations.js'
import { businessTaxonomyEditorTranslations } from '../src/i18n/locales/businessTaxonomyEditorTranslations.js'
import { serviceBrowseTranslations } from '../src/i18n/locales/serviceBrowseTranslations.js'
import { homepagePlatformTranslations } from '../src/i18n/locales/homepagePlatformTranslations.js'
import { productLandingTranslations } from '../src/i18n/locales/productLandingTranslations.js'
import { productNavigationTranslations } from '../src/i18n/locales/productNavigationTranslations.js'
import { footerNavigationTranslations } from '../src/i18n/locales/footerNavigationTranslations.js'
import { subscriptionProductTranslations } from '../src/i18n/locales/subscriptionProductTranslations.js'
import { savedBusinessTranslations } from '../src/i18n/locales/savedBusinessTranslations.js'
import {
  composeEnglishTranslationResource,
  composeLocaleTranslationResource,
  validateLocalePack,
} from '../src/i18n/translationComposition.js'
import {
  ENGLISH_ADMIN_SOURCE_NAME,
  ENGLISH_ONLY_ADMIN_PLURAL_KEY,
  isApprovedEnglishAdminPluralFallback,
} from './localePluralValidation.js'

const root = fileURLToPath(new URL('../src/i18n/locales/', import.meta.url))
const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url))
const jsonLocales = new Set(['en', 'es', 'fr', 'de', 'nl', 'pt'])
const representativeIntegerCounts = [0, 1, 2, 3, 4, 5, 10, 11, 12, 20, 21, 22, 25, 100, 101, 102]
const pluralSuffixPattern = /_(zero|one|two|few|many|other)$/
const supportedLocaleCodes = supportedUILanguages.map(({ code }) => code)
const nonEnglishLocaleCodes = supportedLocaleCodes.filter((code) => code !== 'en')
const fallbackLocaleCodes = ['ro', 'pl', 'cs', 'sk', 'hu', 'uk', 'it', 'fi', 'sv', 'da', 'no']

async function readJsonLocale(code) {
  return JSON.parse(await readFile(`${root}${code}.json`, 'utf8'))
}

function structure(value) {
  if (Array.isArray(value)) return 'array'
  if (value === null) return 'null'
  return typeof value === 'object' ? 'object' : typeof value
}

function getPath(resource, path) {
  return path.split('.').reduce((current, part) => current?.[part], resource)
}

function interpolationVariables(value) {
  return [...String(value).matchAll(/{{\s*([^}\s]+)\s*}}/g)]
    .map((match) => match[1])
    .sort()
}

function nonEmptyLeafIssues(value, locale, path = '', issues = []) {
  if (typeof value === 'string') {
    if (!value.trim()) issues.push(`${locale}: ${path}: empty translation`)
    return issues
  }
  if (!value || typeof value !== 'object') return issues
  for (const [key, child] of Object.entries(value)) {
    nonEmptyLeafIssues(child, locale, path ? `${path}.${key}` : key, issues)
  }
  return issues
}

function exactLocalePackIssues(name, pack, expectedLocales) {
  const issues = validateLocalePack(name, pack, expectedLocales)
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) return issues
  const expected = [...expectedLocales].sort()
  const received = Object.keys(pack).sort()
  if (JSON.stringify(expected) !== JSON.stringify(received)) {
    issues.push(`${name}: expected locales ${expected.join(', ')}, received ${received.join(', ')}`)
  }
  return issues
}

function requiredIntegerCategories(locale) {
  const rules = new Intl.PluralRules(locale)
  return new Set(representativeIntegerCounts.map((count) => rules.select(count)))
}

function isValidPluralExtension(reference, path, locale) {
  const match = path.match(pluralSuffixPattern)
  if (!match || !requiredIntegerCategories(locale).has(match[1])) return false
  const stem = path.slice(0, -match[0].length)
  return typeof getPath(reference, `${stem}_one`) === 'string'
    && typeof getPath(reference, `${stem}_other`) === 'string'
}

function compare(reference, candidate, locale, path = '', issues = []) {
  if (structure(reference) !== structure(candidate)) {
    issues.push(`${path || '<root>'}: expected ${structure(reference)}, received ${structure(candidate)}`)
    return issues
  }
  if (!reference || typeof reference !== 'object' || Array.isArray(reference)) return issues

  const referenceKeys = Object.keys(reference)
  const candidateKeys = Object.keys(candidate)
  for (const key of referenceKeys) {
    const nextPath = path ? `${path}.${key}` : key
    if (!Object.hasOwn(candidate, key)) issues.push(`${nextPath}: missing key`)
    else compare(reference[key], candidate[key], locale, nextPath, issues)
  }
  for (const key of candidateKeys) {
    if (Object.hasOwn(reference, key)) continue
    const nextPath = path ? `${path}.${key}` : key
    if (!isValidPluralExtension(referenceRoot, nextPath, locale)) {
      issues.push(`${nextPath}: unexpected key`)
      continue
    }
    const stem = nextPath.replace(pluralSuffixPattern, '')
    const expectedVariables = interpolationVariables(getPath(referenceRoot, `${stem}_other`))
    const receivedVariables = interpolationVariables(candidate[key])
    if (JSON.stringify(expectedVariables) !== JSON.stringify(receivedVariables)) {
      issues.push(`${nextPath}: interpolation variables do not match ${stem}_other`)
    }
  }
  return issues
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = `${directory}${entry.name}`
    if (entry.isDirectory()) return sourceFiles(`${path}/`)
    return /\.[jt]sx?$/.test(entry.name) ? [path] : []
  }))
  return nested.flat()
}

async function countAwareTranslationKeys() {
  const keys = new Set()
  for (const path of await sourceFiles(sourceRoot)) {
    const source = await readFile(path, 'utf8')
    const pattern = /\bt\(\s*['"]([^'"]+)['"]\s*,\s*\{[^}]*\bcount\s*:/gs
    for (const match of source.matchAll(pattern)) keys.add(match[1])
    const conditionalPattern = /\bt\([^?]+\?\s*['"]([^'"]+)['"]\s*:\s*['"][^'"]+['"]\s*,\s*\{[^}]*\bcount\s*:/gs
    for (const match of source.matchAll(conditionalPattern)) keys.add(match[1])
  }
  return keys
}

const english = await readJsonLocale('en')
const englishResource = composeEnglishTranslationResource({
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
})
const referenceRoot = englishResource
const failures = []
const resources = { en: { translation: englishResource } }
const countAwareKeys = await countAwareTranslationKeys()

const fullLocalePacks = {
  productNavigationTranslations,
  footerNavigationTranslations,
  subscriptionProductTranslations,
  savedBusinessTranslations,
  productLandingTranslations,
  authenticatedTranslations,
  conversationTerminalTranslations,
  adminDeletionTranslations,
  serviceTaxonomyTranslations,
  businessTaxonomyEditorTranslations,
  serviceBrowseTranslations,
  homepagePlatformTranslations,
  publicBusinessDetailTranslations,
  legalPageContent,
  ownerRejectionTranslations,
}
for (const [name, pack] of Object.entries(fullLocalePacks)) {
  failures.push(...exactLocalePackIssues(name, pack, supportedLocaleCodes))
}
for (const [name, pack] of Object.entries({
  legalConsentTranslations,
  universalOperationalTranslations,
  accountDeletionTranslations,
})) {
  failures.push(...exactLocalePackIssues(name, pack, nonEnglishLocaleCodes))
}
failures.push(...exactLocalePackIssues(
  'fallbackLocaleCompletionTranslations',
  fallbackLocaleCompletionTranslations,
  fallbackLocaleCodes,
))
failures.push(...nonEmptyLeafIssues(englishResource, 'en'))

for (const { code } of supportedUILanguages) {
  if (code === 'en') continue
  const base = jsonLocales.has(code) ? await readJsonLocale(code) : english
  const authenticated = authenticatedTranslations[code]
  if (!authenticated) {
    failures.push(`${code}: missing authenticated translation pack`)
    continue
  }

  const authenticatedIssues = compare(authenticatedTranslations.en, authenticated, code)
  const resource = composeLocaleTranslationResource({
    englishFallbackJson: english,
    baseLocale: base,
    productNavigationTranslations: productNavigationTranslations[code],
    footerNavigationTranslations: footerNavigationTranslations[code],
    subscriptionProductTranslations: subscriptionProductTranslations[code],
    savedBusinessTranslations: savedBusinessTranslations[code],
    authenticatedTranslations: authenticated,
    fallbackLocaleCompletionTranslations: fallbackLocaleCompletionTranslations[code],
    legalConsentTranslations: legalConsentTranslations[code],
    universalOperationalTranslations: universalOperationalTranslations[code],
    adminEnglishTranslations,
    ownerRejectionTranslations: ownerRejectionTranslations[code],
    accountDeletionTranslations: accountDeletionTranslations[code],
    conversationTerminalTranslations: conversationTerminalTranslations[code],
    adminDeletionTranslations: adminDeletionTranslations[code],
    serviceTaxonomyTranslations: serviceTaxonomyTranslations[code],
    businessTaxonomyEditorTranslations: businessTaxonomyEditorTranslations[code],
    serviceBrowseTranslations: serviceBrowseTranslations[code],
    homepagePlatformTranslations: homepagePlatformTranslations[code],
    productLandingTranslations: productLandingTranslations[code],
    legalPageContent: { legalPages: legalPageContent[code] },
    serviceAreaLabels: { locations: { areas: serviceAreaLabels } },
  })
  resources[code] = { translation: resource }
  const resourceIssues = compare(englishResource, resource, code)
  for (const issue of [...authenticatedIssues, ...resourceIssues]) failures.push(`${code}: ${issue}`)
  failures.push(...nonEmptyLeafIssues(resource, code))
}

const pluralizedCountKeys = [...countAwareKeys].filter((key) => (
  typeof getPath(englishResource, `${key}_one`) === 'string'
  && typeof getPath(englishResource, `${key}_other`) === 'string'
))
const expectedPluralizedKeys = new Set([
  'services.resultCount',
  'business.control.heroContextAreas',
  'business.control.missingCount',
  'business.control.serviceAreas',
  'business.form.errors.galleryRemaining',
])
const preservedDormantPluralizedKeys = new Set([
  'marketing.hero.ratingCount',
  'publicBusinessDetail.reviewCount',
])
for (const key of expectedPluralizedKeys) {
  if (!pluralizedCountKeys.includes(key)) failures.push(`${key}: pluralized count key is not used by source`)
}
for (const key of preservedDormantPluralizedKeys) {
  if (typeof getPath(englishResource, `${key}_one`) !== 'string'
    || typeof getPath(englishResource, `${key}_other`) !== 'string') {
    failures.push(`${key}: preserved dormant pluralized count key is incomplete`)
  }
}

const runtime = i18next.createInstance()
await runtime.init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: supportedUILanguages.map(({ code }) => code),
  initImmediate: false,
  interpolation: { escapeValue: false },
  returnNull: false,
})

for (const { code } of supportedUILanguages) {
  const coveredPluralKeys = new Set(preservedDormantPluralizedKeys)
  if (jsonLocales.has(code) || fallbackLocaleCompletionTranslations[code]) {
    pluralizedCountKeys.forEach((key) => coveredPluralKeys.add(key))
  }
  for (const key of coveredPluralKeys) {
    for (const count of representativeIntegerCounts) {
      const category = new Intl.PluralRules(code).select(count)
      const details = runtime.t(key, { count, lng: code, returnDetails: true })
      if (details.usedLng !== code) {
        if (!isApprovedEnglishAdminPluralFallback({
          key,
          locale: code,
          sourceName: ENGLISH_ADMIN_SOURCE_NAME,
        })) failures.push(`${code}: ${key} count ${count} fell back to ${details.usedLng}`)
      } else if (details.exactUsedKey !== `${key}_${category}`) {
        failures.push(`${code}: ${key} count ${count} used ${details.exactUsedKey}, expected ${key}_${category}`)
      } else if (!String(details.res).includes(String(count))) {
        failures.push(`${code}: ${key} count ${count} did not interpolate the count`)
      }
    }
  }
}

if (getPath(adminEnglishTranslations, `${ENGLISH_ONLY_ADMIN_PLURAL_KEY}_one`)
  !== getPath(englishResource, `${ENGLISH_ONLY_ADMIN_PLURAL_KEY}_one`)
  || getPath(adminEnglishTranslations, `${ENGLISH_ONLY_ADMIN_PLURAL_KEY}_other`)
  !== getPath(englishResource, `${ENGLISH_ONLY_ADMIN_PLURAL_KEY}_other`)) {
  failures.push(`${ENGLISH_ONLY_ADMIN_PLURAL_KEY}: English admin source is not authoritative`)
}

if (SERVICE_TAXONOMY_GROUPS.length !== 6) failures.push(`taxonomy: expected 6 groups, received ${SERVICE_TAXONOMY_GROUPS.length}`)
if (SERVICE_TAXONOMY_SERVICES.length !== 35) failures.push(`taxonomy: expected 35 services, received ${SERVICE_TAXONOMY_SERVICES.length}`)
const taxonomyTranslationKeys = [
  ...SERVICE_TAXONOMY_GROUPS.map(({ translationKey }) => translationKey),
  ...SERVICE_TAXONOMY_SERVICES.map(({ translationKey }) => translationKey),
]
for (const { code } of supportedUILanguages) {
  const taxonomyGroups = getPath(resources[code]?.translation, 'services.taxonomy.groups')
  const taxonomyServices = getPath(resources[code]?.translation, 'services.taxonomy.services')
  if (Object.keys(taxonomyGroups ?? {}).length !== SERVICE_TAXONOMY_GROUPS.length) {
    failures.push(`${code}: expected exactly ${SERVICE_TAXONOMY_GROUPS.length} taxonomy groups`)
  }
  if (Object.keys(taxonomyServices ?? {}).length !== SERVICE_TAXONOMY_SERVICES.length) {
    failures.push(`${code}: expected exactly ${SERVICE_TAXONOMY_SERVICES.length} taxonomy services`)
  }
  for (const key of taxonomyTranslationKeys) {
    const value = getPath(resources[code]?.translation, key)
    if (typeof value !== 'string' || !value.trim()) failures.push(`${code}: ${key}: missing or empty taxonomy translation`)
  }
}

if (failures.length > 0) {
  console.error(`Locale parity failed with ${failures.length} issue(s):`)
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log(`Locale parity passed for ${supportedUILanguages.length} locales.`)
}
