import test from 'node:test'
import {Timestamp} from 'firebase-admin/firestore'
import assert from 'node:assert/strict'
import {assertSeedEnvironment,confirmEmulators,seedFixtures,fixtureDocuments,accounts,businessId} from '../scripts/seedCustomerReviewDemo.mjs'
import {isPublicBusinessEligible,hasCurrentLegalConsent,CURRENT_TERMS_VERSION,CURRENT_PRIVACY_VERSION} from '@holalocal/firebase-contract'
const env={GCLOUD_PROJECT:'demo-holalocal-functions',GOOGLE_CLOUD_PROJECT:'demo-holalocal-functions',
 FIREBASE_CONFIG:JSON.stringify({projectId:'demo-holalocal-functions',storageBucket:'demo-holalocal-functions.appspot.com'}),
 FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',FIREBASE_STORAGE_EMULATOR_HOST:'127.0.0.1:9199',STORAGE_EMULATOR_HOST:'http://127.0.0.1:9199',
 MESSAGE_TRANSLATION_PROVIDER:'disabled',HOLALOCAL_REVIEW_DEMO_SEED:'1',CUSTOMER_REVIEWS_ENABLED:'true',FIREBASE_EMULATOR_HUB:'127.0.0.1:4400'}
const documents=fixtureDocuments({timestamp:Timestamp.fromMillis(1000000),termsVersion:CURRENT_TERMS_VERSION,privacyVersion:CURRENT_PRIVACY_VERSION})
function fake(){
 const records=new Map([['users/unrelated',{keep:true}]]),users=new Map(),writes=[]
 const db={doc:path=>({path,create:async value=>{assert.ok(!records.has(path));records.set(path,structuredClone(value));writes.push(path)}}),getAll:async(...refs)=>refs.map(({path})=>({exists:records.has(path),data:()=>records.get(path)}))}
 const auth={getUser:async uid=>{if(!users.has(uid))throw Object.assign(new Error(),{code:'auth/user-not-found'});return users.get(uid)},createUser:async value=>{users.set(value.uid,structuredClone(value));writes.push(value.uid)},setCustomUserClaims:async(uid,claims)=>{users.get(uid).customClaims=claims;writes.push('claims')}}
 return {db,auth,records,users,writes,documents}
}
test('seed rejects unsafe project, credentials, endpoints, translation and missing opt-in before network',async()=>{
 assert.doesNotThrow(()=>assertSeedEnvironment(env))
 for(const patch of [{GCLOUD_PROJECT:'holalocal-491c9'},{GOOGLE_APPLICATION_CREDENTIALS:'forbidden'},{FIRESTORE_EMULATOR_HOST:'example.com:8080'},{MESSAGE_TRANSLATION_PROVIDER:'google'},{HOLALOCAL_REVIEW_DEMO_SEED:''},{FIREBASE_EMULATOR_HUB:'localhost:4400'}]){
  await assert.rejects(confirmEmulators({...env,...patch},()=>assert.fail('No network permitted')))
 }
})
test('seed confirms exact running services without following redirects',async()=>{
 const services=Object.fromEntries(Object.entries({auth:9099,firestore:8080,functions:5001,storage:9199}).map(([name,port])=>[name,{host:'127.0.0.1',port}]))
 await confirmEmulators(env,async(url,options)=>{assert.equal(url,'http://127.0.0.1:4400/emulators');assert.equal(options.redirect,'error');return {ok:true,json:async()=>services}})
 await assert.rejects(confirmEmulators(env,async()=>({ok:true,json:async()=>({...services,auth:{host:'external',port:9099}})})))
})
test('canonical demo profiles/consent and eligible business; repeat seed preserves progress and unrelated data',async()=>{
 assert.ok(isPublicBusinessEligible(documents.business));documents.profiles.forEach(profile=>assert.ok(hasCurrentLegalConsent(profile)))
 const state=fake();await seedFixtures(state)
 assert.equal(state.users.get(accounts[2].uid).customClaims.admin,true)
 state.records.set('customerReviewStats/'+businessId,{count:1,sum:4})
 const before=structuredClone([...state.records]),writes=state.writes.length
 await seedFixtures(state);assert.deepEqual([...state.records],before);assert.equal(state.writes.length,writes)
})
test('unmarked collisions fail without writes; partial seed resumes only missing fixtures',async()=>{
 const occupied=fake();occupied.records.set('users/'+accounts[0].uid,{private:true})
 await assert.rejects(seedFixtures(occupied),/identity mismatch/);assert.equal(occupied.writes.length,0)
 const state=fake(),original=state.auth.createUser;let failed=false
 state.auth.createUser=async value=>{if(!failed){failed=true;throw new Error('simulated interruption')}return original(value)}
 await assert.rejects(seedFixtures(state),/interruption/);await seedFixtures(state)
 assert.ok(state.records.has('businesses/'+businessId));assert.equal(state.users.size,3)
})
