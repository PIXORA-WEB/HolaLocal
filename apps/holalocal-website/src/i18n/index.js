import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { supportedUILanguages } from '../utils/languages.js'
import { serviceAreaLabels } from '../utils/locations.js'
import {
  adminEnglishTranslations,
  ownerEnglishRejectionTranslations,
} from './defaultTranslations.js'
import { englishLegalPages } from './englishLegalPages.js'
import { legalConsentEnglishTranslations } from './legalConsentEnglishTranslations.js'
import { accountDeletionEnglishTranslations } from './accountDeletionEnglishTranslations.js'
import { conversationTerminalTranslations } from './conversationTerminalTranslations.js'
import { adminDeletionTranslations } from './adminDeletionTranslations.js'
import en from './locales/en.json'
import { mergeLocale } from './locales/mergeLocale.js'

export const LANGUAGE_STORAGE_KEY = 'holalocal.uiLanguage'

const localeLoaders = {
  cs: () => import('./locales/cs.js'),
  da: () => import('./locales/da.js'),
  de: () => import('./locales/de.json'),
  es: () => import('./locales/es.json'),
  fi: () => import('./locales/fi.js'),
  fr: () => import('./locales/fr.json'),
  hu: () => import('./locales/hu.js'),
  it: () => import('./locales/it.js'),
  nl: () => import('./locales/nl.json'),
  no: () => import('./locales/no.js'),
  pl: () => import('./locales/pl.js'),
  pt: () => import('./locales/pt.json'),
  ro: () => import('./locales/ro.js'),
  sk: () => import('./locales/sk.js'),
  sv: () => import('./locales/sv.js'),
  uk: () => import('./locales/uk.js'),
}

const supportedLanguageCodes = supportedUILanguages.map(({ code }) => code)
const storedLanguage = typeof window === 'undefined'
  ? null
  : window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
const initialLanguage = supportedLanguageCodes.includes(storedLanguage) ? storedLanguage : 'en'
const englishResource = mergeLocale(
  en,
  adminEnglishTranslations,
  ownerEnglishRejectionTranslations,
  { legalPages: englishLegalPages },
  legalConsentEnglishTranslations,
  accountDeletionEnglishTranslations,
  conversationTerminalTranslations.en,
  adminDeletionTranslations.en,
  { locations: { areas: serviceAreaLabels } },
)
const loadedLocales = new Set(['en'])
const localeLoadPromises = new Map()
let languageChangeSequence = 0

void i18n.use(initReactI18next).init({
  resources: { en: { translation: englishResource } },
  lng: 'en',
  initImmediate: false,
  fallbackLng: 'en',
  supportedLngs: supportedLanguageCodes,
  interpolation: { escapeValue: false },
  returnNull: false,
})

export async function loadLocale(languageCode) {
  const code = supportedLanguageCodes.includes(languageCode) ? languageCode : 'en'
  if (loadedLocales.has(code)) return code
  if (localeLoadPromises.has(code)) return localeLoadPromises.get(code)

  const loadPromise = Promise.all([
    localeLoaders[code](),
    import('./locales/authenticatedTranslations.js'),
    import('./locales/fallbackLocaleCompletionTranslations.js'),
    import('./locales/legalConsentTranslations.js'),
    import('./locales/legalContent.js'),
    import('./locales/universalOperationalTranslations.js'),
    import('./adminTranslations.js'),
    import('./accountDeletionTranslations.js'),
  ]).then(([
    { default: baseLocale },
    { authenticatedTranslations },
    { fallbackLocaleCompletionTranslations },
    { legalConsentTranslations },
    { legalPageContent },
    { universalOperationalTranslations },
    { ownerRejectionTranslations },
    { accountDeletionTranslations },
  ]) => {
    const resource = mergeLocale(
      en,
      baseLocale,
      authenticatedTranslations[code],
      fallbackLocaleCompletionTranslations[code],
      legalConsentTranslations[code],
      universalOperationalTranslations[code],
      adminEnglishTranslations,
      ownerRejectionTranslations[code],
      accountDeletionTranslations[code],
      conversationTerminalTranslations[code],
      adminDeletionTranslations[code],
      { legalPages: legalPageContent[code] },
      { locations: { areas: serviceAreaLabels } },
    )
    i18n.addResourceBundle(code, 'translation', resource, true, true)
    loadedLocales.add(code)
    return code
  }).catch((error) => {
    localeLoadPromises.delete(code)
    throw error
  })

  localeLoadPromises.set(code, loadPromise)
  return loadPromise
}

export async function changeAppLanguage(languageCode) {
  const requestSequence = ++languageChangeSequence
  let code
  try {
    code = await loadLocale(languageCode)
  } catch {
    code = 'en'
  }
  if (requestSequence !== languageChangeSequence) {
    return i18n.resolvedLanguage?.split('-')[0] ?? 'en'
  }
  await i18n.changeLanguage(code)
  return code
}

export const i18nReady = initialLanguage === 'en'
  ? Promise.resolve()
  : changeAppLanguage(initialLanguage)

export default i18n
