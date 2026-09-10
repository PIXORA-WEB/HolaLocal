import test from 'node:test'
import assert from 'node:assert/strict'
import {createAdminReviewService,createAdminReviewController,adminActionPayload,authorizeAdminReviewUser} from '../src/utils/adminCustomerReviewModel.js'
const wait=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {resolve,promise}}
const pending={publicReviewId:'review',businessAvailable:true,version:7,pending:{revision:3},published:{revision:2}}
const report={reportId:'report',generation:'synthetic-generation',publicReviewId:'review',version:2,targetState:'published',observedPublishedRevision:3,observedRevisionIsCurrent:true,currentReview:{publishedRevision:3,version:9}}
test('default-off and actual admin checks precede callable invocation',async()=>{
 let claims=0,calls=[]
 const disabled=createAdminReviewService({enabled:false,authorize:()=>{claims++;return true},invoke:(...args)=>calls.push(args)})
 for(const method of Object.values(disabled))await assert.rejects(()=>method({}),/disabled/)
 assert.equal(claims,0);assert.equal(calls.length,0)
 let admin=false
 const api=createAdminReviewService({enabled:true,authorize:async()=>admin,invoke:(...args)=>calls.push(args)})
 await assert.rejects(()=>api.queue({}),/admin-required/)
 admin=true;await api.approve({publicReviewId:'r',expectedVersion:1,requestId:'id'})
 assert.equal(calls[0][0],'approveCustomerReview')
 admin=false;await assert.rejects(()=>api.reportCase({reportId:'r'}),/admin-required/)
})
test('payloads keep approval/removal/resolution separate and block stale reports and unsupported rejection',()=>{
 assert.deepEqual(adminActionPayload('approve',pending),{publicReviewId:'review',expectedVersion:7})
 assert.deepEqual(adminActionPayload('remove',report),{publicReviewId:'review',expectedVersion:9})
 assert.deepEqual(adminActionPayload('resolved',report,' Checked '),{reportId:'report',expectedVersion:2,expectedGeneration:'synthetic-generation',disposition:'resolved',resolutionReason:'Checked'})
 for(const patch of [{observedRevisionIsCurrent:false},{targetState:'erased'},{currentReview:null},{observedPublishedRevision:2}])assert.throws(()=>adminActionPayload('remove',{...report,...patch}),/refresh/)
 assert.throws(()=>adminActionPayload('reject',pending),/invalid-rejection-reason/)
 assert.throws(()=>adminActionPayload('dismissed',report,' '),/reason/)
 assert.throws(()=>adminActionPayload('resolved',report,'x'.repeat(501)),/reason/)
})
test('uncertain retry uses identical payload and request ID without accidental removal',async()=>{
 const calls=[];let fail=true
 const c=createAdminReviewController({reports:true,requestId:()=> 'stable',api:{resolve:async p=>{calls.push(p);if(fail)throw new Error('network')},remove:()=>assert.fail('resolution must not remove')}})
 const original=adminActionPayload('resolved',report,'Reason')
 await c.execute('resolved',original);assert.equal(c.getSnapshot().uncertain,true)
 fail=false;await c.execute('remove',{wrong:true})
 assert.deepEqual(calls,[{...original,requestId:'stable'},{...original,requestId:'stable'}])
 assert.equal(c.getSnapshot().success,'resolved')
})
test('case responses are scoped and sensitive state clears on disposal or authorization denial',async()=>{
 const old=wait();const c=createAdminReviewController({api:{case:({publicReviewId})=>publicReviewId==='old'?old.promise:Promise.resolve({publicReviewId:'new'})}})
 const first=c.read('old');await c.read('new');old.resolve({private:'old'});await first
 assert.deepEqual(c.getSnapshot().item,{publicReviewId:'new'})
 c.dispose();assert.equal(c.getSnapshot().item,null);assert.deepEqual(c.getSnapshot().items,[])
 const pendingResponse=wait(),d=createAdminReviewController({api:{case:()=>pendingResponse.promise}})
 const reading=d.read('id');d.dispose();pendingResponse.resolve({private:'late'});await reading;assert.equal(d.getSnapshot().item,null)
 let deny=false
 const e=createAdminReviewController({api:{case:async()=>{if(deny)throw new Error('admin-required');return {private:'case'}}}})
 await e.read('id');deny=true;await e.read('id');assert.equal(e.getSnapshot().item,null);assert.equal(e.getSnapshot().denied,true)
})
test('version conflicts require refresh, duplicates are disabled and pagination deduplicates',async()=>{
 const deferred=wait();let count=0
 const c=createAdminReviewController({api:{approve:()=>{count++;return deferred.promise}}})
 const action=c.execute('approve',{publicReviewId:'r',expectedVersion:1});await c.execute('approve',{});assert.equal(count,1);deferred.resolve({});await action
 const d=createAdminReviewController({api:{approve:async()=>{throw new Error('review-version-conflict')}}})
 await d.execute('approve',{});assert.equal(d.getSnapshot().error,'refresh');assert.equal(d.getSnapshot().uncertain,false);assert.equal(d.retry(),null)
 const e=createAdminReviewController({api:{queue:async()=>({items:[{publicReviewId:'r'}],nextCursor:'next'})}})
 await e.read();await e.read(null,true);assert.equal(e.getSnapshot().items.length,1)
})


test('Firebase claim checks reject moderator/profile roles and account changes during token refresh',async()=>{
 for(const claims of [{moderator:true},{admin:'true'},{admin:false}]){
  const user={uid:'a',roles:['admin'],getIdTokenResult:async force=>{assert.equal(force,true);return {claims}}}
  assert.equal(await authorizeAdminReviewUser(user,()=>user),false)
 }
 const waitToken=wait();let current={uid:'a',getIdTokenResult:()=>waitToken.promise}
 const checking=authorizeAdminReviewUser(current,()=>current);current={uid:'b'};waitToken.resolve({claims:{admin:true}})
 assert.equal(await checking,false)
 assert.equal(await authorizeAdminReviewUser(null,()=>current),false)
})
test('effect restart reloads safely, and permission denial after a command erases the case',async()=>{
 const c=createAdminReviewController({api:{queue:async()=>({items:[],nextCursor:null}),case:async()=>({private:'case'}),approve:async()=>{throw new Error('admin-required')}}})
 c.dispose();c.start();await new Promise(resolve=>setImmediate(resolve));assert.equal(c.getSnapshot().denied,false)
 await c.read('r');await c.execute('approve',{publicReviewId:'r',expectedVersion:1})
 assert.equal(c.getSnapshot().item,null);assert.deepEqual(c.getSnapshot().items,[]);assert.equal(c.getSnapshot().denied,true)
})


test('rejection sends only explicit reason plus optional private note, matching deployed command codes',async()=>{
 const {CUSTOMER_REVIEW_REJECTION_REASONS}=await import('../../../functions/src/customerReviewModeration.js')
 const {adminRejectionReasons}=await import('../src/utils/adminCustomerReviewModel.js')
 assert.deepEqual(adminRejectionReasons,CUSTOMER_REVIEW_REJECTION_REASONS)
 assert.deepEqual(adminActionPayload('reject',pending,'spam','Private note'),{publicReviewId:'review',expectedVersion:7,rejectionReasonCode:'spam',moderationNote:'Private note'})
 assert.throws(()=>adminActionPayload('reject',pending,'other'),/invalid-rejection-reason/)
 assert.throws(()=>adminActionPayload('reject',pending,'spam','x'.repeat(2001)),/invalid-moderation-note/)
})
