import test from 'node:test'
import assert from 'node:assert/strict'
import {createCustomerReviewTranslationService} from '../src/customerReviewTranslation.js'
import {createGoogleCloudTranslator} from '../src/providers/googleCloudTranslator.js'
import {CustomerReviewFakeDatabase} from './customerReviewFakeDatabase.mjs'
import {fixtureData} from './customerReviewReadFixtures.mjs'
const languages='en es fr de it pt nl sv no da fi pl cs sk hu ro uk'.split(' ')
function setup(provider){
 const f=fixtureData('translation'),review=f.review('public'),database=new CustomerReviewFakeDatabase();database.data=f.data
 const path=`customerReviewsPublic/${review.publicReviewId}`;database.data.get(path).declaredSourceLanguage=null
 const calls=[];let now=1000
 const service=createCustomerReviewTranslationService({database,provider:provider??{translateText:async value=>{calls.push(value);return {translatedText:`${value.targetLanguage}: synthetic translated text`}}},providerVersion:'test-v1',configured:true,clock:()=>now})
 return {...f,...review,database,path,calls,service,input:{publicReviewId:review.publicReviewId,publishedRevision:1,targetLanguage:'es'},advance:()=>{now+=61000}}
}
test('all17 targets reuse bounded revision/provider cache; originals and names unchanged',async()=>{
 const s=setup();const before=structuredClone(s.database.data.get(s.path))
 for(const targetLanguage of languages){const input={...s.input,targetLanguage};assert.equal((await s.service.translate(input)).status,'translated');await s.service.translate(input)}
 assert.equal(s.calls.length,17);assert.equal(Object.keys(s.database.data.get(s.path).translationCache.entries).length,17)
 assert.equal(s.database.data.get(s.path).originalText,before.originalText);assert.equal(s.database.data.get(s.path).reviewerAlias,before.reviewerAlias)
 for(const call of s.calls){assert.deepEqual(Object.keys(call).sort(),['sourceLanguageHint','targetLanguage','text']);assert.equal(call.text,before.originalText)}
})
test('exact payload rejects supplied text, private revision and unsupported targets before provider',async()=>{
 const s=setup()
 for(const input of [{...s.input,text:'private'}, {...s.input,targetLanguage:'xx'},{...s.input,publishedRevision:2},{...s.input,publicReviewId:'../secret'}])await assert.rejects(s.service.translate(input))
 for(const status of ['pending','rejected','withdrawn','removed']){const f=fixtureData('private-'+status),r=f.review('x',status);s.database.data=f.data;await assert.rejects(s.service.translate({...s.input,publicReviewId:r.publicReviewId}))}
 assert.equal(s.calls.length,0)
})
test('cache reads recheck hidden/deleted businesses, deletion and revision; no stale resurrection',async()=>{
 const s=setup();await s.service.translate(s.input);s.database.data.get(`businesses/${s.businessId}`).status='suspended';await assert.rejects(s.service.translate(s.input),/business-unavailable/)
 s.database.data.get(`businesses/${s.businessId}`).status='active';s.database.data.get(s.path).publishedRevision=2;await assert.rejects(s.service.translate(s.input),/review-refresh-required/)
 await s.service.translate({...s.input,publishedRevision:2});assert.equal(s.calls.length,2)
 s.database.data.delete(s.path);await assert.rejects(s.service.translate({...s.input,publishedRevision:2}));assert.equal(s.database.data.has(s.path),false)
})
test('in-flight publication change/removal suppresses result; lease deduplicates overlapping requests',async()=>{
 let release,entered;const ready=new Promise(r=>entered=r)
 const s=setup({translateText:()=>{entered();return new Promise(r=>release=r)}})
 const pending=s.service.translate(s.input);await ready
 assert.equal((await s.service.translate(s.input)).status,'pending')
 s.database.data.delete(s.path);release({translatedText:'must not escape'});await assert.rejects(pending,/review-refresh-required/);assert.equal(s.database.data.has(s.path),false)
})
test('real adapter error mapping with injected SDK failures; transient failures retry, no error text leaks',async()=>{
 for(const code of [4,8,14,7,16,3]){
  const adapter=createGoogleCloudTranslator({projectId:'synthetic-provider-test',requestTimeoutMs:10000,client:{translateText:async(_request,options)=>{assert.deepEqual(options,{timeout:10000,retry:null});throw Object.assign(new Error('private provider diagnostics'),{code})}}})
  const s=setup(adapter);assert.equal((await s.service.translate(s.input)).status,'unavailable');assert.ok(!JSON.stringify(s.database.data.get(s.path)).includes('private provider diagnostics'));assert.equal((await s.service.translate(s.input)).status,'unavailable');s.advance();assert.equal((await s.service.translate(s.input)).status,'unavailable')
 }
})
test('disabled provider and same-language original require no provider/cache writes; malformed output unavailable',async()=>{
 const s=setup();const disabled=createCustomerReviewTranslationService({database:s.database,providerVersion:'disabled-v1',provider:{translateText:()=>assert.fail()}})
 assert.equal((await disabled.translate(s.input)).status,'unavailable');assert.equal(s.database.data.get(s.path).translationCache,undefined)
 s.database.data.get(s.path).declaredSourceLanguage='es';assert.equal((await s.service.translate(s.input)).status,'original');assert.equal(s.calls.length,0)
 const malformed=setup({translateText:async()=>({translatedText:''})});assert.equal((await malformed.service.translate(malformed.input)).status,'unavailable')
})
test('transient failure recovers after cooldown; provider version change never returns old cached translation',async()=>{
 let calls=0
 const s=setup({translateText:async()=>{calls++;if(calls===1)throw Object.assign(new Error('unavailable'),{code:14});return {translatedText:'Recovered translation'}}})
 assert.equal((await s.service.translate(s.input)).status,'unavailable');assert.equal((await s.service.translate(s.input)).status,'unavailable');assert.equal(calls,1)
 s.advance();assert.equal((await s.service.translate(s.input)).translatedText,'Recovered translation');assert.equal(calls,2)
 const updated=createCustomerReviewTranslationService({database:s.database,providerVersion:'test-v2',configured:true,provider:{translateText:async()=>({translatedText:'New provider version translation'})}})
 assert.equal((await updated.translate(s.input)).translatedText,'New provider version translation');assert.equal(s.database.data.get(s.path).translationCache.providerVersion,'test-v2')
})
