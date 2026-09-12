import test from 'node:test'
import assert from 'node:assert/strict'
import {legalPageContent} from '../src/i18n/locales/legalContent.js'
import {CURRENT_TERMS_VERSION,CURRENT_PRIVACY_VERSION,CURRENT_TERMS_EFFECTIVE_DATE,CURRENT_PRIVACY_EFFECTIVE_DATE} from '../../../shared/firebase-contract/legalConsent.js'

test('legal content has matching sections in all languages, no publication placeholders and explicit draft status',()=>{
 assert.equal(Object.keys(legalPageContent).length,17)
 for(const [code,content] of Object.entries(legalPageContent)) {
  assert.ok(content.revisionNotice,code)
  for(const kind of ['privacy','terms']) {
   const sections=content[kind].sections
   assert.deepEqual(sections.map(s=>s.key),legalPageContent.en[kind].sections.map(s=>s.key),code)
   assert.equal(new Set(sections.map(s=>s.key)).size,sections.length,code)
   assert.doesNotMatch(JSON.stringify(sections),/\[(INSERT|CONFIRM|DESCRIBE)|undefined|TODO/)
  }
  const retention=content.privacy.sections.find(s=>s.key==='cloud-retention').paragraphs.join(' ')
  for(const days of ['30','7','400'])assert.ok(retention.includes(days),code)
 }
 assert.equal(CURRENT_TERMS_VERSION,'1.1')
 assert.equal(CURRENT_PRIVACY_VERSION,'1.1')
})


test('consent recovery uses the same read-acknowledgment wording as registration in every language',async()=>{
 const {readFile}=await import('node:fs/promises')
 const {legalConsentEnglishTranslations}=await import('../src/i18n/legalConsentEnglishTranslations.js')
 const {legalConsentTranslations}=await import('../src/i18n/locales/legalConsentTranslations.js')
 const {fallbackLocaleCompletionTranslations}=await import('../src/i18n/locales/fallbackLocaleCompletionTranslations.js')
 const consent={en:legalConsentEnglishTranslations,...legalConsentTranslations}
 for(const code of Object.keys(legalPageContent)) {
  const registration=fallbackLocaleCompletionTranslations[code]?.auth.registration
   ??JSON.parse(await readFile(new URL(`../src/i18n/locales/${code}.json`,import.meta.url),'utf8')).auth.registration
  assert.equal(consent[code].legalConsent.privacyPrefix,registration.privacyPrefix,code)
 }
 assert.equal(consent.en.legalConsent.privacyPrefix,'I have read the')
 assert.match(consent.en.legalConsent.description,/accept the Terms and confirm that you have read the Privacy Policy/)
})


test('both legal pages identify the confirmed individual operator in all 17 languages',()=>{
 for(const [code,content] of Object.entries(legalPageContent))for(const kind of ['privacy','terms']){
  const contact=content[kind].sections.find(section=>section.key==='contact')
  assert.ok(contact.paragraphs.some(text=>text.includes('Craig Evans')),code+'/'+kind)
 }
})


test('approved account age is consistent and candidate policy dates are not fabricated', () => {
 for (const [code, content] of Object.entries(legalPageContent)) {
  const account = content.terms.sections.find(section => section.key === 'account')
  assert.match(account.paragraphs[0], /18/, code)
 }
 assert.equal(CURRENT_TERMS_VERSION, '1.1')
 assert.equal(CURRENT_PRIVACY_VERSION, '1.1')
 assert.equal(CURRENT_TERMS_EFFECTIVE_DATE,null)
 assert.equal(CURRENT_PRIVACY_EFFECTIVE_DATE,null)
})

test('informational policy notice is translated in all17language resources',async()=>{
 const {legalConsentEnglishTranslations}=await import('../src/i18n/legalConsentEnglishTranslations.js')
 const {legalConsentTranslations}=await import('../src/i18n/locales/legalConsentTranslations.js')
 const resources={en:legalConsentEnglishTranslations,...legalConsentTranslations}
 for(const code of Object.keys(legalPageContent))assert.ok(resources[code].legalConsent.updateNotice?.length>40,code)
})
