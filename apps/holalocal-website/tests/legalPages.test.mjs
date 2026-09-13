import test from 'node:test'
import assert from 'node:assert/strict'
import {legalPageContent} from '../src/i18n/locales/legalContent.js'
import {CURRENT_TERMS_VERSION,CURRENT_PRIVACY_VERSION,CURRENT_TERMS_EFFECTIVE_DATE,CURRENT_PRIVACY_EFFECTIVE_DATE} from '../../../shared/firebase-contract/legalConsent.js'

test('legal content has matching sections in all languages, no publication placeholders and a version label',()=>{
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
  assert.ok(contact.paragraphs.includes('Vista Hermosa, Santa Margarita, 11300 La Línea de la Concepción, Cádiz, Spain'),code+'/'+kind)
  assert.doesNotMatch(contact.paragraphs.join(' '),/operator-supplied|apartment number|unverified/i)
 }
})


test('approved account age is consistent and approved publication dates match', () => {
 for (const [code, content] of Object.entries(legalPageContent)) {
  const account = content.terms.sections.find(section => section.key === 'account')
  assert.match(account.paragraphs[0], /18/, code)
 }
 assert.equal(CURRENT_TERMS_VERSION, '1.1')
 assert.equal(CURRENT_PRIVACY_VERSION, '1.1')
 assert.equal(CURRENT_TERMS_EFFECTIVE_DATE,'2026-09-13')
 assert.equal(CURRENT_PRIVACY_EFFECTIVE_DATE,'2026-09-13')
})

test('automatic update notice is absent without changing required legal acknowledgment copy',async()=>{
 const {legalConsentEnglishTranslations}=await import('../src/i18n/legalConsentEnglishTranslations.js')
 const {legalConsentTranslations}=await import('../src/i18n/locales/legalConsentTranslations.js')
 const resources={en:legalConsentEnglishTranslations,...legalConsentTranslations}
 for(const code of Object.keys(legalPageContent)){assert.equal(resources[code].legalConsent.updateNotice,undefined,code);assert.ok(resources[code].legalConsent.termsPrefix,code);assert.ok(resources[code].legalConsent.privacyPrefix,code)}
 const {readFile}=await import('node:fs/promises')
 const layout=await readFile(new URL('../src/components/layout/SiteLayout.jsx',import.meta.url),'utf8')
 assert.doesNotMatch(layout,/showPolicyNotice|noticeDismissed|updateNotice|useAuthentication|localStorage|sessionStorage/)
 assert.match(layout,/<SiteHeader \/>/);assert.match(layout,/<Outlet \/>/);assert.match(layout,/<SiteFooter \/>/)
})


test('all legal locales disclose approved mailbox-only support retention without a permanent-deletion promise',()=>{
 for(const [code,content] of Object.entries(legalPageContent)){
  const paragraphs=content.privacy.sections.find(s=>s.key==='cloud-retention').paragraphs
  assert.equal(paragraphs.length,2,code)
  assert.match(paragraphs[1],/12/,code)
  assert.match(paragraphs[1],/hello@holalocal\.es/,code)
 }
 assert.match(legalPageContent.en.privacy.sections.find(s=>s.key==='cloud-retention').paragraphs[1],/does not necessarily remove recovery/)
})


test('approved retention criteria appear once in each locale with distinct automatic and manual controls',()=>{
 for(const [code,content]of Object.entries(legalPageContent)){
  const paragraphs=content.privacy.sections.find(section=>section.key==='deletion').paragraphs
  assert.equal(paragraphs.length,7,code)
  assert.equal(paragraphs.slice(-4).filter(text=>text.includes('90')).length,1,code)
  assert.ok(paragraphs.slice(-4).every(text=>text.length>80),code)
 }
 const copy=legalPageContent.en.privacy.sections.find(section=>section.key==='deletion').paragraphs.join(' ')
 assert.match(copy,/at least one participant retains an account/)
 assert.match(copy,/does not mean recent login/)
 assert.match(copy,/Manual conversation and acknowledgment cleanup and automatic account-deletion recovery remain disabled/)
 assert.match(copy,/responsible reviewer, next review date and ending condition/)
 assert.match(copy,/does not automatically end or renew/)
 assert.equal(CURRENT_PRIVACY_EFFECTIVE_DATE,'2026-09-13')
})

test('all locales distinguish service, interests, legal duties, consent and transfer safeguards',()=>{
 for(const [code,content] of Object.entries(legalPageContent)){
  const purpose=content.privacy.sections.find(s=>s.key==='purpose')
  const providers=content.privacy.sections.find(s=>s.key==='providers')
  assert.equal(purpose.paragraphs.length,1,code)
  assert.ok(purpose.paragraphs[0].includes('Analytics'),code)
  assert.equal(providers.paragraphs.length,2,code)
  assert.ok(providers.paragraphs[1].includes('<email>hello@holalocal.es</email>'),code)
 }
 const purpose=legalPageContent.en.privacy.sections.find(s=>s.key==='purpose').paragraphs[0]
 assert.match(purpose,/legitimate interests.*balanced against your rights/)
 assert.match(purpose,/may object/)
 assert.match(purpose,/legal obligations/)
 assert.match(purpose,/separate consent.*withdraw/)
 assert.match(legalPageContent.en.privacy.sections.find(s=>s.key==='providers').paragraphs[1],/standard contractual clauses where required/)
})


test('published review availability and independent cleanup controls are explicit',()=>{
 const content=legalPageContent.en
 assert.match(content.privacy.sections.find(s=>s.key==='reviews').paragraphs[0],/Only approved reviews are public.*translation is enabled/)
 assert.match(content.privacy.sections.find(s=>s.key==='deletion').paragraphs.at(-1),/Scheduled cleanup.*is enabled.*trusted resolution date.*preservation holds.*remain disabled/)
 for(const [code,row] of Object.entries(legalPageContent)){
  assert.equal(row.privacy.sections.find(s=>s.key==='reviews').paragraphs[0],row.terms.sections.find(s=>s.key==='reviews').paragraphs[0],code)
  assert.ok(row.privacy.sections.find(s=>s.key==='reviews').paragraphs[2].includes('europe-west1'),code)
 }
})
