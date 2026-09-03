import { businessTaxonomyEditorTranslations } from './businessTaxonomyEditorTranslations.js'
import { footerNavigationTranslations } from './footerNavigationTranslations.js'
import { homepagePlatformTranslations } from './homepagePlatformTranslations.js'
import { productLandingTranslations } from './productLandingTranslations.js'
import { productNavigationTranslations } from './productNavigationTranslations.js'
import { savedBusinessTranslations } from './savedBusinessTranslations.js'
import { serviceBrowseTranslations } from './serviceBrowseTranslations.js'
import { serviceTaxonomyTranslations } from './serviceTaxonomyTranslations.js'
import { subscriptionProductTranslations } from './subscriptionProductTranslations.js'

export const NON_ENGLISH_TRANSLATION_PACK_LOCALES = Object.freeze([
  'es', 'fr', 'de', 'nl', 'pt', 'pl', 'ro', 'cs',
  'sk', 'hu', 'uk', 'it', 'sv', 'da', 'fi', 'no',
])

const supportedLocales = new Set(NON_ENGLISH_TRANSLATION_PACK_LOCALES)

export function getNonEnglishTranslationSlices(code) {
  if (!supportedLocales.has(code)) {
    throw new RangeError(`Unsupported non-English translation-pack locale: ${code}`)
  }

  return {
    productNavigationTranslations: productNavigationTranslations[code],
    footerNavigationTranslations: footerNavigationTranslations[code],
    subscriptionProductTranslations: subscriptionProductTranslations[code],
    savedBusinessTranslations: savedBusinessTranslations[code],
    serviceTaxonomyTranslations: serviceTaxonomyTranslations[code],
    businessTaxonomyEditorTranslations: businessTaxonomyEditorTranslations[code],
    serviceBrowseTranslations: serviceBrowseTranslations[code],
    homepagePlatformTranslations: homepagePlatformTranslations[code],
    productLandingTranslations: productLandingTranslations[code],
  }
}
