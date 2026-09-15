import test from 'node:test'
import assert from 'node:assert/strict'
import {legalPageContent,reviewAvailabilityTranslations} from '../src/i18n/locales/legalContent.js'
import {englishLegalPages} from '../src/i18n/englishLegalPages.js'
import {customerReviewTranslations} from '../src/i18n/customerReviewTranslations.js'
import {reviewDisclosureTranslations} from '../src/i18n/reviewDisclosureTranslations.js'
import {CURRENT_PRIVACY_VERSION, hasValidLegalConsent, hasCurrentLegalConsent} from '../../../shared/firebase-contract/legalConsent.js'
test('all 17 lazy legal locales and review forms have the shared disclosure without duplicated sections',()=>{
 assert.equal(Object.keys(legalPageContent).length,17)
 for(const [code,content] of Object.entries(legalPageContent)){
  const sections=content.privacy.sections.filter(s=>s.key==='reviews')
  assert.equal(sections.length,1,code)
  assert.deepEqual(sections[0].paragraphs,[reviewAvailabilityTranslations[code],...reviewDisclosureTranslations[code].slice(1,4)],code)
  assert.match(sections[0].paragraphs[2],/Google Cloud Translation/)
  assert.match(sections[0].paragraphs[2],/europe-west1/)
  assert.match(sections[0].paragraphs[3],/90/)
  assert.equal(customerReviewTranslations[code].translationNotice,reviewDisclosureTranslations[code][4])
  assert.ok(customerReviewTranslations[code].privacyLink)
 }
 assert.deepEqual(englishLegalPages.privacy.sections,legalPageContent.en.privacy.sections)
})
test('approved disclosure covers publication, embedded text, private content and scheduled cleanup without new consent requirement',()=>{
 const text=reviewDisclosureTranslations.en.join(' ')
 for(const expected of ['internal link','not automatically','proves a purchase','not sent as separate fields','Anything you include','Private or pending','Machine translations','90 days','request and audit copies','earlier','general deletion section'])assert.ok(text.includes(expected),expected)
 // Intentional current publication contract, not a legacy display-label assertion.
 assert.equal(CURRENT_PRIVACY_VERSION,'1.1')
 const timestamp={seconds:1,nanoseconds:0,toMillis:()=>1000}
 const historical={termsAccepted:true,termsAcceptedAt:timestamp,termsVersion:'1.0',privacyAccepted:true,privacyAcceptedAt:timestamp,privacyVersion:'1.0'}
 assert.equal(hasValidLegalConsent(historical),true)
 assert.equal(hasCurrentLegalConsent(historical),false)
 assert.equal(hasCurrentLegalConsent({...historical,termsVersion:'1.1',privacyVersion:'1.1'}),true)
})
