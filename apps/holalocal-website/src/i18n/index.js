import { registrationHandoffEnglish } from './registrationHandoffEnglish.js'
import { analyticsEnglish } from './analyticsEnglish.js'
import {adminCustomerReviewNavigation} from './adminCustomerReviewNavigation.js'
import { customerReviewEnglishTranslations } from './customerReviewEnglishTranslations.js'
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
import { englishAuthenticatedResidual } from './englishAuthenticatedResidual.js'
import { businessTaxonomyEditorEnglishTranslations } from './businessTaxonomyEditorEnglishTranslations.js'
import { footerNavigationEnglishTranslations } from './footerNavigationEnglishTranslations.js'
import { homepagePlatformEnglishTranslations } from './homepagePlatformEnglishTranslations.js'
import { productLandingEnglishTranslations } from './productLandingEnglishTranslations.js'
import { productNavigationEnglishTranslations } from './productNavigationEnglishTranslations.js'
import { savedBusinessEnglishTranslations } from './savedBusinessEnglishTranslations.js'
import { serviceBrowseEnglishTranslations } from './serviceBrowseEnglishTranslations.js'
import { serviceTaxonomyEnglishTranslations } from './serviceTaxonomyEnglishTranslations.js'
import { subscriptionProductEnglishTranslations } from './subscriptionProductEnglishTranslations.js'
import en from './locales/en.json'
import {
  composeEnglishTranslationResource,
  composeLocaleTranslationResource,
} from './translationComposition.js'

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
const englishResource = composeEnglishTranslationResource({
  baseLocaleJson: en,
  productNavigationTranslations: productNavigationEnglishTranslations,
  footerNavigationTranslations: footerNavigationEnglishTranslations,
  subscriptionProductTranslations: subscriptionProductEnglishTranslations,
  savedBusinessTranslations: savedBusinessEnglishTranslations,
  englishAuthenticatedResidual,
  adminEnglishTranslations,
  ownerEnglishRejectionTranslations,
  englishLegalPages: { legalPages: englishLegalPages },
  legalConsentEnglishTranslations,
  accountDeletionEnglishTranslations,
  conversationTerminalTranslations: conversationTerminalTranslations.en,
  adminDeletionTranslations: adminDeletionTranslations.en,
  serviceTaxonomyTranslations: serviceTaxonomyEnglishTranslations,
  businessTaxonomyEditorTranslations: businessTaxonomyEditorEnglishTranslations,
  serviceBrowseTranslations: serviceBrowseEnglishTranslations,
  homepagePlatformTranslations: homepagePlatformEnglishTranslations,
  productLandingTranslations: productLandingEnglishTranslations,
  serviceAreaLabels: { locations: { areas: serviceAreaLabels } },
})
Object.assign(englishResource.auth.registration, registrationHandoffEnglish.registration)
Object.assign(englishResource.auth.verification, registrationHandoffEnglish.verification)
englishResource.analytics = analyticsEnglish
englishResource.adminCustomerReviews = {...adminCustomerReviewNavigation.en}
englishResource.customerReviews = customerReviewEnglishTranslations
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

const operationalLoaders = {
  sv: () => import('./locales/operational/operational-sv.js'),
  da: () => import('./locales/operational/operational-da.js'),
  fi: () => import('./locales/operational/operational-fi.js'),
  no: () => import('./locales/operational/operational-no.js'),
  uk: () => import('./locales/operational/operational-uk.js'),
  it: () => import('./locales/operational/operational-it.js'),
  cs: () => import('./locales/operational/operational-cs.js'),
  sk: () => import('./locales/operational/operational-sk.js'),
  hu: () => import('./locales/operational/operational-hu.js'),
  es: () => import('./locales/operational/operational-es.js'),
  pl: () => import('./locales/operational/operational-pl.js'),
  ro: () => import('./locales/operational/operational-ro.js'),
  fr: () => import('./locales/operational/operational-fr.js'),
  de: () => import('./locales/operational/operational-de.js'),
  nl: () => import('./locales/operational/operational-nl.js'),
  pt: () => import('./locales/operational/operational-pt.js'),
}

async function loadOperationalLocale(code) {
  const load = operationalLoaders[code]
  return load ? (await load()).default : undefined
}

const consentLoaders = {
  es: () => import('./locales/consent/consent-es.js'),
  fr: () => import('./locales/consent/consent-fr.js'),
  de: () => import('./locales/consent/consent-de.js'),
  nl: () => import('./locales/consent/consent-nl.js'),
  pt: () => import('./locales/consent/consent-pt.js'),
  pl: () => import('./locales/consent/consent-pl.js'),
  ro: () => import('./locales/consent/consent-ro.js'),
  cs: () => import('./locales/consent/consent-cs.js'),
  sk: () => import('./locales/consent/consent-sk.js'),
  hu: () => import('./locales/consent/consent-hu.js'),
  uk: () => import('./locales/consent/consent-uk.js'),
  it: () => import('./locales/consent/consent-it.js'),
  sv: () => import('./locales/consent/consent-sv.js'),
  da: () => import('./locales/consent/consent-da.js'),
  fi: () => import('./locales/consent/consent-fi.js'),
  no: () => import('./locales/consent/consent-no.js'),
}

async function loadConsentLocale(code) {
  const load = consentLoaders[code]
  return load ? (await load()).default : undefined
}

const legalLoaders = {
  en: () => import('./locales/legal/legal-en.js'),
  es: () => import('./locales/legal/legal-es.js'),
  fr: () => import('./locales/legal/legal-fr.js'),
  de: () => import('./locales/legal/legal-de.js'),
  nl: () => import('./locales/legal/legal-nl.js'),
  pt: () => import('./locales/legal/legal-pt.js'),
  pl: () => import('./locales/legal/legal-pl.js'),
  ro: () => import('./locales/legal/legal-ro.js'),
  cs: () => import('./locales/legal/legal-cs.js'),
  sk: () => import('./locales/legal/legal-sk.js'),
  hu: () => import('./locales/legal/legal-hu.js'),
  uk: () => import('./locales/legal/legal-uk.js'),
  it: () => import('./locales/legal/legal-it.js'),
  sv: () => import('./locales/legal/legal-sv.js'),
  da: () => import('./locales/legal/legal-da.js'),
  fi: () => import('./locales/legal/legal-fi.js'),
  no: () => import('./locales/legal/legal-no.js'),
}

const authenticatedLoaders = {
  en: () => import('./locales/authenticated/authenticated-en.js'),
  es: () => import('./locales/authenticated/authenticated-es.js'),
  fr: () => import('./locales/authenticated/authenticated-fr.js'),
  de: () => import('./locales/authenticated/authenticated-de.js'),
  nl: () => import('./locales/authenticated/authenticated-nl.js'),
  pt: () => import('./locales/authenticated/authenticated-pt.js'),
  pl: () => import('./locales/authenticated/authenticated-pl.js'),
  ro: () => import('./locales/authenticated/authenticated-ro.js'),
  it: () => import('./locales/authenticated/authenticated-it.js'),
  cs: () => import('./locales/authenticated/authenticated-cs.js'),
  sk: () => import('./locales/authenticated/authenticated-sk.js'),
  hu: () => import('./locales/authenticated/authenticated-hu.js'),
  uk: () => import('./locales/authenticated/authenticated-uk.js'),
  sv: () => import('./locales/authenticated/authenticated-sv.js'),
  da: () => import('./locales/authenticated/authenticated-da.js'),
  fi: () => import('./locales/authenticated/authenticated-fi.js'),
  no: () => import('./locales/authenticated/authenticated-no.js'),
}

const completionLoaders = {
  ro: () => import('./locales/completion/completion-ro.js'),
  pl: () => import('./locales/completion/completion-pl.js'),
  cs: () => import('./locales/completion/completion-cs.js'),
  sk: () => import('./locales/completion/completion-sk.js'),
  hu: () => import('./locales/completion/completion-hu.js'),
  uk: () => import('./locales/completion/completion-uk.js'),
  it: () => import('./locales/completion/completion-it.js'),
  fi: () => import('./locales/completion/completion-fi.js'),
  sv: () => import('./locales/completion/completion-sv.js'),
  da: () => import('./locales/completion/completion-da.js'),
  no: () => import('./locales/completion/completion-no.js'),
}

async function loadLocaleCompletion(code) {
  const load = completionLoaders[code]
  return load ? (await load()).default : undefined
}

export async function loadLocale(languageCode) {
  const code = supportedLanguageCodes.includes(languageCode) ? languageCode : 'en'
  if (loadedLocales.has(code)) return code
  if (localeLoadPromises.has(code)) return localeLoadPromises.get(code)

  const loadPromise = Promise.all([
    localeLoaders[code](),
    authenticatedLoaders[code](),
    loadLocaleCompletion(code),
    loadConsentLocale(code),
    legalLoaders[code](),
    loadOperationalLocale(code),
    import('./adminTranslations.js'),
    import('./accountDeletionTranslations.js'),
    import('./locales/nonEnglishTranslationPacks.js'),
    import('./locales/analyticsTranslations.js'),
    import('./customerReviewTranslations.js'),
    import('./locales/registrationHandoffTranslations.js'),
  ]).then(([
    { default: baseLocale },
    { default: authenticatedTranslations },
    fallbackLocaleCompletion,
    legalConsentTranslations,
    { default: legalPageContent },
    universalOperationalTranslations,
    { ownerRejectionTranslations },
    { accountDeletionTranslations },
    { getNonEnglishTranslationSlices },
    { analyticsTranslations },
    { customerReviewTranslations },
    { registrationHandoffTranslations },
  ]) => {
    const translationPacks = getNonEnglishTranslationSlices(code)
    const resource = composeLocaleTranslationResource({
      englishFallbackJson: en,
      baseLocale,
      productNavigationTranslations: translationPacks.productNavigationTranslations,
      footerNavigationTranslations: translationPacks.footerNavigationTranslations,
      subscriptionProductTranslations: translationPacks.subscriptionProductTranslations,
      savedBusinessTranslations: translationPacks.savedBusinessTranslations,
      authenticatedTranslations,
      fallbackLocaleCompletionTranslations: fallbackLocaleCompletion,
      legalConsentTranslations,
      universalOperationalTranslations,
      adminEnglishTranslations,
      ownerRejectionTranslations: ownerRejectionTranslations[code],
      accountDeletionTranslations: accountDeletionTranslations[code],
      conversationTerminalTranslations: conversationTerminalTranslations[code],
      adminDeletionTranslations: adminDeletionTranslations[code],
      serviceTaxonomyTranslations: translationPacks.serviceTaxonomyTranslations,
      businessTaxonomyEditorTranslations: translationPacks.businessTaxonomyEditorTranslations,
      serviceBrowseTranslations: translationPacks.serviceBrowseTranslations,
      homepagePlatformTranslations: translationPacks.homepagePlatformTranslations,
      productLandingTranslations: translationPacks.productLandingTranslations,
      legalPageContent: { legalPages: legalPageContent },
      serviceAreaLabels: { locations: { areas: serviceAreaLabels } },
    })
    Object.assign(resource.auth.registration, registrationHandoffTranslations[code].registration)
    Object.assign(resource.auth.verification, registrationHandoffTranslations[code].verification)
    resource.analytics = analyticsTranslations[code]
    resource.adminCustomerReviews = {...adminCustomerReviewNavigation[code]}
    resource.customerReviews = customerReviewTranslations[code]
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
