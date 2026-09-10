import { SUPPORTED_LANGUAGE_CODES } from './constants.js'
import { customerReviewAssert, isCustomerReviewId, isCustomerReviewLanguage } from './customerReviewContracts.js'

// Allowlist describes HolaLocal target languages, not current provider capabilities.
export function customerReviewTranslationCacheKey({ publicReviewId, publishedRevision, targetLanguage, providerVersion } = {}) {
  customerReviewAssert(isCustomerReviewId(publicReviewId) && publicReviewId.length >= 16, 'invalid-public-review-id')
  customerReviewAssert(Number.isSafeInteger(publishedRevision) && publishedRevision > 0, 'invalid-published-revision')
  customerReviewAssert(SUPPORTED_LANGUAGE_CODES.includes(targetLanguage), 'unsupported-target-language')
  customerReviewAssert(typeof providerVersion === 'string' && providerVersion.length >= 1 && providerVersion.length <= 128
    && /^[A-Za-z0-9._:/-]+$/.test(providerVersion), 'invalid-provider-version')
  return `customerReviewTranslation:v1:${encodeURIComponent(JSON.stringify([publicReviewId, publishedRevision, targetLanguage, providerVersion]))}`
}
export function customerReviewSourceLanguages({ declared = null, detected = null } = {}) {
  customerReviewAssert(isCustomerReviewLanguage(declared) && isCustomerReviewLanguage(detected), 'invalid-source-language')
  // Detection is separate metadata; it never changes the accepted revision's original text/declaration.
  return Object.freeze({ declared, detected })
}
