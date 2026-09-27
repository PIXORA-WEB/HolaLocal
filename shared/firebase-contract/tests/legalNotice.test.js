import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BUNDLED_LEGAL_PUBLICATION as bundled, legalNoticeContract as live, createLegalNoticeContract, registrationNoticeBaseline } from '../legalNotice.js'
import { toWebsiteUserProfile, toPublicBusinessView } from '../../../apps/holalocal-website/src/services/firebaseCompatibility.js'
import { toMobileUserProfile } from '../../../apps/holalocal-app/src/services/userCompatibility.js'
import { buildRegistrationProfile } from '../../../apps/holalocal-app/src/services/userPayloads.js'
import { noticeLocales } from '../../legal-notice/locales.js'
const introduction = {...bundled, privacyVersion:'1.1',termsVersion:'1.1',privacyEffectiveDate:'2026-09-13',termsEffectiveDate:'2026-09-13'}
const historical = createLegalNoticeContract({privacy:['1.0','1.1'],terms:['1.0','1.1']},introduction)
const future = createLegalNoticeContract({ privacy: ['1.0','1.1','1.2','1.3'], terms: ['1.0','1.1','1.2','1.3'] },introduction)
const publication = (privacy='1.1',terms='1.1') => ({ ...introduction, privacyVersion:privacy,termsVersion:terms })
for (const profile of [{},{privacyVersion:'1.0',termsVersion:'1.0'},{privacyNoticeVersion:'1.1',termsNoticeVersion:'1.1'}]) {
 test('introduction preserves no-notice behavior '+JSON.stringify(profile),()=>assert.deepEqual(historical.pending(profile,introduction),{privacy:false,terms:false}))
}
for (const [p,t,expected] of [['1.2','1.1',{privacy:true,terms:false}],['1.1','1.2',{privacy:false,terms:true}],['1.2','1.2',{privacy:true,terms:true}],['1.3','1.2',{privacy:true,terms:false}]]) {
 test('bounded synthetic update '+p+'/'+t,()=>assert.deepEqual(future.pending({privacyNoticeVersion:'1.1',termsNoticeVersion:t==='1.2'&&p==='1.3'?'1.2':'1.1'},publication(p,t)),expected))
}
test('independent acknowledged versions suppress corresponding document only',()=>{
 assert.deepEqual(future.pending({privacyNoticeVersion:'1.2'},publication('1.2','1.2')),{privacy:false,terms:true})
 assert.deepEqual(future.pending({termsNoticeVersion:'1.2'},publication('1.2','1.2')),{privacy:true,terms:false})
})
for(const invalid of [null,{},publication('99'),publication('1.0'),{...bundled,privacyEffectiveDate:'2026-02-30'},{...bundled,termsEffectiveDate:'2027-01-01'},{...bundled,extra:true},publication('1.2')]) {
 test('invalid/unsupported/old registry fails safe '+JSON.stringify(invalid),()=>assert.equal(live.pending({},invalid),null))
}
test('missing profile differs from legacy profile',()=>assert.equal(live.pending(null,bundled),null))
for(const bad of [null,12,'99',{},'1.0']) test('malformed notice does not suppress future '+JSON.stringify(bad),()=>assert.equal(future.pending({privacyNoticeVersion:bad},publication('1.2')).privacy,true))
for (const displayed of [{privacy:'1.2'},{terms:'1.2'},{privacy:'1.2',terms:'1.2'}]) test('acknowledgement changes only displayed fields '+JSON.stringify(displayed),()=>{
 const profile={privacyVersion:'1.0',privacyAcceptedAt:123,termsVersion:'1.0',termsAcceptedAt:456,city:'Madrid'}
 assert.deepEqual(future.acknowledgement(profile,publication('1.2','1.2'),displayed),Object.fromEntries(Object.entries(displayed).map(([k,v])=>[k+'NoticeVersion',v])))
 assert.equal(profile.privacyAcceptedAt,123);assert.equal(profile.termsAcceptedAt,456)
})
test('stale dialog cannot acknowledge unseen publication',()=>assert.throws(()=>future.acknowledgement({},publication('1.3'),{privacy:'1.2'})))
test('no arbitrary acknowledgement keys',()=>assert.throws(()=>live.acknowledgement({},bundled,{privacyVersion:'1.1'})))
test('registration baseline independent of repair/current accept history',()=>{
 assert.deepEqual(registrationNoticeBaseline({}),{})
 assert.deepEqual(registrationNoticeBaseline({privacyAccepted:true,termsAccepted:true,privacyVersion:'1.0',termsVersion:'1.0'}),{})
 const p=buildRegistrationProfile('u',{privacyAccepted:true,termsAccepted:true,privacyVersion:bundled.privacyVersion,termsVersion:bundled.termsVersion},()=>123)
 assert.equal(p.privacyNoticeVersion,bundled.privacyVersion);assert.equal(p.termsNoticeVersion,bundled.termsVersion)
})
test('private projections preserve notice values',()=>{
 for(const project of [toWebsiteUserProfile,toMobileUserProfile]) {
  const p=project('u',{privacyNoticeVersion:'1.1',termsNoticeVersion:'1.0'})
  assert.equal(p.privacyNoticeVersion,'1.1');assert.equal(p.termsNoticeVersion,'1.0')
 }
})
test('initial registry matches canonical current publication',()=>assert.deepEqual(JSON.parse(readFileSync(new URL('../fixtures/legalPublications.current.json',import.meta.url))),bundled))
for(const [lang,copy] of Object.entries(noticeLocales)) test('complete notice copy '+lang,()=>{
 assert.deepEqual(Object.keys(copy),Object.keys(noticeLocales.en))
 for(const [key,value] of Object.entries(copy)) {assert.ok(value.trim());if(lang!=='en')assert.notEqual(value,noticeLocales.en[key])}
})
test('all 17 website and all 6 actual mobile locales covered',()=>{
 assert.deepEqual(Object.keys(noticeLocales).sort(),'en es fr de nl pt pl ro cs sk hu uk it sv da fi no'.split(' ').sort())
 const mobile=readFileSync(new URL('../../../apps/holalocal-app/src/i18n/index.js',import.meta.url),'utf8')
 for(const lang of ['en','es','fr','de','nl','pt']) {assert.ok(noticeLocales[lang]);assert.match(mobile,new RegExp("import "+lang+" from"))}
})

test('public business projection excludes private notice state',()=>{
 const value=toPublicBusinessView('b',{name:'Example',ownerId:'u',managerIds:['u'],description:'Example',primaryCategoryId:'cleaning',categoryIds:['cleaning'],serviceAreas:['marbella'],languages:['en'],primaryLanguage:'en',location:{locality:'Marbella',region:'Malaga',countryCode:'ES'},publishedAt:123,status:'active',privacyNoticeVersion:'1.1',termsNoticeVersion:'1.1'})
 assert.ok(value);assert.equal(Object.hasOwn(value,'privacyNoticeVersion'),false);assert.equal(Object.hasOwn(value,'termsNoticeVersion'),false)
})

for (const kind of ['privacy','terms']) {
 test(kind+' recognized newer acknowledgement never regresses and is not due',()=>{
  const profile={[kind+'NoticeVersion']:'1.3'}
  const registry={...bundled,[kind+'Version']:'1.2'}
  assert.deepEqual(future.acknowledgement(profile,registry,{[kind]:'1.2'}),{})
  assert.equal(future.pending(profile,registry)[kind],false)
 })
 test(kind+' forward/equal/absent acknowledgement preserved',()=>{
  const registry={...bundled,[kind+'Version']:'1.3'}
  for(const stored of [undefined,'1.1','1.2',null,42,'unknown'])
   assert.deepEqual(future.acknowledgement({[kind+'NoticeVersion']:stored},registry,{[kind]:'1.3'}),{[kind+'NoticeVersion']:'1.3'})
  assert.deepEqual(future.acknowledgement({[kind+'NoticeVersion']:'1.3'},registry,{[kind]:'1.3'}),{})
 })
}
for(const [privacy,terms,expected] of [['1.3','1.1',{termsNoticeVersion:'1.2'}],['1.1','1.3',{privacyNoticeVersion:'1.2'}],['1.3','1.3',{}]])
 test('combined independent non-regression '+privacy+'/'+terms,()=>assert.deepEqual(future.acknowledgement({privacyNoticeVersion:privacy,termsNoticeVersion:terms},publication('1.2','1.2'),{privacy:'1.2',terms:'1.2'}),expected))
test('Rules independent bounded notice ranks match shared supported ordering',()=>{
 const rules=readFileSync(new URL('../../../firestore.rules',import.meta.url),'utf8')
 for(const kind of ['privacy','terms']) {
  const values=[...rules.match(new RegExp('let '+kind+'Order = \{([^}]+)\}'))[1].matchAll(/'([^']+)': (\d+)/g)].map(m=>[m[1],Number(m[2])])
  assert.deepEqual(values,[['1.0',0],['1.1',1],['1.2',2]])
 }
})
