import test from 'node:test'
import assert from 'node:assert/strict'
import i18n from 'i18next'
import {adminCustomerReviewNavigation} from '../src/i18n/adminCustomerReviewNavigation.js'
import {adminCustomerReviewTranslations} from '../src/i18n/adminCustomerReviewTranslations.js'
test('lazy admin registration retains all 17 locales and survives later navigation-resource merging',async()=>{
 await i18n.init({lng:'en',fallbackLng:false,resources:{en:{translation:{adminCustomerReviews:{...adminCustomerReviewNavigation.en}}}}})
 assert.equal(i18n.exists('adminCustomerReviews.authorReason'),false)
 await import('../src/i18n/registerAdminCustomerReviewTranslations.js')
 assert.equal(Object.keys(adminCustomerReviewNavigation).length,17)
 for(const [code,copy] of Object.entries(adminCustomerReviewTranslations)){
  assert.deepEqual(Object.keys(adminCustomerReviewNavigation[code]).sort(),['reports','title'])
  assert.equal(adminCustomerReviewNavigation[code].title,copy.title)
  i18n.addResourceBundle(code,'translation',{adminCustomerReviews:{...adminCustomerReviewNavigation[code]}},true,true)
  assert.equal(i18n.t('adminCustomerReviews.authorReason',{lng:code}),copy.authorReason)
  assert.equal(i18n.t('adminCustomerReviews.success_reject',{lng:code}),copy.success_reject)
 }
})

test('all admin locales have business context and no obsolete rejection-unavailable copy',()=>{
 const expected=Object.keys(adminCustomerReviewTranslations.en).sort()
 for(const [code,copy] of Object.entries(adminCustomerReviewTranslations)){
  assert.deepEqual(Object.keys(copy).sort(),expected,code)
  for(const [key,value] of Object.entries(copy))assert.ok(typeof value==='string'&&value.trim()&&!value.includes('|'),`${code}.${key}`)
  assert.ok(copy.businessName)
  assert.equal(Object.hasOwn(copy,'rejectGap'),false)
 }
})
