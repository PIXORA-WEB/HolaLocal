import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import i18next from 'i18next'
import { authenticatedTranslations } from '../src/i18n/locales/authenticatedTranslations.js'
import { fallbackLocaleCompletionTranslations } from '../src/i18n/locales/fallbackLocaleCompletionTranslations.js'
import { legalPageContent } from '../src/i18n/locales/legalContent.js'
import { mergeLocale } from '../src/i18n/locales/mergeLocale.js'
import { universalOperationalTranslations } from '../src/i18n/locales/universalOperationalTranslations.js'
import { serviceAreaLabels } from '../src/utils/locations.js'
import { supportedUILanguages } from '../src/utils/languages.js'

const root = fileURLToPath(new URL('../src/i18n/locales/', import.meta.url))
const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url))
const jsonLocales = new Set(['en', 'es', 'fr', 'de', 'nl', 'pt'])
const representativeIntegerCounts = [0, 1, 2, 3, 4, 5, 10, 11, 12, 20, 21, 22, 25, 100, 101, 102]
const pluralSuffixPattern = /_(zero|one|two|few|many|other)$/

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
const englishResource = mergeLocale(english, authenticatedTranslations.en, { legalPages: legalPageContent.en }, {
  locations: { areas: serviceAreaLabels },
})
const referenceRoot = englishResource
const failures = []
const resources = { en: { translation: englishResource } }
const countAwareKeys = await countAwareTranslationKeys()

for (const { code } of supportedUILanguages) {
  const base = jsonLocales.has(code) ? await readJsonLocale(code) : english
  const authenticated = authenticatedTranslations[code]
  if (!authenticated) {
    failures.push(`${code}: missing authenticated translation pack`)
    continue
  }

  const authenticatedIssues = compare(authenticatedTranslations.en, authenticated, code)
  const resource = mergeLocale(english, base, authenticated, fallbackLocaleCompletionTranslations[code], universalOperationalTranslations[code], {
    legalPages: legalPageContent[code],
    locations: { areas: serviceAreaLabels },
  })
  resources[code] = { translation: resource }
  const resourceIssues = compare(englishResource, resource, code)
  for (const issue of [...authenticatedIssues, ...resourceIssues]) failures.push(`${code}: ${issue}`)
}

const pluralizedCountKeys = [...countAwareKeys].filter((key) => (
  typeof getPath(englishResource, `${key}_one`) === 'string'
  && typeof getPath(englishResource, `${key}_other`) === 'string'
))
const expectedPluralizedKeys = new Set([
  'marketing.hero.ratingCount',
  'publicBusinessDetail.reviewCount',
  'services.resultCount',
  'business.control.heroContextAreas',
  'business.control.missingCount',
  'business.control.serviceAreas',
  'business.form.errors.galleryRemaining',
])
for (const key of expectedPluralizedKeys) {
  if (!pluralizedCountKeys.includes(key)) failures.push(`${key}: pluralized count key is not used by source`)
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
  const coveredPluralKeys = new Set(['publicBusinessDetail.reviewCount'])
  if (jsonLocales.has(code) || fallbackLocaleCompletionTranslations[code]) {
    pluralizedCountKeys.forEach((key) => coveredPluralKeys.add(key))
  }
  for (const key of coveredPluralKeys) {
    for (const count of representativeIntegerCounts) {
      const category = new Intl.PluralRules(code).select(count)
      const details = runtime.t(key, { count, lng: code, returnDetails: true })
      if (details.usedLng !== code) {
        failures.push(`${code}: ${key} count ${count} fell back to ${details.usedLng}`)
      } else if (details.exactUsedKey !== `${key}_${category}`) {
        failures.push(`${code}: ${key} count ${count} used ${details.exactUsedKey}, expected ${key}_${category}`)
      } else if (!String(details.res).includes(String(count))) {
        failures.push(`${code}: ${key} count ${count} did not interpolate the count`)
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`Locale parity failed with ${failures.length} issue(s):`)
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log(`Locale parity passed for ${supportedUILanguages.length} locales.`)
}
