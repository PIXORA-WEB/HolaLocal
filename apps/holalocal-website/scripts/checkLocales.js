import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { authenticatedTranslations } from '../src/i18n/locales/authenticatedTranslations.js'
import { mergeLocale } from '../src/i18n/locales/mergeLocale.js'
import { serviceAreaLabels } from '../src/utils/locations.js'
import { supportedUILanguages } from '../src/utils/languages.js'

const root = fileURLToPath(new URL('../src/i18n/locales/', import.meta.url))
const jsonLocales = new Set(['en', 'es', 'fr', 'de', 'nl', 'pt'])

async function readJsonLocale(code) {
  return JSON.parse(await readFile(`${root}${code}.json`, 'utf8'))
}

function structure(value) {
  if (Array.isArray(value)) return 'array'
  if (value === null) return 'null'
  return typeof value === 'object' ? 'object' : typeof value
}

function compare(reference, candidate, path = '', issues = []) {
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
    else compare(reference[key], candidate[key], nextPath, issues)
  }
  for (const key of candidateKeys) {
    if (!Object.hasOwn(reference, key)) issues.push(`${path ? `${path}.` : ''}${key}: unexpected key`)
  }
  return issues
}

const english = await readJsonLocale('en')
const englishResource = mergeLocale(english, authenticatedTranslations.en, {
  locations: { areas: serviceAreaLabels },
})
const failures = []

for (const { code } of supportedUILanguages) {
  const base = jsonLocales.has(code) ? await readJsonLocale(code) : english
  const authenticated = authenticatedTranslations[code]
  if (!authenticated) {
    failures.push(`${code}: missing authenticated translation pack`)
    continue
  }

  const authenticatedIssues = compare(authenticatedTranslations.en, authenticated)
  const resource = mergeLocale(english, base, authenticated, {
    locations: { areas: serviceAreaLabels },
  })
  const resourceIssues = compare(englishResource, resource)
  for (const issue of [...authenticatedIssues, ...resourceIssues]) failures.push(`${code}: ${issue}`)
}

if (failures.length > 0) {
  console.error(`Locale parity failed with ${failures.length} issue(s):`)
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log(`Locale parity passed for ${supportedUILanguages.length} locales.`)
}
