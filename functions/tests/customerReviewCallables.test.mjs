import test from 'node:test'
import assert from 'node:assert/strict'
import { customerReviewGate, createCustomerReviewCallableHandler, safeCustomerReviewError, CUSTOMER_REVIEW_CALLABLES } from '../src/customerReviewCallables.js'
export const demoReviewEnv = {CUSTOMER_REVIEWS_ENABLED:'true',GCLOUD_PROJECT:'demo-holalocal-functions',GOOGLE_CLOUD_PROJECT:'demo-holalocal-functions',
  FIREBASE_CONFIG:JSON.stringify({projectId:'demo-holalocal-functions'}),HOLALOCAL_CALLABLE_BOUNDARY:'1',FUNCTIONS_EMULATOR:'true',
  FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099'}

test('every callable defaults disabled before service construction, even with client enable flags',async()=>{
  for(const name of Object.keys(CUSTOMER_REVIEW_CALLABLES)) {
    const handler=createCustomerReviewCallableHandler(name,{env:{},createServices:()=>{throw new Error('must not construct')}})
    await assert.rejects(handler({data:{CUSTOMER_REVIEWS_ENABLED:'true',admin:true}}),error=>error.code==='failed-precondition'&&error.message==='customer-reviews-disabled')
  }
})
test('synthetic policies cannot activate in production or incomplete emulator environments',()=>{
  assert.equal(customerReviewGate(demoReviewEnv).aliasPolicy,undefined)
  for(const change of [{GCLOUD_PROJECT:'holalocal-491c9'},{GOOGLE_CLOUD_PROJECT:'holalocal-491c9'},
    {FUNCTIONS_EMULATOR:'false'},{HOLALOCAL_CALLABLE_BOUNDARY:'0'},{FIRESTORE_EMULATOR_HOST:'external:8080'},
    {GOOGLE_APPLICATION_CREDENTIALS:'synthetic-do-not-read'},{FIREBASE_CONFIG:'{}'}]) {
    assert.throws(()=>customerReviewGate({...demoReviewEnv,...change}),/production-policies-unavailable/)
  }
})
test('private operations require verified framework identity and raw token; public accepts anonymous',async()=>{
  const events=[]
  const createServices=()=>({command:{submit:async(...args)=>{events.push(args);return {status:'pending'}}},
    read:{listPublic:async payload=>({items:[],payload})}})
  const submit=createCustomerReviewCallableHandler('submitCustomerReview',{env:demoReviewEnv,createServices})
  await assert.rejects(submit({data:{uid:'forged'}}),error=>error.code==='unauthenticated')
  const payload={businessId:'fictional'}
  await submit({auth:{uid:'trusted'},rawRequest:{headers:{authorization:'Bearer synthetic-token'}},data:payload})
  assert.deepEqual(events,[['synthetic-token',payload]])
  const list=createCustomerReviewCallableHandler('listPublishedCustomerReviews',{env:demoReviewEnv,createServices})
  assert.deepEqual(await list({data:payload}),{items:[],payload})
})
test('errors use an explicit safe allowlist, never raw internal details',()=>{
  for(const error of [new Error('email secret@example.invalid'),{code:'internal',message:'private record'},
    {code:9,message:'index diagnostic link'},{code:'invalid-review-timestamp',details:{private:'value'}}]) {
    const safe=safeCustomerReviewError(error)
    assert.equal(safe.code,'internal');assert.equal(safe.message,'customer-review-unavailable');assert.equal(safe.details,undefined)
  }
  assert.equal(safeCustomerReviewError({code:'review-version-conflict'}).code,'aborted')
  assert.equal(safeCustomerReviewError({code:'request-id-conflict'}).code,'already-exists')
  assert.equal(safeCustomerReviewError({code:'auth/id-token-revoked'}).message,'authentication-required')
})


test('authoritative summary callable is anonymous, bounded by read service, and gated independently',async()=>{
  const payload={businessIds:['synthetic-business']};let seen
  const handler=createCustomerReviewCallableHandler('getCustomerReviewRatingSummaries',{env:demoReviewEnv,
    createServices:()=>({read:{readRatingSummaries:async input=>{seen=input;return [{businessId:input.businessIds[0],available:true,average:null,count:0}]}}})})
  assert.deepEqual(await handler({data:payload}),[{businessId:'synthetic-business',available:true,average:null,count:0}])
  assert.deepEqual(seen,payload)
})

test('public translation uses the same closed gate and ignores forged caller identity',async()=>{
 const payload={publicReviewId:'synthetic-public-review',publishedRevision:1,targetLanguage:'es'}
 const handler=createCustomerReviewCallableHandler('translatePublishedCustomerReview',{env:demoReviewEnv,createServices:()=>({translation:{translate:async input=>input}})})
 assert.deepEqual(await handler({data:payload}),payload)
})


test('production opt-in is default-off, exact-project and incompatible with emulator configuration',async()=>{
 const production={GCLOUD_PROJECT:'holalocal-491c9',FIREBASE_CONFIG:JSON.stringify({projectId:'holalocal-491c9'})}
 assert.throws(()=>customerReviewGate(production),/customer-reviews-disabled/)
 const enabled={...production,CUSTOMER_REVIEWS_ENABLED:'true'}
 assert.equal(customerReviewGate(enabled).quotaPolicy,customerReviewGate(demoReviewEnv).quotaPolicy)
 for(const change of [{GCLOUD_PROJECT:'other-project'},{FIREBASE_CONFIG:'{}'},{GOOGLE_CLOUD_PROJECT:'other-project'},{FUNCTIONS_EMULATOR:'true'},{FIRESTORE_EMULATOR_HOST:'localhost:8080'},{HOLALOCAL_CALLABLE_BOUNDARY:'1'}])assert.throws(()=>customerReviewGate({...enabled,...change}))
 const submit=createCustomerReviewCallableHandler('submitCustomerReview',{env:enabled,createServices:()=>{throw new Error('must not construct without auth')}})
 await assert.rejects(submit({data:{uid:'forged'}}),error=>error.code==='unauthenticated')
})
