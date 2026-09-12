import {runBusinessReportRetention} from '../src/businessReports.js'
import {before,after,test} from 'node:test'
import assert from 'node:assert/strict'
import {initializeApp,deleteApp} from 'firebase-admin/app'
import {getFirestore,Timestamp} from 'firebase-admin/firestore'
import {resolveBusinessReport,assessBusinessReportRetention,removeExpiredBusinessReport,BUSINESS_REPORT_RETENTION_MS} from '../src/businessReports.js'
const enabled=process.env.HOLALOCAL_RETENTION_EMULATOR==='1'
let app,db
before(()=>{if(!enabled)return;assert.equal(process.env.GCLOUD_PROJECT,'demo-holalocal-retention');assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:18080');app=initializeApp({projectId:process.env.GCLOUD_PROJECT},'report-retention');db=getFirestore(app)})
after(async()=>{if(app)await deleteApp(app)})
const now=Timestamp.fromMillis(1800000000000),later=Timestamp.fromMillis(now.toMillis()+BUSINESS_REPORT_RETENTION_MS)
const opts=reportId=>({db,reportId,actorUid:'admin',claims:{admin:true},now})
const row={reporterId:'synthetic',targetType:'business',targetId:'synthetic-business',parentId:null,reason:'other',details:'synthetic report',evidence:[],status:'open',priority:'normal',assignedTo:null,resolution:null,createdAt:now,updatedAt:now}
test('resolution retry does not reset clock; boundary deletion preserves business and review reports',{skip:!enabled},async()=>{
 await db.doc('businesses/synthetic-business').set({status:'pending_review',ownerId:'owner'})
 await db.doc('customerReviewReports/unrelated').set({privateText:'synthetic untouched'})
 const reportId='report-boundary';await db.doc(`reports/${reportId}`).set(row)
 await assert.rejects(resolveBusinessReport({...opts(reportId),claims:{},summary:'handled'}),/moderator-required/)
 assert.equal((await removeExpiredBusinessReport(opts(reportId))).disabled,true)
 const results=await Promise.all([1,2].map(()=>resolveBusinessReport({...opts(reportId),claims:{moderator:true},summary:'handled'})))
 assert.equal(results.filter(x=>x.idempotent).length,1)
 await resolveBusinessReport({...opts(reportId),summary:'handled',now:later})
 assert.equal((await db.doc(`reports/${reportId}`).get()).data().resolvedAt.toMillis(),now.toMillis())
 assert.equal((await removeExpiredBusinessReport({...opts(reportId),enabled:true,now:Timestamp.fromMillis(later.toMillis()-1)})).removed,false)
 assert.equal((await removeExpiredBusinessReport({...opts(reportId),enabled:true,now:later})).removed,true)
 assert.equal((await removeExpiredBusinessReport({...opts(reportId),enabled:true,now:later})).idempotent,true)
 assert.deepEqual((await db.doc('businesses/synthetic-business').get()).data(),{status:'pending_review',ownerId:'owner'})
 assert.equal((await db.doc('customerReviewReports/unrelated').get()).exists,true)
})
test('overdue hold survives; explicit release does not restart90days; legacy dates never inferred',{skip:!enabled},async()=>{
 const reportId='report-held';await db.doc(`reports/${reportId}`).set(row);await resolveBusinessReport({...opts(reportId),summary:'handled'})
 await assessBusinessReportRetention({...opts(reportId),action:'hold',expectedRevision:0,reason:'specific dispute',endingCondition:'case ends',reviewAt:Timestamp.fromMillis(now.toMillis()+1)})
 assert.equal((await removeExpiredBusinessReport({...opts(reportId),enabled:true,now:later})).held,true)
 await assessBusinessReportRetention({...opts(reportId),action:'release',expectedRevision:1,reason:'case ended',now:later})
 assert.equal((await removeExpiredBusinessReport({...opts(reportId),enabled:true,now:later})).removed,true)
 for(const reportId of ['legacy-resolved','open','unknown-copy']){
  const record=reportId==='legacy-resolved'?{...row,status:'resolved'}:reportId==='open'?row:{...row,status:'resolved',resolvedAt:now,resolutionVersion:1,externalAuditId:'unverified'}
  await db.doc(`reports/${reportId}`).set(record)
  assert.equal((await removeExpiredBusinessReport({...opts(reportId),enabled:true,now:later})).needsAssessment,true)
  assert.deepEqual((await db.doc(`reports/${reportId}`).get()).data(),record)
 }
})


test('prepared automation is closed before database access, bounded and fair across preserved records',{skip:!enabled},async()=>{
 assert.deepEqual(await runBusinessReportRetention({env:{},createDatabase:()=>{throw new Error('must not open')}}),{disabled:true})
 const at=Timestamp.fromMillis(now.toMillis()-1000*86400000)
 for(const [id,extra]of [['auto-a-held',{retentionDecision:{state:'held'}}],['auto-b-eligible',{}],['auto-c-legacy',{resolutionVersion:0}]])await db.doc('reports/'+id).set({targetType:'business',status:'resolved',resolutionVersion:1,resolvedAt:at,evidence:[],parentId:null,...extra})
 await db.doc('maintenanceProgress/businessReportRetention').set({resolvedAt:null,documentId:null})
 const options={env:{BUSINESS_REPORT_RETENTION_ENABLED:'true'},createDatabase:()=>db,now,pageSize:1}
 const first=await runBusinessReportRetention(options);assert.equal(first.preserved,1);assert.equal(first.examined,1)
 const second=await runBusinessReportRetention(options);assert.equal(second.removed,1)
 const third=await runBusinessReportRetention(options);assert.equal(third.needsAssessment,1)
 assert.equal((await db.doc('reports/auto-a-held').get()).exists,true)
 assert.equal((await db.doc('reports/auto-b-eligible').get()).exists,false)
 assert.equal((await db.doc('reports/auto-c-legacy').get()).exists,true)
 await assert.rejects(runBusinessReportRetention({...options,pageSize:51}),/invalid-business-retention/)
})

test('worker isolates record failures, retries later and rereads a newly placed hold',{skip:!enabled},async()=>{
 const at=Timestamp.fromMillis(now.toMillis()-2000*86400000)
 const seed=async id=>db.doc('reports/'+id).set({...row,status:'resolved',resolutionVersion:1,resolvedAt:at})
 await seed('worker-a-fail');await seed('worker-b-good')
 await db.doc('maintenanceProgress/businessReportRetention').set({resolvedAt:null,documentId:null})
 const wrapped={collection:path=>db.collection(path),doc:path=>{if(path==='reports/worker-a-fail')throw new Error('private details');return db.doc(path)},runTransaction:fn=>db.runTransaction(fn)}
 const options={env:{BUSINESS_REPORT_RETENTION_ENABLED:'true'},createDatabase:()=>wrapped,now,pageSize:2}
 const result=await runBusinessReportRetention(options);assert.equal(result.failed,1);assert.equal(result.removed,1)
 assert.equal((await db.doc('reports/worker-a-fail').get()).exists,true);assert.equal((await db.doc('reports/worker-b-good').get()).exists,false)
 await db.doc('maintenanceProgress/businessReportRetention').set({resolvedAt:null,documentId:null})
 assert.equal((await runBusinessReportRetention({...options,createDatabase:()=>db,pageSize:1})).removed,1)
 await seed('worker-c-hold');await db.doc('maintenanceProgress/businessReportRetention').set({resolvedAt:null,documentId:null})
 const race={collection:path=>db.collection(path),doc:path=>db.doc(path),runTransaction:async fn=>{await db.doc('reports/worker-c-hold').update({retentionDecision:{state:'held'}});return db.runTransaction(fn)}}
 const held=await runBusinessReportRetention({...options,createDatabase:()=>race,pageSize:1});assert.equal(held.preserved,1)
 assert.equal((await db.doc('reports/worker-c-hold').get()).exists,true)
})
