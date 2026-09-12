import {before,after,test} from 'node:test'
import assert from 'node:assert/strict'
import {initializeApp,deleteApp} from 'firebase-admin/app'
import {getFirestore,Timestamp} from 'firebase-admin/firestore'
import {manageRetentionRecords} from '../src/adminRetention.js'
const enabled=process.env.HOLALOCAL_RETENTION_EMULATOR==='1';let app,db
before(()=>{if(!enabled)return;assert.equal(process.env.GCLOUD_PROJECT,'demo-holalocal-retention');assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:18080');app=initializeApp({projectId:process.env.GCLOUD_PROJECT},'admin-retention');db=getFirestore(app)})
after(async()=>{if(app)await deleteApp(app)})
const now=Timestamp.fromMillis(1800000000000)
const call=(data,extra={})=>manageRetentionRecords({actorUid:'admin',claims:{admin:true},db,data,now,env:{},...extra})
test('admin-only strict requests cannot enable cleanup or escape bounded collections',{skip:!enabled},async()=>{
 await assert.rejects(call({action:'list',kind:'acknowledgment'},{claims:{}}),/admin-required/)
 await assert.rejects(call({action:'list',kind:'acknowledgment'},{actorUid:null}),/admin-required/)
 for(const data of [{action:'list',kind:'users'},{action:'list',kind:'conversation',cursor:'../users'},{action:'execute',kind:'business-report',ids:['x'],enabled:true},{action:'execute',kind:'business-report',ids:Array.from({length:6},(_,i)=>'id'+i)}])await assert.rejects(call(data),/invalid|unexpected/)
 assert.deepEqual(await call({action:'execute',kind:'business-report',ids:['missing']}),{disabled:true,results:[]})
})
test('paginated queues advance even across ineligible records and project private fields narrowly',{skip:!enabled},async()=>{
 for(let i=0;i<23;i++)await db.doc('accountDeletionRequests/queue-'+String(i).padStart(2,'0')).set({state:i===22?'completed':'requested',secret:'never returned',retainedConsentEvidence:{termsVersion:'1.0'}})
 const first=await call({action:'list',kind:'acknowledgment',cursor:'queue-'})
 assert.equal(first.rows.length,0);assert.equal(first.nextCursor,'queue-19')
 const second=await call({action:'list',kind:'acknowledgment',cursor:first.nextCursor})
 assert.equal(second.rows.length,1);assert.equal(second.nextCursor,null);assert.equal(second.rows[0].secret,undefined)
 assert.equal(second.cleanupEnabled,false)
})
test('one record failure does not block unrelated eligible cleanup and no client clock is trusted',{skip:!enabled},async()=>{
 const expired=Timestamp.fromMillis(now.toMillis()-91*86400000)
 for(const id of ['due-a','due-b'])await db.doc('reports/'+id).set({targetType:'business',targetId:'unchanged',status:'resolved',resolutionVersion:1,resolvedAt:expired,evidence:[],parentId:null})
 const wrapped={doc(path){if(path==='reports/failure')throw new Error('sensitive provider details');return db.doc(path)},runTransaction:fn=>db.runTransaction(fn)}
 const result=await call({action:'execute',kind:'business-report',ids:['due-a','failure','due-b']},{db:wrapped,env:{RECORD_RETENTION_CLEANUP_ENABLED:'true'}})
 assert.deepEqual(result.results.map(row=>[row.id,row.removed??false,row.failed??false]),[['due-a',true,false],['failure',false,true],['due-b',true,false]])
 assert.equal(JSON.stringify(result).includes('sensitive'),false)
 await assert.rejects(call({action:'resolve',kind:'business-report',id:'x',summary:'handled',now:1}),/unexpected/)
})

test('full-queue due filters use trusted dates, oldest first, beyond the first directory page',{skip:!enabled},async()=>{
 const old=Timestamp.fromMillis(now.toMillis()-100*86400000)
 for(let i=0;i<25;i++)await db.doc(`reports/aa-future-${i}`).set({targetType:'business',status:'resolved',resolutionVersion:1,resolvedAt:now})
 await db.doc('reports/zz-overdue').set({targetType:'business',status:'resolved',resolutionVersion:1,resolvedAt:old})
 await db.doc('reports/zz-boundary').set({targetType:'business',status:'resolved',resolutionVersion:1,resolvedAt:Timestamp.fromMillis(now.toMillis()-90*86400000)})
 await db.doc('reports/zz-legacy').set({targetType:'business',status:'resolved',resolvedAt:old})
 await db.doc('reports/zz-held').set({targetType:'business',status:'resolved',resolutionVersion:1,resolvedAt:old,retentionDecision:{state:'held',reviewAt:Timestamp.fromMillis(now.toMillis()-1)}})
 const due=await call({action:'list',kind:'business-report',view:'cleanup-due'})
 assert.equal(due.rows[0].id,'zz-held');assert.ok(due.rows.some(row=>row.id==='zz-overdue'))
 assert.ok(due.rows.some(row=>row.id==='zz-boundary'));assert.ok(due.rows.every(row=>!row.id.startsWith('aa-')&&row.id!=='zz-legacy'))
 assert.equal(due.rows.find(row=>row.id==='zz-overdue').eligibleAt,Timestamp.fromMillis(old.toMillis()+90*86400000).toDate().toISOString())
 const held=await call({action:'list',kind:'business-report',view:'reviews-due'});assert.ok(held.rows.some(row=>row.id==='zz-held'))
 for(let i=0;i<23;i++){
  const id=`due-private-${String(i).padStart(2,'0')}`
  await db.doc(`conversations/${id}`).set({status:'active'})
  await db.doc(`conversationRetention/${id}`).set({decision:{state:'held',reviewAt:old}})
 }
 const first=await call({action:'list',kind:'conversation',view:'reviews-due'})
 assert.equal(first.rows.length,20);assert.equal(first.nextCursor,'due-private-19')
 const next=await call({action:'list',kind:'conversation',view:'reviews-due',cursor:first.nextCursor})
 assert.equal(next.rows.length,3);assert.equal(next.nextCursor,null)
 await assert.rejects(call({action:'list',kind:'conversation',view:'cleanup-due'}),/report-only-view/)
 await assert.rejects(call({action:'list',kind:'business-report',view:'unknown'}),/invalid-retention-view/)
})
