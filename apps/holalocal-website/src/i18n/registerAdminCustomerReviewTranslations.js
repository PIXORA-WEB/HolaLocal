// Imported only by the lazy admin-review route; all locale variants remain available.
import i18n from 'i18next'
import {adminCustomerReviewTranslations} from './adminCustomerReviewTranslations.js'
for(const [code,copy] of Object.entries(adminCustomerReviewTranslations)){
  i18n.addResourceBundle(code,'translation',{adminCustomerReviews:copy},true,true)
}
