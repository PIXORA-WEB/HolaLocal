import test from 'node:test'
import assert from 'node:assert/strict'
import {createReviewController,reviewPermission,reviewActions,reviewTextCount,validateCustomerReviewSubmission} from '../src/utils/customerReviewModel.js'
import {createCustomerReviewService,customerReviewCallables} from '../src/services/customerReviewService.js'
import {isCustomerReviewsEnabled} from '../src/utils/customerReviewsFlag.js'
import {customerReviewTranslations} from '../src/i18n/customerReviewTranslations.js'
import {supportedUILanguages} from '../src/utils/languages.js'
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
const service=patch=>({listPublic:async()=>({items:[],nextCursor:null}),getOwn:async()=>null,listOwn:async()=>({items:[],nextCursor:null}),...patch})
test('flag off never invokes a callable; only protected demo environment enables',async()=>{
  let calls=0;const api=createCustomerReviewService({enabled:false,invoke:()=>calls++})
  for(const name of Object.keys(customerReviewCallables))await assert.rejects(api[name]({}),/disabled/)
  assert.equal(calls,0);assert.equal(isCustomerReviewsEnabled({}),false)
  assert.equal(isCustomerReviewsEnabled({PROD:true,VITE_CUSTOMER_REVIEWS_ENABLED:'true'}),false)
  const env={MODE:'browser-test',VITE_CUSTOMER_REVIEWS_ENABLED:'true',VITE_BROWSER_TEST_RUNNER:'true',VITE_USE_FIREBASE_EMULATORS:'true',VITE_FIREBASE_PROJECT_ID:'demo-holalocal-functions',VITE_FIREBASE_AUTH_EMULATOR_URL:'http://127.0.0.1:9099',VITE_FIRESTORE_EMULATOR_URL:'http://127.0.0.1:8080',VITE_FUNCTIONS_EMULATOR_URL:'http://127.0.0.1:5001',VITE_STORAGE_EMULATOR_URL:'http://127.0.0.1:9199'}
  assert.equal(isCustomerReviewsEnabled(env),true)
  assert.throws(()=>isCustomerReviewsEnabled({...env,VITE_FIREBASE_PROJECT_ID:'holalocal-491c9'}))
})
test('uncertain mutation retry freezes request identity/payload; new operation allocates new ID',async()=>{
  const calls=[];let ids=0;let first=true
  const api=service({submit:async p=>{calls.push(p);if(first){first=false;throw new Error('network')}}})
  const c=createReviewController({api,businessId:'one',authenticated:true,requestId:()=>`id${++ids}`})
  await c.execute('submit',{rating:4,displayName:'Test reviewer',originalText:'Original accepted text.',expectedVersion:0})
  assert.equal(c.getSnapshot().uncertain,true)
  await c.execute('submit',{rating:1,displayName:'Test reviewer',originalText:'Must not replace uncertain text'})
  assert.deepEqual(calls[1],calls[0]);assert.equal(ids,1)
  await c.execute('submit',{rating:5,expectedVersion:2});assert.equal(ids,2)
})
test('account/business disposal ignores late public, own and mutation responses and clears private state',async()=>{
  const wait=deferred();const c=createReviewController({api:service({getOwn:()=>wait.promise}),businessId:'one',authenticated:true})
  const loading=c.load();await Promise.resolve();c.dispose();wait.resolve({private:'old-account'})
  await loading;assert.equal(c.getSnapshot().own,null)
  const second=deferred();const d=createReviewController({api:service({submit:()=>second.promise}),requestId:()=> 'id'})
  const mutation=d.execute('submit',{rating:4});d.dispose();second.resolve({});await mutation;assert.equal(d.getSnapshot().own,null)
})
test('pagination deduplicates IDs and restart pagination clears cursor; own reads use no caller UID',async()=>{
  const seen=[];let page=0
  const c=createReviewController({businessId:'b',authenticated:true,api:service({listPublic:async p=>{seen.push(p);page++;if(page===3)throw new Error('restart-pagination');return {items:[{publicReviewId:'same'}],nextCursor:'next'}},getOwn:async p=>{assert.deepEqual(p,{businessId:'b'});return null}})})
  await c.load();await c.load(true);assert.equal(c.getSnapshot().items.length,1)
  await c.load(true);assert.equal(c.getSnapshot().error,'refresh');assert.equal(c.getSnapshot().cursor,null)
  assert.equal(seen[1].cursor,'next')
})
test('state policies preserve pending edits, withdrawal access and shared Unicode validation',()=>{
  assert.equal(reviewActions({status:'pending',published:{}}).submit,false)
  assert.equal(reviewActions({status:'pending',published:{}}).withdraw,true)
  assert.equal(reviewActions({status:'removed'}).submit,false)
  assert.equal(reviewActions({status:'rejected',published:{}}).edit,true)
  assert.equal(reviewTextCount(' e\u0301😀 '),2)
  assert.equal(validateCustomerReviewSubmission({rating:1,displayName:'Test reviewer',originalText:'x'.repeat(20),declaredSourceLanguage:null}).valid,true)
  assert.equal(reviewPermission(null,{},'b'),'signIn')
  const user={uid:'u',emailVerified:true},profile={accountStatus:'active',roles:['customer'],businessId:'b'}
  assert.equal(reviewPermission(user,profile,'b'),'self');assert.equal(reviewPermission(user,profile,'b',true),null)
})
test('all 17 locale packs have identical nonempty review keys and placeholders',()=>{
  assert.equal(Object.keys(customerReviewTranslations).length,17)
  for(const language of supportedUILanguages){const code=language.code;const pack=customerReviewTranslations[code];assert.ok(pack,code);assert.deepEqual(Object.keys(pack),Object.keys(customerReviewTranslations.en));for(const [key,value]of Object.entries(pack)){assert.ok(value.trim());assert.deepEqual(value.match(/{{\w+}}/g),customerReviewTranslations.en[key].match(/{{\w+}}/g))}}
})



test('report duplicate/stale responses are definitive and do not retain an uncertain operation',async()=>{
  for(const [message,expected]of [['report-already-open','duplicate'],['review-refresh-required','refresh']]){
    const c=createReviewController({api:service({report:async()=>{throw new Error(message)}}),reloadAfter:false,requestId:()=> 'fixed'})
    await c.execute('report',{publicReviewId:'review',observedPublishedRevision:1,reasonCode:'spam'})
    assert.equal(c.getSnapshot().error,expected);assert.equal(c.getSnapshot().uncertain,false)
  }
})



test('review count uses locale plural rules and natural counters',async()=>{
  const {createInstance}=await import('i18next')
  const i18n=createInstance()
  await i18n.init({lng:'en',fallbackLng:false,resources:Object.fromEntries(Object.entries(customerReviewTranslations).map(([code,value])=>[code,{translation:{customerReviews:value}}]))})
  assert.equal(i18n.t('customerReviews.count',{count:1}),'1 review')
  assert.equal(i18n.t('customerReviews.count',{count:2}),'2 reviews')
  assert.equal(i18n.t('customerReviews.count',{lng:'es',count:2}),'2 reseñas')
  assert.equal(i18n.t('customerReviews.count',{lng:'pl',count:5}),'5 opinii')
  assert.equal(i18n.t('customerReviews.counter',{number:'58',maximum:'2,000'}),'58 / 2,000 characters')
})


test('confirmed feedback identifies the operation; uncertain retries retain their original operation',async()=>{
  for(const name of ['submit','edit','withdraw','report']){
    let fail=true;const payloads=[]
    const c=createReviewController({api:{[name]:async payload=>{payloads.push(payload);if(fail){fail=false;throw new Error('uncertain')}}},reloadAfter:false,requestId:()=> 'fixed'})
    await c.execute(name,{businessId:'b',publicReviewId:'r'})
    assert.equal(c.getSnapshot().feedback,'')
    assert.equal(c.getSnapshot().uncertain,true)
    await c.retry()
    assert.equal(c.getSnapshot().feedback,name)
    assert.equal(c.getSnapshot().feedbackTarget,'r')
    assert.deepEqual(payloads[0],payloads[1])
  }
})


test('success-only dismissal preserves authoritative status and all unresolved retry state',async()=>{
  const own={status:'withdrawn',version:4}
  let reject=false;const calls=[]
  const c=createReviewController({api:{withdraw:async p=>{calls.push(p);if(reject)throw new Error('uncertain')},listPublic:async()=>({items:[],nextCursor:null}),getOwn:async()=>own},authenticated:true,businessId:'b',requestId:()=>`request-${calls.length}`})
  await c.execute('withdraw',{publicReviewId:'r',expectedVersion:3})
  assert.equal(c.getSnapshot().feedback,'withdraw')
  const before=c.getSnapshot()
  c.clearSuccessFeedback()
  assert.deepEqual(c.getSnapshot(),{...before,feedback:'',feedbackTarget:undefined})
  assert.equal(c.getSnapshot().own.status,'withdrawn')
  reject=true
  await c.execute('withdraw',{publicReviewId:'r',expectedVersion:4})
  const uncertain=c.getSnapshot(),original=calls.at(-1)
  c.clearSuccessFeedback()
  assert.deepEqual(c.getSnapshot(),{...uncertain,feedback:'',feedbackTarget:undefined})
  assert.equal(c.getSnapshot().error,'failure')
  assert.equal(c.getSnapshot().uncertain,true)
  reject=false;await c.retry()
  assert.deepEqual(calls.at(-1),original)
})
