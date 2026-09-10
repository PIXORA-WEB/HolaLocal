import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {assertCallableBoundaryEnvironment} from '../scripts/runIsolatedEmulatorTests.mjs'
import {createCustomerReviewTranslationService} from '../src/customerReviewTranslation.js'
import {createCustomerReviewFirestoreDatabase} from '../src/customerReviewFirestore.js'
import {createCustomerReviewCommands} from '../src/customerReviewCommands.js'
import {readCustomerReviewFirestoreEligibility} from '../src/customerReviewFirestore.js'
import {customerReviewQuotaPolicy} from '../src/customerReviewQuotas.js'
import {fixtureData,helpers} from './customerReviewReadFixtures.mjs'
if(process.env.HOLALOCAL_CALLABLE_BOUNDARY!=='1')test('translation emulator gate',{skip:'Use protected review emulator suite'},()=>{})
else{
 assertCallableBoundaryEnvironment()
 const {initializeApp,deleteApp}=await import('firebase-admin/app');const {getFirestore}=await import('firebase-admin/firestore')
 const app=initializeApp({projectId:'demo-holalocal-functions'},'translation-'+randomUUID()),db=getFirestore(app)
 test.after(async()=>{await db.terminate();await deleteApp(app)})
 async function setup(){const f=fixtureData('translate-'+randomUUID()),review=f.review('published');const batch=db.batch();for(const [path,row] of f.data)batch.set(db.doc(path),row);await batch.commit();return {...f,...review,input:{publicReviewId:review.publicReviewId,publishedRevision:1,targetLanguage:'es'},ref:db.doc(`customerReviewsPublic/${review.publicReviewId}`)}}
 test('real Firestore leases/cache and anonymous callable17 targets with mock provider',async()=>{
  const s=await setup();await s.ref.update({declaredSourceLanguage:null})
  async function call(input){const response=await fetch('http://127.0.0.1:5001/demo-holalocal-functions/europe-west1/translatePublishedCustomerReview',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({data:input})});return {status:response.status,body:await response.json()}}
  for(const targetLanguage of 'en es fr de it pt nl sv no da fi pl cs sk hu ro uk'.split(' ')){const result=await call({...s.input,targetLanguage});assert.equal(result.status,200,JSON.stringify(result));assert.equal(result.body.result.status,'translated');assert.ok(result.body.result.translatedText.startsWith(`[${targetLanguage}]`))}
  const cached=(await s.ref.get()).data();assert.equal(Object.keys(cached.translationCache.entries).length,17);assert.equal(cached.reviewerAlias,'Test reviewer')
  assert.equal((await call({...s.input,originalText:'private supplied text'})).status,400)
  await db.doc(`businesses/${s.businessId}`).update({status:'suspended'});assert.equal((await call(s.input)).status,400)
  await s.ref.delete();assert.equal((await call(s.input)).status,400)
 })
 test('real transaction prevents duplicate provider requests and discarded result cannot recreate projection',async()=>{
  const s=await setup();let entered,release,calls=0;const ready=new Promise(r=>entered=r)
  const core=createCustomerReviewTranslationService({database:createCustomerReviewFirestoreDatabase(db),providerVersion:'lease-test-v1',configured:true,provider:{translateText:()=>{calls++;entered();return new Promise(r=>release=r)}}})
  const first=core.translate(s.input);await ready;assert.equal((await core.translate(s.input)).status,'pending');assert.equal(calls,1)
  await s.ref.delete();release({translatedText:'Private after deletion'});await assert.rejects(first,/review-refresh-required/);assert.equal((await s.ref.get()).exists,false)
 })
 test('cache replaced with new projection; pending text is never provider input',async()=>{
  const s=await setup();const inputs=[];const core=createCustomerReviewTranslationService({database:createCustomerReviewFirestoreDatabase(db),providerVersion:'edit-test-v1',configured:true,provider:{translateText:async input=>{inputs.push(input.text);return {translatedText:'Synthetic translated approved version'}}}})
  await db.doc(`customerReviewSlots/${s.pair}/revisions/2`).set({originalText:'Private pending draft'})
  await core.translate(s.input);const original=(await s.ref.get()).data();assert.ok(!inputs.includes('Private pending draft'))
  await db.doc(`users/${s.uid}`).set({accountStatus:'active',roles:['customer'],deletionRequestedAt:null})
  await db.doc(`customerReviewStats/${s.businessId}`).set({sum:4,count:1})
  // Remove the manually seeded draft; authoritative commands create their own revision.
  await db.doc(`customerReviewSlots/${s.pair}/revisions/2`).delete()
  const commands=createCustomerReviewCommands({helpers,database:createCustomerReviewFirestoreDatabase(db),readEligibility:readCustomerReviewFirestoreEligibility,quotaPolicy:customerReviewQuotaPolicy,
   auth:{resolveActor:async role=>role==='admin'?{uid:'synthetic-admin',admin:true}:{uid:s.uid,emailVerified:true},loadAuthorIdentity:async()=>({uid:s.uid,emailVerified:true})}})
  const edited=await commands.edit('author',{businessId:s.businessId,expectedVersion:s.slot.version,requestId:randomUUID(),rating:5,displayName:'New public name',originalText:'New approved synthetic content for translation.'})
  assert.deepEqual((await s.ref.get()).data().translationCache,original.translationCache)
  await core.translate(s.input);assert.equal(inputs.length,1)
  const approved=await commands.approve('admin',{publicReviewId:s.publicReviewId,expectedVersion:edited.version,requestId:randomUUID()})
  assert.equal((await s.ref.get()).data().translationCache,undefined)
  await assert.rejects(core.translate(s.input),/review-refresh-required/);await core.translate({...s.input,publishedRevision:2});assert.equal(inputs.length,2)
  await commands.withdraw('author',{publicReviewId:s.publicReviewId,expectedVersion:approved.version,requestId:randomUUID()});assert.equal((await s.ref.get()).exists,false)
 })
 test('client rules deny public-projection cache reads/writes even to an authenticated claimed admin',async()=>{
  const {initializeTestEnvironment,assertFails}=await import('../../apps/holalocal-website/node_modules/@firebase/rules-unit-testing/dist/esm/index.esm.js')
  const {doc,getDoc,setDoc}=await import('../../apps/holalocal-website/node_modules/firebase/firestore/dist/esm/index.esm.js')
  const environment=await initializeTestEnvironment({projectId:'demo-holalocal-functions',firestore:{host:'127.0.0.1',port:8080}})
  try{const s=await setup();for(const context of [environment.unauthenticatedContext(),environment.authenticatedContext('synthetic-admin',{admin:true})]){
   const ref=doc(context.firestore(),`customerReviewsPublic/${s.publicReviewId}`)
   await assertFails(getDoc(ref));await assertFails(setDoc(ref,{translationCache:{entries:{es:{translatedText:'forged'}}}},{merge:true}))
  }}finally{await environment.cleanup()}
 })

}
