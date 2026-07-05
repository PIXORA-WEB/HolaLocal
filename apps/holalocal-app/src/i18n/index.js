import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { supportedUILanguages } from '../utils/languages.js'
import de from './locales/de.json'
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import nl from './locales/nl.json'
import pt from './locales/pt.json'

export const LANGUAGE_STORAGE_KEY = 'holalocal.uiLanguage'

const supportedLanguageCodes = supportedUILanguages.map(({ code }) => code)
const storedLanguage =
  typeof window === 'undefined' ? null : window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
const initialLanguage = supportedLanguageCodes.includes(storedLanguage) ? storedLanguage : 'en'

void i18n.use(initReactI18next).init({
  resources: {
    de: { translation: de },
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
    nl: { translation: nl },
    pt: { translation: pt },
  },
  lng: initialLanguage,
  initImmediate: false,
  fallbackLng: 'en',
  supportedLngs: supportedLanguageCodes,
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
})

export default i18n
