import { SUPPORTED_LANGUAGE_CODES, normalizeLanguage } from '@holalocal/firebase-contract'

export const supportedUILanguages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pt', name: 'Portuguese' },
]

export const spokenLanguageOptions = [
  ...supportedUILanguages.map(({ name }) => name),
  'Other',
]

export const supportedAccountLanguageCodes = [...SUPPORTED_LANGUAGE_CODES]

const englishLanguageNames = Object.freeze({
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', nl: 'Dutch',
  pt: 'Portuguese', pl: 'Polish', ro: 'Romanian', cs: 'Czech', sk: 'Slovak',
  hu: 'Hungarian', uk: 'Ukrainian', it: 'Italian', sv: 'Swedish', da: 'Danish',
  fi: 'Finnish', no: 'Norwegian',
})

export function getLanguageDisplayName(code, locale = 'en') {
  try {
    if (typeof Intl.DisplayNames !== 'function') return englishLanguageNames[code] ?? code
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? englishLanguageNames[code] ?? code
  } catch {
    return englishLanguageNames[code] ?? code
  }
}

export function getLanguageCodeFromName(languageName) {
  const result = normalizeLanguage(languageName)
  return result.value?.isCustom ? null : result.value?.id ?? null
}

export function getAuthenticatedUiLanguage(preferredLocale) {
  const code = getLanguageCodeFromName(preferredLocale)
  if (!code) return null
  return supportedUILanguages.some((language) => language.code === code) ? code : 'en'
}

export function getLanguageNameFromCode(languageCode) {
  const normalizedCode = languageCode?.split('-')[0].toLowerCase()
  return supportedUILanguages.find(({ code }) => code === normalizedCode)?.name ?? null
}
