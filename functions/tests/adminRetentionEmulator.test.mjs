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
