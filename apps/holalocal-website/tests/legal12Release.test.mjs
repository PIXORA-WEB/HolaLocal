import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {legalPageContent} from '../src/i18n/locales/legalContent.js'
import {CURRENT_PRIVACY_VERSION,CURRENT_TERMS_VERSION,CURRENT_PRIVACY_EFFECTIVE_DATE,CURRENT_TERMS_EFFECTIVE_DATE,hasValidLegalConsent,hasCurrentLegalConsent} from '../../../shared/firebase-contract/legalConsent.js'
import {legalNoticeContract,NOTICE_INTRODUCTION,BUNDLED_LEGAL_PUBLICATION,registrationNoticeBaseline} from '../../../shared/firebase-contract/legalNotice.js'
import {buildRegistrationProfile} from '../../holalocal-app/src/services/userPayloads.js'
const locales='en es fr de nl pt pl ro cs sk hu uk it sv da fi no'.split(' ')
const stamp={seconds:1700000000,nanoseconds:0,toMillis:()=>1700000000000}
const profile=v=>({privacyVersion:v,termsVersion:v,privacyAccepted:true,termsAccepted:true,privacyAcceptedAt:stamp,termsAcceptedAt:stamp})
test('canonical1.2 metadata and trusted fixture agree; introduction remains1.1',()=>{
 assert.deepEqual([CURRENT_PRIVACY_VERSION,CURRENT_TERMS_VERSION,CURRENT_PRIVACY_EFFECTIVE_DATE,CURRENT_TERMS_EFFECTIVE_DATE],['1.2','1.2','2026-09-27','2026-09-27'])
 assert.deepEqual(NOTICE_INTRODUCTION,{privacy:'1.1',terms:'1.1'})
 assert.deepEqual(JSON.parse(readFileSync(new URL('../../../shared/firebase-contract/fixtures/legalPublications.current.json',import.meta.url))),BUNDLED_LEGAL_PUBLICATION)
})
for(const v of ['1.0','1.1'])test(`historical${v} access and notice leave all evidence intact`,()=>{
 const p=Object.freeze(profile(v));assert.equal(hasValidLegalConsent(p),true);assert.equal(hasCurrentLegalConsent(p),false)
 assert.deepEqual(legalNoticeContract.pending(p,BUNDLED_LEGAL_PUBLICATION),{privacy:true,terms:true})
 const patch=legalNoticeContract.acknowledgement(p,BUNDLED_LEGAL_PUBLICATION,{privacy:'1.2',terms:'1.2'})
 assert.deepEqual(patch,{privacyNoticeVersion:'1.2',termsNoticeVersion:'1.2'})
 assert.deepEqual(legalNoticeContract.pending({...p,...patch},BUNDLED_LEGAL_PUBLICATION),{privacy:false,terms:false});assert.equal(p.privacyVersion,v);assert.equal(p.privacyAcceptedAt,stamp)
})
test('current mobile registration derives1.2 with matching notice baseline',()=>{
 const p=buildRegistrationProfile('new',{...profile(CURRENT_PRIVACY_VERSION),email:'new@example.invalid'},()=>stamp)
 assert.deepEqual(registrationNoticeBaseline(p),{privacyNoticeVersion:'1.2',termsNoticeVersion:'1.2'})
 assert.equal(p.privacyNoticeVersion,'1.2');assert.equal(p.termsNoticeVersion,'1.2')
 assert.deepEqual(legalNoticeContract.pending(p,BUNDLED_LEGAL_PUBLICATION),{privacy:false,terms:false})
})
test('actual current registry is bounded and stale acknowledgements cannot pass',()=>{
 assert.equal(legalNoticeContract.publication({...BUNDLED_LEGAL_PUBLICATION,privacyVersion:'1.3'}),null)
 assert.throws(()=>legalNoticeContract.acknowledgement({},BUNDLED_LEGAL_PUBLICATION,{privacy:'1.1'}))
 assert.deepEqual(legalNoticeContract.acknowledgement({privacyNoticeVersion:'1.2'},BUNDLED_LEGAL_PUBLICATION,{privacy:'1.2'}),{})
})
for(const locale of locales)test(`${locale}: localized private translation disclosure, basis, provider and Terms`,()=>{
 const c=legalPageContent[locale];const section=(kind,key)=>c[kind].sections.find(s=>s.key===key)
 const privacy=section('privacy','messaging').paragraphs,terms=section('terms','messaging').paragraphs
 assert.equal(privacy.length,7);assert.equal(terms.length,5)
 assert.match(privacy[2],/Google Cloud Translation/);assert.match(privacy[3],/Google Cloud Translation.*europe-west1/)
 assert.match(section('privacy','purpose').paragraphs[1],/<email>hello@holalocal.es<\/email>/)
 assert.match(section('privacy','providers').paragraphs.at(-1),/Google Cloud Translation/)
 assert.equal(section('privacy','information').items.at(-1),privacy[4])
 if(locale!=='en')for(const p of [...privacy,...terms,section('privacy','purpose').paragraphs[1]])assert.ok(!JSON.stringify(legalPageContent.en).includes(JSON.stringify(p)),`${locale} English paragraph fallback`)
 const source=readFileSync(new URL(locale==='en'?'../src/i18n/englishLegalPages.js':`../src/i18n/locales/legal/legal-${locale}.js`,import.meta.url),'utf8')
 assert.ok(source.includes(privacy[0]));assert.equal(c.privacy.sections.filter(s=>s.key==='messaging').length,1)
})
test('English disclosures preserve opt-out distinction and qualified provider claims',()=>{
 const c=legalPageContent.en;const text=JSON.stringify(c)
 assert.doesNotMatch(text,/Private-message translation is currently disabled/)
 for(const pattern of [/enabled by default/,/not consent/,/request already sent cannot be withdrawn/,/without historical backfill/,/not automatically retranslate/,/not routinely manually translate or review/,/not used to train or improve/,/operational, security or billing/,/not the opt-out/,/not necessarily erase all conversation history immediately/])assert.match(text,pattern)
 assert.doesNotMatch(text,/never leave.*EU|original legally prevails/)
})
