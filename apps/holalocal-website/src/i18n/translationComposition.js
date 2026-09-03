import { mergeLocale } from './locales/mergeLocale.js'

export const ENGLISH_TRANSLATION_SOURCE_ORDER = Object.freeze([
  'baseLocaleJson',
  'productNavigationTranslations',
  'footerNavigationTranslations',
  'subscriptionProductTranslations',
  'savedBusinessTranslations',
  'englishAuthenticatedResidual',
  'adminEnglishTranslations',
  'ownerEnglishRejectionTranslations',
  'englishLegalPages',
  'legalConsentEnglishTranslations',
  'accountDeletionEnglishTranslations',
  'conversationTerminalTranslations',
  'adminDeletionTranslations',
  'serviceTaxonomyTranslations',
  'businessTaxonomyEditorTranslations',
  'serviceBrowseTranslations',
  'homepagePlatformTranslations',
  'productLandingTranslations',
  'serviceAreaLabels',
])

export const LOCALE_TRANSLATION_SOURCE_ORDER = Object.freeze([
  'englishFallbackJson',
  'baseLocale',
  'productNavigationTranslations',
  'footerNavigationTranslations',
  'subscriptionProductTranslations',
  'savedBusinessTranslations',
  'authenticatedTranslations',
  'fallbackLocaleCompletionTranslations',
  'legalConsentTranslations',
  'universalOperationalTranslations',
  'adminEnglishTranslations',
  'ownerRejectionTranslations',
  'accountDeletionTranslations',
  'conversationTerminalTranslations',
  'adminDeletionTranslations',
  'serviceTaxonomyTranslations',
  'businessTaxonomyEditorTranslations',
  'serviceBrowseTranslations',
  'homepagePlatformTranslations',
  'productLandingTranslations',
  'legalPageContent',
  'serviceAreaLabels',
])

const optionalSources = new Set(['fallbackLocaleCompletionTranslations'])

function isTranslationObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function composeTranslationResource(sourceOrder, sources) {
  if (!Array.isArray(sourceOrder) || !isTranslationObject(sources)) {
    throw new TypeError('Translation composition requires an ordered manifest and source map.')
  }

  const expectedNames = [...sourceOrder]
  const receivedNames = Object.keys(sources)
  if (expectedNames.length !== receivedNames.length
    || expectedNames.some((name, index) => receivedNames[index] !== name)) {
    throw new Error(
      `Translation source mismatch. Expected: ${expectedNames.join(', ')}. Received: ${receivedNames.join(', ')}.`,
    )
  }

  const values = expectedNames.map((name) => {
    const value = sources[name]
    if (value === undefined && optionalSources.has(name)) return undefined
    if (!isTranslationObject(value)) {
      throw new TypeError(`Translation source "${name}" must be an object.`)
    }
    return value
  })
  return mergeLocale(values[0], ...values.slice(1))
}

export function composeEnglishTranslationResource(sources) {
  return composeTranslationResource(ENGLISH_TRANSLATION_SOURCE_ORDER, sources)
}

export function composeLocaleTranslationResource(sources) {
  return composeTranslationResource(LOCALE_TRANSLATION_SOURCE_ORDER, sources)
}

export function validateLocalePack(name, pack, requiredLocales) {
  if (!isTranslationObject(pack)) return [`${name}: expected a locale-pack object`]

  const issues = []
  for (const code of requiredLocales) {
    if (!Object.hasOwn(pack, code)) issues.push(`${name}: missing locale ${code}`)
    else if (!isTranslationObject(pack[code])) {
      issues.push(`${name}.${code}: expected a translation object`)
    }
  }
  return issues
}
