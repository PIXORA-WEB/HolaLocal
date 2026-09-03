export const ENGLISH_ONLY_ADMIN_PLURAL_KEY = 'admin.review.imageCount'
export const ENGLISH_ADMIN_SOURCE_NAME = 'adminEnglishTranslations'
export const ENGLISH_ONLY_ADMIN_PLURAL_LOCALES = Object.freeze([
  'pl', 'ro', 'cs', 'sk', 'uk',
])

// The admin review interface is intentionally English-only. Only this exact
// key/source/locale combination may use English plural-category fallback.
export function isApprovedEnglishAdminPluralFallback({ key, locale, sourceName }) {
  return key === ENGLISH_ONLY_ADMIN_PLURAL_KEY
    && sourceName === ENGLISH_ADMIN_SOURCE_NAME
    && ENGLISH_ONLY_ADMIN_PLURAL_LOCALES.includes(locale)
}
