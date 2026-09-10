import test from 'node:test'
import assert from 'node:assert/strict'
import {assertCallableBoundaryEnvironment} from '../scripts/runIsolatedEmulatorTests.mjs'
import {sweepResolvedCustomerReviewReports} from '../src/customerReviewRetention.js'
import {recoverAuthorisedAccountDeletions} from '../src/accountDeletionRecovery.js'
import {finalizeAccountDeletion} from '../src/accountDeletionFinalizer.js'
if(process.env.HOLALOCAL_CALLABLE_BOUNDARY!=='1')test('safeguards emulator gate',{skip:true},()=>{})
else {
 assertCallableBoundaryEnvironment()
 const {initializeApp,deleteApp}=await import('firebase-admin/app')
 const {getFirestore,Timestamp}=await import('firebase-admin/firestore')
 const {getAuth}=await import('firebase-admin/auth')
 const app=initializeApp({projectId:'demo-holalocal-functions',storageBucket:'demo-holalocal-functions.appspot.com'}),db=getFirestore(app),auth=getAuth(app)
 test.after(async()=>{await db.terminate();await deleteApp(app)})
 test('retention poison first page does not starve later eligible records or other collections; retry wraps safely',async()=>{
  await db.doc('maintenanceProgress/customerReviewRetention').delete()
  const poison=db.doc('customerReviewReports/000-safeguard-poison'),good=db.doc('customerReviewReports/001-safeguard-good'),open=db.doc('customerReviewReports/002-safeguard-open'),copy=db.doc('customerReviewReportAudits/000-safeguard-copy')
  await Promise.all([poison.set({status:'resolved',expiresAt:Timestamp.fromMillis(1)}),good.set({status:'resolved',expiresAt:Timestamp.fromMillis(2)}),open.set({status:'open',expiresAt:Timestamp.fromMillis(3)}),copy.set({expiresAt:Timestamp.fromMillis(1)})])
  let fail=true
  const wrapped={doc:p=>db.doc(p),collection:p=>{if(p==='customerReviewReportRequests')throw new Error('synthetic collection failure');return db.collection(p)},runTransaction:cb=>db.runTransaction(tx=>cb({get:ref=>{if(fail&&ref.path===poison.path)throw new Error('synthetic private failure');return tx.get(ref)},delete:ref=>tx.delete(ref)}))}
  const first=await sweepResolvedCustomerReviewReports({db:wrapped,now:1000,pageSize:1})
  assert.equal(first.failedRecords,1);assert.equal(first.failedCollections,1);assert.equal((await poison.get()).exists,true);assert.equal((await copy.get()).exists,false)
  await sweepResolvedCustomerReviewReports({db:wrapped,now:1000,pageSize:1});assert.equal((await good.get()).exists,false)
  await sweepResolvedCustomerReviewReports({db:wrapped,now:1000,pageSize:1});assert.equal((await open.get()).exists,true)
  await sweepResolvedCustomerReviewReports({db:wrapped,now:1000,pageSize:1});fail=false
  await sweepResolvedCustomerReviewReports({db:wrapped,now:1000,pageSize:1});assert.equal((await poison.get()).exists,false)
  await open.delete();await db.doc('maintenanceProgress/customerReviewRetention').delete()
 })
 test('progress documents remain inaccessible to clients including claimed admins',async()=>{
  const {initializeTestEnvironment,assertFails}=await import('../../apps/holalocal-website/node_modules/@firebase/rules-unit-testing/dist/esm/index.esm.js')
  const {doc,getDoc,setDoc}=await import('../../apps/holalocal-website/node_modules/firebase/firestore/dist/esm/index.esm.js')
  const environment=await initializeTestEnvironment({projectId:'demo-holalocal-functions',firestore:{host:'127.0.0.1',port:8080}})
  try{for(const context of [environment.unauthenticatedContext(),environment.authenticatedContext('synthetic-admin',{admin:true})]){
   for(const id of ['customerReviewRetention','accountDeletionRecovery']){const ref=doc(context.firestore(),'maintenanceProgress',id);await assertFails(getDoc(ref));await assertFails(setDoc(ref,{documentId:'forged'}))}
  }}finally{await environment.cleanup()}
 })
 test('real authorised failed erasure resumes without admin browser; revoked admin and requested/cancelled work stay untouched',async()=>{
  const admin='000-safeguard-admin',uid='000-safeguard-target',request=db.doc('accountDeletionRequests/'+uid)
  await auth.createUser({uid:admin});await auth.setCustomUserClaims(admin,{admin:true})
  await auth.createUser({uid,email:'synthetic-safeguard@example.invalid',emailVerified:true})
  await db.doc('users/'+uid).set({businessId:null,termsAccepted:true,termsVersion:'1.0',termsAcceptedAt:Timestamp.now(),privacyAccepted:true,privacyVersion:'1.0',privacyAcceptedAt:Timestamp.now()})
  await request.set({uid,state:'requested',requestVersion:1,requestedBy:uid,requestedAt:Timestamp.now(),updatedAt:Timestamp.now()})
  const first=await finalizeAccountDeletion({adminUid:admin,claims:(await auth.getUser(admin)).customClaims,uid,expectedRequestVersion:1,db,primitives:{cleanupMedia:async()=>({ok:false,counts:{attempted:1,failed:1}})}})
  assert.equal(first.state,'failed_retryable');assert.equal((await request.get()).data().finalizedBy,admin)
  await request.update({updatedAt:Timestamp.fromMillis(1)})
  for(const state of ['requested','cancelled'])await db.doc('accountDeletionRequests/000-safeguard-'+state).set({state,requestVersion:1})
  await db.doc('maintenanceProgress/accountDeletionRecovery').delete();await auth.setCustomUserClaims(admin,{admin:false})
  const denied=await recoverAuthorisedAccountDeletions({db,auth});assert.ok(denied.blocked>=1);assert.ok(await auth.getUser(uid))
  await auth.setCustomUserClaims(admin,{admin:true});await db.doc('maintenanceProgress/accountDeletionRecovery').delete()
  const owned=db.doc('businesses/000-safeguard-owned');await owned.set({ownerId:uid})
  const blocked=await recoverAuthorisedAccountDeletions({db,auth});assert.ok(blocked.blocked>=1);assert.ok(await auth.getUser(uid));await owned.delete();await db.doc('maintenanceProgress/accountDeletionRecovery').delete()
  const results=await Promise.all([recoverAuthorisedAccountDeletions({db,auth}),recoverAuthorisedAccountDeletions({db,auth})])
  assert.ok(results.some(r=>r.completed>=1));assert.equal((await request.get()).data().state,'completed');assert.equal((await request.get()).data().retryCount,1)
  await assert.rejects(auth.getUser(uid),e=>e.code==='auth/user-not-found')
  for(const state of ['requested','cancelled']){assert.equal((await db.doc('accountDeletionRequests/000-safeguard-'+state).get()).data().state,state);await db.doc('accountDeletionRequests/000-safeguard-'+state).delete()}
 })
}
