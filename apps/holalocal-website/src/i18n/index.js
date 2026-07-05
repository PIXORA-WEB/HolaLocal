import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { supportedUILanguages } from '../utils/languages.js'
import { serviceAreaLabels } from '../utils/locations.js'
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
const englishResource = mergeLocale(en, { locations: { areas: serviceAreaLabels } })
const loadedLocales = new Set(['en'])

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

  const [{ default: baseLocale }, { authenticatedTranslations }] = await Promise.all([
    localeLoaders[code](),
    import('./locales/authenticatedTranslations.js'),
  ])
  const resource = mergeLocale(
    en,
    baseLocale,
    authenticatedTranslations[code],
    { locations: { areas: serviceAreaLabels } },
  )
  i18n.addResourceBundle(code, 'translation', resource, true, true)
  loadedLocales.add(code)
  return code
}

export async function changeAppLanguage(languageCode) {
  const code = await loadLocale(languageCode)
  await i18n.changeLanguage(code)
  return code
}

export const i18nReady = initialLanguage === 'en'
  ? Promise.resolve()
  : changeAppLanguage(initialLanguage).catch(() => i18n.changeLanguage('en'))

export default i18n
