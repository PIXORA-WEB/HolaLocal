import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {assertCallableBoundaryEnvironment} from '../scripts/runIsolatedEmulatorTests.mjs'
import {createCustomerReviewCommands,customerReviewQuotaKey} from '../src/customerReviewCommands.js'
import {createCustomerReviewFirestoreDatabase,readCustomerReviewFirestoreEligibility} from '../src/customerReviewFirestore.js'
import {createCustomerReviewReadFirestore} from '../src/customerReviewReadFirestore.js'
import {createCustomerReviewReportServices,customerReviewReportQuotaId} from '../src/customerReviewReports.js'
import {customerReviewQuotaPolicy,customerReviewReportQuotaPolicy,CUSTOMER_REVIEW_WINDOW_MS as day} from '../src/customerReviewQuotas.js'
import {runCustomerReviewRetention,sweepResolvedCustomerReviewReports,CUSTOMER_REVIEW_REPORT_RETENTION_MS as retention} from '../src/customerReviewRetention.js'
import {cleanupAccountCustomerReviews} from '../src/customerReviewDeletion.js'
import {fixtureData,helpers} from './customerReviewReadFixtures.mjs'
if(process.env.HOLALOCAL_CALLABLE_BOUNDARY!=='1')test('policy emulator gate',{skip:'Use protected emulator suite'},()=>{})
else {
 assertCallableBoundaryEnvironment()
 const {initializeApp,deleteApp}=await import('firebase-admin/app')
 const {getFirestore,Timestamp}=await import('firebase-admin/firestore')
 const app=initializeApp({projectId:'demo-holalocal-functions'},`policies-${randomUUID()}`),db=getFirestore(app)
 test.after(async()=>{await db.terminate();await deleteApp(app)})
 // Exercise the same request after the emulator's observed native closed-transaction failure.
 // Other errors still fail immediately; no runtime retry policy or quota assertion is relaxed.
 async function identicalRace(operation){
  const attempts=await Promise.allSettled([operation(),operation()]),outcomes=[]
  for(const attempt of attempts){
   if(attempt.status==='fulfilled')outcomes.push(attempt.value)
   else {
    assert.equal(attempt.reason.code,3);assert.match(attempt.reason.message,/Transaction is invalid or closed/)
    console.info('Observed emulator closed-transaction error; replaying the identical request once.')
    outcomes.push(await operation())
   }
  }
  return outcomes
 }
 async function setup(){
  const uid=`policy-${randomUUID()}`,admin=`admin-${randomUUID()}`;let now=Date.now()
  await db.doc(`users/${uid}`).set({accountStatus:'active',roles:['customer'],deletionRequestedAt:null})
  const auth={resolveActor:async role=>role==='admin'?{uid:admin,admin:true}:{uid,emailVerified:true},loadAuthorIdentity:async()=>({uid,emailVerified:true})}
  const database=createCustomerReviewFirestoreDatabase(db)
  const core=createCustomerReviewCommands({helpers,database,auth,readEligibility:readCustomerReviewFirestoreEligibility,quotaPolicy:customerReviewQuotaPolicy,clock:()=>now})
  const reports=createCustomerReviewReportServices({database,auth,readDatabase:createCustomerReviewReadFirestore(db),reportQuotaPolicy:customerReviewReportQuotaPolicy,clock:()=>now})
  async function target(){const f=fixtureData(`policy-target-${randomUUID()}`),review=f.review('published');f.data.set(`customerReviewStats/${f.businessId}`,{sum:4,count:1});const batch=db.batch();for(const [path,row] of f.data)batch.set(db.doc(path),row);await batch.commit();return {...f,...review}}
  const submit=(businessId,extra={})=>core.submit('customer',{businessId,expectedVersion:0,requestId:randomUUID(),rating:4,displayName:'Synthetic chosen name',originalText:'A synthetic review for isolated policy verification.',...extra})
  const report=(t,extra={})=>reports.submit('customer',{publicReviewId:t.publicReviewId,observedPublishedRevision:1,submittedAt:now,reasonCode:'spam',details:'Sensitive synthetic report',requestId:randomUUID(),...extra})
  const resolve=row=>reports.resolve('admin',{reportId:row.reportId,expectedVersion:row.version,expectedGeneration:row.generation,disposition:'resolved',resolutionReason:'Synthetic resolution',moderationNote:'Private synthetic note',requestId:randomUUID()})
  return {uid,admin,core,reports,target,submit,report,resolve,time:()=>now,advance:ms=>{now+=ms}}
 }
 test('scheduled worker wrapper is inert while disabled and deletes expired records when enabled',async()=>{
  let created=0
  assert.deepEqual(await runCustomerReviewRetention({env:{},createDatabase:()=>{created++;return db}}),{disabled:true})
  assert.equal(created,0)
  const ref=db.doc(`customerReviewReportAudits/scheduler-${randomUUID()}`)
  await ref.set({expiresAt:Timestamp.fromMillis(1000),moderationNote:'Synthetic private note'})
  const result=await runCustomerReviewRetention({env:{CUSTOMER_REVIEW_RETENTION_ENABLED:'true'},createDatabase:()=>{created++;return db},now:1000})
  assert.equal(created,1);assert.ok(result.deleted>=1)
  assert.equal((await ref.get()).exists,false)
  assert.deepEqual(Object.keys(result).sort(),['deleted','failedCollections','failedRecords','pageLimitReached'])
 })
 test('real transaction concurrency: 5 combined review operations across businesses, one slot, retry and unrestricted withdrawal',async()=>{
  const s=await setup(),targets=[];for(let i=0;i<6;i++)targets.push(await s.target())
  const results=await Promise.allSettled(targets.map(t=>s.submit(t.businessId)))
  assert.equal(results.filter(r=>r.status==='fulfilled').length,5)
  assert.match(results.find(r=>r.status==='rejected').reason.message,/review-quota-exceeded/)
  assert.equal((await db.doc(`customerReviewQuotas/${customerReviewQuotaKey(s.uid)}`).get()).data().acceptedAt.length,5)
  const first=results.find(r=>r.status==='fulfilled').value
  await s.core.withdraw('customer',{publicReviewId:first.publicReviewId,expectedVersion:first.version,requestId:'withdraw-at-limit'})
  s.advance(day)
  const payload={requestId:'same-request'}
  // Use a fresh business for racing identical requests after the exact window boundary.
  const fresh=await s.target();const same=await identicalRace(()=>s.submit(fresh.businessId,payload))
  assert.deepEqual(same[0],same[1])
  assert.equal((await db.collection('customerReviewSlots').where('businessId','==',fresh.businessId).where('authorUid','==',s.uid).get()).size,1)
  assert.equal((await db.doc(`customerReviewQuotas/${customerReviewQuotaKey(s.uid)}`).get()).data().acceptedAt.length,1)
 })
 test('submission and edits share five reservations; approval is free, rejected over-limit edit preserves published version',async()=>{
  const s=await setup(),t=await s.target();let row=await s.submit(t.businessId)
  for(let i=1;i<=5;i++){
   row=await s.core.approve('admin',{publicReviewId:row.publicReviewId,expectedVersion:row.version,requestId:`approve-${i}`})
   const payload={businessId:t.businessId,expectedVersion:row.version,requestId:`edit-${i}`,rating:3,displayName:'Updated public name',originalText:'A synthetic edited review for quota verification.'}
   if(i<5)row=await s.core.edit('customer',payload)
   else await assert.rejects(s.core.edit('customer',payload),/review-quota-exceeded/)
  }
  assert.equal((await db.collection('customerReviewSlots').where('authorUid','==',s.uid).get()).size,1)
  assert.equal((await db.doc(`customerReviewQuotas/${customerReviewQuotaKey(s.uid)}`).get()).data().acceptedAt.length,5)
  await s.core.withdraw('customer',{publicReviewId:row.publicReviewId,expectedVersion:row.version,requestId:'withdraw'})
  assert.equal((await db.doc(`customerReviewsPublic/${row.publicReviewId}`).get()).exists,false)
 })
 test('real report concurrency: ten global reservations, exact retry free, closed receipt does not reopen',async()=>{
  const s=await setup(),targets=[];for(let i=0;i<11;i++)targets.push(await s.target())
  const results=await Promise.allSettled(targets.map(t=>s.report(t)))
  assert.equal(results.filter(r=>r.status==='fulfilled').length,10)
  assert.match(results.find(r=>r.status==='rejected').reason.message,/report-quota-exceeded/)
  s.advance(day);const fresh=await s.target(),payload={requestId:'identical',submittedAt:s.time()}
  const both=await identicalRace(()=>s.report(fresh,payload))
  assert.deepEqual(both[0],both[1]);await s.resolve(both[0])
  assert.deepEqual(await s.report(fresh,payload),both[0])
  assert.equal((await db.doc(`customerReviewReports/${both[0].reportId}`).get()).data().status,'resolved')
  assert.equal((await db.doc(`customerReviewReportQuotas/${customerReviewReportQuotaId(s.uid)}`).get()).data().acceptedAt.length,1)
 })
 test('retention exact timing drains linked sensitive copies, retains open reports and does not resurrect pruned retries',async()=>{
  const s=await setup(),t=await s.target(),payload={requestId:'first',submittedAt:s.time()}
  const filed=await s.report(t,payload);await s.resolve(filed)
  const other=await s.report(await s.target())
  await sweepResolvedCustomerReviewReports({db,now:s.time()+retention-1,pageSize:100})
  assert.equal((await db.doc(`customerReviewReports/${filed.reportId}`).get()).exists,true)
  s.advance(retention)
  await sweepResolvedCustomerReviewReports({db,now:s.time(),pageSize:100})
  for(const collection of ['customerReviewReports','customerReviewReportRequests','customerReviewReportAudits'])assert.equal((await db.collection(collection).where('reportId','==',filed.reportId).get()).empty,true)
  assert.equal((await db.doc(`customerReviewReports/${other.reportId}`).get()).data().status,'open')
  await assert.rejects(s.report(t,payload),/report-request-expired/)
  const newReport=await s.report(t,{requestId:payload.requestId,submittedAt:s.time()})
  assert.equal(newReport.status,'open')
  assert.equal(newReport.version,filed.version,'numeric versions can repeat after full erasure')
  assert.notEqual(newReport.generation,filed.generation)
  await assert.rejects(s.resolve(filed),/report-version-conflict/)
  assert.equal((await db.doc(`customerReviewReports/${newReport.reportId}`).get()).data().status,'open')
  await s.resolve(newReport)
 })
 test('retention candidate/new report race rereads expiry and preserves newly open report',async()=>{
  const s=await setup(),t=await s.target(),filed=await s.report(t);await s.resolve(filed);s.advance(retention)
  let raced=false
  const wrapped={doc:path=>db.doc(path),collection:name=>db.collection(name),runTransaction:async callback=>{
   if(!raced){raced=true;await s.report(t)}
   return db.runTransaction(callback)
  }}
  await sweepResolvedCustomerReviewReports({db:wrapped,now:s.time(),pageSize:100})
  assert.equal((await db.doc(`customerReviewReports/${filed.reportId}`).get()).data().status,'open')
  assert.equal((await db.collection('customerReviewReportRequests').where('reportId','==',filed.reportId).get()).size,1)
  assert.equal((await db.collection('customerReviewReportAudits').where('reportId','==',filed.reportId).get()).size,1)
 })
 test('newly resolved report survives an older retention candidate while old-cycle copies expire',async()=>{
  const s=await setup(),t=await s.target(),filed=await s.report(t);await s.resolve(filed);s.advance(retention)
  let raced=false
  const wrapped={doc:path=>db.doc(path),collection:name=>db.collection(name),runTransaction:async callback=>{
   if(!raced){raced=true;await s.resolve(await s.report(t))}
   return db.runTransaction(callback)
  }}
  await sweepResolvedCustomerReviewReports({db:wrapped,now:s.time(),pageSize:100})
  const row=(await db.doc(`customerReviewReports/${filed.reportId}`).get()).data()
  assert.equal(row.status,'resolved');assert.equal(row.expiresAt.toMillis(),s.time()+retention)
  for(const collection of ['customerReviewReportRequests','customerReviewReportAudits']){
   const copies=await db.collection(collection).where('reportId','==',filed.reportId).get();assert.equal(copies.size,2)
   for(const copy of copies.docs)assert.equal(copy.data().expiresAt.toMillis(),s.time()+retention)
  }
 })
 test('account erasure races retention and drains open, resolved, linked data and both quota records early',async()=>{
  const s=await setup(),closed=await s.report(await s.target());await s.resolve(closed);await s.report(await s.target())
  await s.submit((await s.target()).businessId)
  const request=db.doc(`accountDeletionRequests/${s.uid}`)
  await request.set({state:'finalizing',leaseId:'synthetic-lease',requestVersion:1,leaseExpiresAt:Timestamp.fromMillis(s.time()+day)})
  let result
  for(let i=0;i<10;i++){
   [result]=await Promise.all([cleanupAccountCustomerReviews({uid:s.uid,leaseId:'synthetic-lease',expectedRequestVersion:1,db,now:()=>Timestamp.fromMillis(s.time()),pageSize:2}),sweepResolvedCustomerReviewReports({db,now:s.time()})])
   if(result.complete)break
  }
  assert.equal(result.complete,true)
  for(const [collection,field] of [['customerReviewReports','reporterUid'],['customerReviewReportRequests','actorUid'],['customerReviewReportRequests','reporterUid'],['customerReviewReportAudits','actorUid'],['customerReviewReportAudits','reporterUid']])assert.equal((await db.collection(collection).where(field,'==',s.uid).get()).empty,true)
  for(const [collection,id] of [['customerReviewQuotas',customerReviewQuotaKey(s.uid)],['customerReviewReportQuotas',customerReviewReportQuotaId(s.uid)]])assert.equal((await db.doc(`${collection}/${id}`).get()).exists,false)
  await assert.rejects(s.report(await s.target()),/active-account-required/)
 })
}
