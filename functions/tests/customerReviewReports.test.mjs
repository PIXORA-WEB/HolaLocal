import test from 'node:test'
import assert from 'node:assert/strict'
import { createCustomerReviewReportServices, customerReviewReportId } from '../src/customerReviewReports.js'
import { CustomerReviewFakeDatabase } from './customerReviewFakeDatabase.mjs'
import { fixtureData } from './customerReviewReadFixtures.mjs'
import { compareReviewTime } from '../src/customerReviewTime.js'

function setup() {
  const f=fixtureData('report-test');const review=f.review('published')
  const db=new CustomerReviewFakeDatabase();db.data=f.data
  db.data.set('users/reporter',{accountStatus:'active',deletionRequestedAt:null})
  db.data.set(`customerReviewStats/${f.businessId}`,{sum:4,count:1})
  const identities={reporter:{uid:'reporter',emailVerified:true},admin:{uid:'admin',admin:true},owner:{uid:'owner',emailVerified:true}}
  db.data.set('users/owner',{accountStatus:'active',roles:['business']})
  const readDatabase={readSnapshot:async callback=>{
    const data=structuredClone(db.data)
    return callback({get:async path=>data.get(path)??null,query:async ({collection,filters,order,after,limit})=>{
      const cmp=(a,b)=>compareReviewTime(a[0],b[0])||(a[1]<b[1]?-1:a[1]>b[1]?1:0)
      return [...data].filter(([path,row])=>path.startsWith(`${collection}/`)&&filters.every(([key,value])=>row[key]===value))
        .map(([path,data])=>({id:path.split('/')[1],data})).sort((a,b)=>cmp(order.map(([key])=>a.data[key]),order.map(([key])=>b.data[key])))
        .filter(row=>!after||cmp(order.map(([key])=>row.data[key]),after)>0).slice(0,limit)
    }})
  }}
  const dependencies={database:db,readDatabase,auth:{resolveActor:async token=>identities[token]},clock:()=>1000,
    reportQuotaPolicy:{reserve:({current})=>{if((current?.used??0)>=2)throw new Error('report-quota-exceeded');return {used:(current?.used??0)+1}}}}
  const service=createCustomerReviewReportServices(dependencies)
  const payload={publicReviewId:review.publicReviewId,observedPublishedRevision:1,submittedAt:1000,reasonCode:'spam',details:'Fictional sensitive report details',requestId:'request'}
  const resolve=(report,extra={})=>service.resolve('admin',{reportId:report.reportId,expectedVersion:report.version,expectedGeneration:report.generation,
    requestId:`resolve-${report.version}`,disposition:'dismissed',resolutionReason:'No policy violation in this synthetic example.',moderationNote:'Internal synthetic note',...extra})
  return {...f,review,db,identities,service,payload,resolve,dependencies}
}
const reviewData=s=>structuredClone([...s.db.data].filter(([path])=>!path.startsWith('customerReviewReport')))

test('report auth, exact payload and reasons; owner can report but cannot moderate',async()=>{
  for(const change of [s=>delete s.identities.reporter,s=>{s.identities.reporter.emailVerified=false},
    s=>{s.db.data.get('users/reporter').accountStatus='suspended'},s=>{s.db.data.get('users/reporter').deletionRequestedAt=1}]) {
    const s=setup();change(s);await assert.rejects(s.service.submit('reporter',s.payload));assert.equal(s.db.commits,0)
  }
  const s=setup()
  for(const patch of [{reporterUid:'forged'},{reasonCode:'negative_rating'},{observedPublishedRevision:1.5},{details:null},{details:42},{details:'x'.repeat(2001)}])
    await assert.rejects(s.service.submit('reporter',{...s.payload,...patch}))
  const result=await s.service.submit('owner',s.payload)
  assert.deepEqual(Object.keys(result).sort(),['generation','reportId','status','version'])
  await assert.rejects(s.service.queue('owner',{}),/admin-required/)
  await assert.rejects(s.service.detail('owner',{reportId:result.reportId}),/admin-required/)
  await assert.rejects(s.service.resolve('owner',{reportId:result.reportId,expectedVersion:1,expectedGeneration:result.generation,requestId:'x',disposition:'resolved',resolutionReason:'Handled'}),/admin-required/)
})

test('deterministic open slot, request binding, retry-safe quota and explicit resolution',async()=>{
  assert.notEqual(customerReviewReportId('ab','c'),customerReviewReportId('a','bc'))
  const s=setup();const before=reviewData(s);s.db.retryNext=true
  const report=await s.service.submit('reporter',s.payload);const committed=structuredClone(s.db.data)
  assert.deepEqual(await s.service.submit('reporter',s.payload),report);assert.deepEqual(s.db.data,committed)
  await assert.rejects(s.service.submit('reporter',{...s.payload,details:'different'}),/request-id-conflict/)
  await assert.rejects(s.service.submit('reporter',{...s.payload,requestId:'another'}),/report-already-open/)
  const closed=await s.resolve(report);assert.equal(closed.status,'dismissed')
  const caseDetail=await s.service.detail('admin',{reportId:report.reportId})
  assert.equal(caseDetail.resolution.moderationNote,'Internal synthetic note')
  assert.equal(closed.moderationNote,undefined)
  assert.deepEqual(await s.resolve(report),closed)
  await assert.rejects(s.resolve(report,{requestId:'stale'}),/report-version-conflict/)
  const reopened=await s.service.submit('reporter',{...s.payload,requestId:'reopen'})
  assert.equal(reopened.version,3);await s.resolve(reopened)
  await assert.rejects(s.service.submit('reporter',{...s.payload,requestId:'quota'}),/report-quota-exceeded/)
  assert.deepEqual(reviewData(s),before,'no review visibility, revision, dates or aggregate writes')
  assert.equal([...s.db.data].filter(([p])=>p.startsWith('customerReviewReportAudits/')).length,4)
})

test('stale and unavailable targets deny submission and old replay; cases never fetch private original revisions',async()=>{
  const s=setup();const report=await s.service.submit('reporter',s.payload)
  const publicPath=`customerReviewsPublic/${s.review.publicReviewId}`
  const slotPath=`customerReviewSlots/${s.review.pair}`
  s.db.data.get(publicPath).publishedRevision=2;s.db.data.get(slotPath).publishedRevision=2
  await assert.rejects(s.service.submit('reporter',s.payload),/review-refresh-required/)
  const changed=await s.service.detail('admin',{reportId:report.reportId})
  assert.equal(changed.observedRevisionIsCurrent,false);assert.equal(changed.currentReview.publishedRevision,2)
  assert.equal(changed.reporterUid,undefined);assert.equal(changed.moderationNote,undefined)
  for(const state of ['withdrawn','removed']) {
    s.db.data.delete(publicPath);s.db.data.get(slotPath).publishedRevision=null;s.db.data.get(slotPath).status=state
    await assert.rejects(s.service.submit('reporter',s.payload),/report-target-unavailable/)
    assert.equal((await s.service.detail('admin',{reportId:report.reportId})).currentReview,null)
  }
  s.db.data.delete(`customerReviewIds/${s.review.publicReviewId}`)
  const erased=await s.service.detail('admin',{reportId:report.reportId})
  assert.equal(erased.targetState,'erased');assert.equal(erased.details,null);assert.equal(erased.currentReview,null)
  await s.resolve(report)
})

test('deletion conflict retry fences reporter and author; required quota has no default',async()=>{
  for(const uid of ['reporter','report-test-author']) {
    const s=setup();s.db.retryNext=true;s.db.beforeRetry=()=>s.db.data.set(`accountDeletionRequests/${uid}`,{state:'finalizing'})
    await assert.rejects(s.service.submit('reporter',s.payload),/active-account-required/)
    assert.equal([...s.db.data.keys()].some(p=>p.startsWith('customerReviewReport')),false)
  }
  const s=setup();assert.throws(()=>createCustomerReviewReportServices({...s.dependencies,reportQuotaPolicy:null}),/missing-report-dependency/)
  s.db.data.get(`businesses/${s.businessId}`).status='suspended'
  await assert.rejects(s.service.submit('reporter',s.payload),/report-target-unavailable/)
})

test('admin report queue pagination has bounded scoped cursors and does not expose details or identity',async()=>{
  const s=setup();await s.service.submit('reporter',s.payload);await s.service.submit('owner',s.payload)
  const first=await s.service.queue('admin',{pageSize:1});assert.equal(first.items.length,1)
  const second=await s.service.queue('admin',{pageSize:1,cursor:first.nextCursor})
  assert.notEqual(first.items[0].reportId,second.items[0].reportId);assert.equal(second.nextCursor,null)
  assert.ok(!JSON.stringify(first).includes('sensitive'));assert.equal(first.items[0].reporterUid,undefined)
  for(const patch of [{pageSize:21},{cursor:'bad'},{cursor:Buffer.from(JSON.stringify({v:1,scope:'other',position:[]})).toString('base64url')}])
    await assert.rejects(s.service.queue('admin',patch))
})


test('report text normalization keeps plain text intact and enforces Unicode code-point bounds',async()=>{
  const s=setup();const details='e\u0301'.repeat(2000)
  const filed=await s.service.submit('reporter',{...s.payload,details:`  ${details}  `})
  assert.equal(s.db.data.get(`customerReviewReports/${filed.reportId}`).details,'é'.repeat(2000))
  const other=setup()
  await assert.rejects(other.service.submit('reporter',{...other.payload,details:'😀'.repeat(2001)}),/invalid-report-text/)
  await assert.rejects(other.service.submit('reporter',{...other.payload,details:'\uD800'}),/invalid-report-text/)
  const literal='<b>Fictional text, not markup</b>'
  const result=await other.service.submit('reporter',{...other.payload,details:literal})
  assert.equal((await other.service.detail('admin',{reportId:result.reportId})).details,literal)
})


test('resolution retry cannot write notes after reporter or admin cleanup starts',async()=>{
  for(const uid of ['reporter','admin','report-test-author']) {
    const s=setup();const report=await s.service.submit('reporter',s.payload)
    const before=structuredClone([...s.db.data].filter(([path])=>path.startsWith('customerReviewReport')))
    s.db.retryNext=true;s.db.beforeRetry=()=>s.db.data.set(`accountDeletionRequests/${uid}`,{state:'finalizing'})
    await assert.rejects(s.resolve(report),/active-account-required/)
    assert.deepEqual([...s.db.data].filter(([path])=>path.startsWith('customerReviewReport')),before)
  }
})


test('resolution expiry covers every sensitive copy; explicit new report preserves old expiry',async()=>{
 const s=setup();const first=await s.service.submit('reporter',s.payload)
 await s.resolve(first)
 const copies=[...s.db.data].filter(([p])=>/^customerReviewReport(s|Requests|Audits)\//.test(p))
 assert.equal(copies.length,5)
 for(const [,row] of copies)assert.deepEqual(row.expiresAt,s.db.timestampFromMillis(1000+90*86400000))
 assert.deepEqual(await s.service.submit('reporter',s.payload),first,'old receipt never reopens resolved report')
 const opened=await s.service.submit('reporter',{...s.payload,requestId:'explicit-new'})
 assert.equal(opened.status,'open')
 assert.equal(s.db.data.get(`customerReviewReports/${first.reportId}`).expiresAt,undefined)
 for(const [path,row] of copies.filter(([p])=>!p.startsWith('customerReviewReports/')))assert.deepEqual(s.db.data.get(path),row)
})
test('overdue indicator and retention reads use exact time boundaries; stale pruned retries cannot reopen',async()=>{
 const s=setup();let now=1000
 const service=createCustomerReviewReportServices({...s.dependencies,clock:()=>now})
 const filed=await service.submit('reporter',s.payload)
 now=1000+7*86400000-1
 assert.equal((await service.queue('admin',{})).items[0].overdue,false)
 now++
 assert.equal((await service.detail('admin',{reportId:filed.reportId})).overdue,true)
 assert.equal(s.db.data.get(`customerReviewReports/${filed.reportId}`).status,'open')
 await service.resolve('admin',{reportId:filed.reportId,expectedVersion:1,expectedGeneration:filed.generation,requestId:'close',disposition:'resolved',resolutionReason:'Handled'})
 now+=90*86400000-1
 assert.notEqual(await service.detail('admin',{reportId:filed.reportId}),null)
 now++
 assert.equal(await service.detail('admin',{reportId:filed.reportId}),null)
 for(const path of [...s.db.data.keys()])if(/^customerReviewReport(s|Requests|Audits)\//.test(path))s.db.data.delete(path)
 await assert.rejects(service.submit('reporter',s.payload),/report-request-expired/)
 assert.equal([...s.db.data.keys()].some(p=>p.startsWith('customerReviewReports/')),false)
})

test('admin report business context is an allowlist of currently public data only',async()=>{
 const s=setup();const report=await s.service.submit('reporter',s.payload)
 const business=s.db.data.get(`businesses/${s.businessId}`)
 Object.assign(business,{name:'<img src=x> Synthetic business',privateNotes:'secret'})
 const detail=()=>s.service.detail('admin',{reportId:report.reportId})
 assert.deepEqual((await detail()).businessContext,{businessId:s.businessId,name:business.name})
 assert.equal(JSON.stringify(await detail()).includes('private@example.test'),false)
 assert.equal(JSON.stringify(await detail()).includes('secret'),false)
 business.email='private@example.test'
 assert.equal((await detail()).businessContext,null,'unsafe contact data makes the business unavailable')
 delete business.email
 business.status='suspended'
 assert.equal((await detail()).businessContext,null)
 s.db.data.delete(`businesses/${s.businessId}`)
 assert.equal((await detail()).businessContext,null)
 s.db.data.delete(`customerReviewIds/${s.review.publicReviewId}`)
 assert.equal((await detail()).businessContext,null)
 await assert.rejects(s.service.detail('owner',{reportId:report.reportId}),/admin-required/)
})
