import {before,after,test} from 'node:test'
import assert from 'node:assert/strict'
import {initializeApp,deleteApp} from 'firebase-admin/app'
import {getFirestore,Timestamp} from 'firebase-admin/firestore'
import {assessAcknowledgmentRetention,removeReleasedAcknowledgmentEvidence,completeAccountDeletionWorkflow,acquireAccountDeletionLease} from '../src/accountDeletionPrimitives.js'
const enabled=process.env.HOLALOCAL_RETENTION_EMULATOR==='1'
let app,db
before(()=>{if(!enabled)return;assert.equal(process.env.GCLOUD_PROJECT,'demo-holalocal-retention');assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:18080');app=initializeApp({projectId:process.env.GCLOUD_PROJECT},'retention');db=getFirestore(app)})
after(async()=>{if(app)await deleteApp(app)})
const now=Timestamp.fromMillis(1800000000000), claims={admin:true}
const base={state:'completed',lastCompletedStep:'completed',uid:'case',finalizedBy:'admin',requestVersion:8,completedAt:now,retainedConsentEvidence:{termsVersion:'1.0',privacyVersion:'1.0',termsAcceptedAt:now,privacyAcceptedAt:now}}
const options=uid=>({uid,actorUid:'admin',claims,db})
test('real transaction: closed gate, assessed release, reload, retry and terminal finalizer safety',{skip:!enabled},async()=>{
 const uid='ack-completed',ref=db.doc(`accountDeletionRequests/${uid}`);await ref.set({...base,uid})
 assert.deepEqual(await removeReleasedAcknowledgmentEvidence(options(uid)),{removed:false,disabled:true})
 assert.equal((await removeReleasedAcknowledgmentEvidence({...options(uid),enabled:true})).blocked,true)
 await assessAcknowledgmentRetention({...options(uid),expectedRevision:0,action:'hold',reason:'specific dispute',endingCondition:'dispute ends',reviewAt:Timestamp.fromMillis(now.toMillis()+1000),now})
 await assert.rejects(assessAcknowledgmentRetention({...options(uid),actorUid:'other',claims:{},expectedRevision:1,action:'release',reason:'ended',now}),/admin-required/)
 const results=await Promise.allSettled([1,2].map(()=>assessAcknowledgmentRetention({...options(uid),expectedRevision:1,action:'release',reason:'dispute ended',now})))
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1)
 const clean=await Promise.all([1,2].map(()=>removeReleasedAcknowledgmentEvidence({...options(uid),enabled:true})))
 assert.equal(clean.filter(x=>x.removed).length,1)
 const reloaded=(await ref.get()).data();assert.equal(reloaded.retainedConsentEvidence,undefined);assert.equal(reloaded.evidenceRetention,undefined);assert.equal(reloaded.requestVersion,8);assert.equal(reloaded.lastCompletedStep,'completed')
 assert.equal((await acquireAccountDeletionLease({uid,adminUid:'admin',expectedRequestVersion:8,db})).completed,true)
 assert.equal((await completeAccountDeletionWorkflow({uid,leaseId:'late',expectedRequestVersion:8,db})).idempotent,true)
 assert.equal((await ref.get()).data().retainedConsentEvidence,undefined)
})
test('incomplete workflows and existing account acknowledgments are untouched',{skip:!enabled},async()=>{
 for(const state of ['requested','finalizing','failed_retryable','cancelled']){
  const uid='ack-'+state,ref=db.doc(`accountDeletionRequests/${uid}`);await ref.set({...base,uid,state})
  await assert.rejects(assessAcknowledgmentRetention({...options(uid),expectedRevision:0,action:'hold',reason:'specific case',endingCondition:'case ends',reviewAt:Timestamp.fromMillis(now.toMillis()+1),now}),/completed-erasure/)
  assert.equal((await removeReleasedAcknowledgmentEvidence({...options(uid),enabled:true})).blocked,true)
  assert.deepEqual((await ref.get()).data(),{...base,uid,state})
 }
 const uid='ack-existing';await db.doc(`accountDeletionRequests/${uid}`).set({...base,uid});await db.doc(`users/${uid}`).set({termsVersion:'1.0',termsAcceptedAt:now})
 assert.equal((await removeReleasedAcknowledgmentEvidence({...options(uid),enabled:true})).blocked,true)
 assert.deepEqual((await db.doc(`users/${uid}`).get()).data(),{termsVersion:'1.0',termsAcceptedAt:now})
})
test('completion creates due review once, with no backdating or duplicate resets',{skip:!enabled},async()=>{
 const uid='ack-finishing',ref=db.doc(`accountDeletionRequests/${uid}`)
 await ref.set({...base,uid,state:'finalizing',lastCompletedStep:'firebase_auth_removed',leaseId:'lease'})
 await completeAccountDeletionWorkflow({uid,leaseId:'lease',expectedRequestVersion:8,db,now})
 const first=(await ref.get()).data();assert.equal(first.evidenceRetention.reviewerId,'admin');assert.equal(first.evidenceRetention.reviewAt.toMillis(),now.toMillis())
 await completeAccountDeletionWorkflow({uid,leaseId:'lease',expectedRequestVersion:9,db,now:Timestamp.fromMillis(now.toMillis()+10000)})
 assert.deepEqual((await ref.get()).data().evidenceRetention,first.evidenceRetention)
})
