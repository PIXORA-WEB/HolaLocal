import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { supportedUILanguages } from '../utils/languages.js'
import de from './locales/de.json'
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import nl from './locales/nl.json'
import pt from './locales/pt.json'
import { serviceTaxonomyTranslations } from './serviceTaxonomyTranslations.js'
import { businessTaxonomyEditorTranslations } from './businessTaxonomyEditorTranslations.js'

export const LANGUAGE_STORAGE_KEY = 'holalocal.uiLanguage'

const supportedLanguageCodes = supportedUILanguages.map(({ code }) => code)
const storedLanguage =
  typeof window === 'undefined' ? null : window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
const initialLanguage = supportedLanguageCodes.includes(storedLanguage) ? storedLanguage : 'en'
const withServiceTaxonomy = (resource, taxonomyResource, editorResource) => ({
  ...resource,
  business: { ...resource.business, ...editorResource.business },
  services: { ...resource.services, ...taxonomyResource.services },
})

void i18n.use(initReactI18next).init({
  resources: {
    de: { translation: withServiceTaxonomy(de, serviceTaxonomyTranslations.de, businessTaxonomyEditorTranslations.de) },
    en: { translation: withServiceTaxonomy(en, serviceTaxonomyTranslations.en, businessTaxonomyEditorTranslations.en) },
    es: { translation: withServiceTaxonomy(es, serviceTaxonomyTranslations.es, businessTaxonomyEditorTranslations.es) },
    fr: { translation: withServiceTaxonomy(fr, serviceTaxonomyTranslations.fr, businessTaxonomyEditorTranslations.fr) },
    nl: { translation: withServiceTaxonomy(nl, serviceTaxonomyTranslations.nl, businessTaxonomyEditorTranslations.nl) },
    pt: { translation: withServiceTaxonomy(pt, serviceTaxonomyTranslations.pt, businessTaxonomyEditorTranslations.pt) },
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
