import test from 'node:test'
import assert from 'node:assert/strict'
import { Timestamp } from 'firebase-admin/firestore'
import { cleanupAccountCustomerReviews, customerReviewCleanupPath } from '../src/customerReviewDeletion.js'
import { customerReviewQuotaKey } from '../src/customerReviewCommands.js'
import { FakeFirestore } from './fakeFirestore.mjs'
import { fixtureData } from './customerReviewReadFixtures.mjs'

function setup(states=['published','pending','rejected','withdrawn','removed','edit']) {
  const uid='deleting-user';const db=new FakeFirestore()
  db.store.set(`accountDeletionRequests/${uid}`,{state:'finalizing',leaseId:'lease',requestVersion:4,leaseExpiresAt:Timestamp.fromMillis(10000)})
  const reviews=[]
  for(let i=0;i<states.length;i++) {
    const f=fixtureData(`deletion-${i}`);const review=f.review('target',states[i],uid)
    for(const [path,data] of f.data)db.store.set(path,data)
    const count=review.slot.publishedRevision===null?0:1
    db.store.set(`customerReviewStats/${f.businessId}`,{sum:count*4+5,count:count+1}) // unrelated contribution
    db.store.set(`customerReviewsPublic/unrelated-${i}`,{businessId:f.businessId,rating:5})
    db.store.set(`customerReviewRequests/request-${i}`,{actorUid:uid,outcome:{publicReviewId:review.publicReviewId},privateText:'synthetic old payload'})
    db.store.set(`customerReviewRequests/admin-request-${i}`,{actorUid:'admin',outcome:{publicReviewId:review.publicReviewId}})
    db.store.set(`customerReviewAudits/audit-${i}`,{actorUid:'admin',pair:review.pair,moderationNote:'private synthetic note'})
    reviews.push({...review,businessId:f.businessId})
  }
  db.store.set(`customerReviewQuotas/${customerReviewQuotaKey(uid)}`,{used:12})
  const run=options=>cleanupAccountCustomerReviews({uid,db,leaseId:'lease',expectedRequestVersion:4,now:()=>Timestamp.fromMillis(1000),...options})
  return {uid,db,reviews,run}
}

test('zero reviews complete and remove quota without feature gate',async()=>{
  const s=setup([]);assert.deepEqual(await s.run(),{complete:true})
  assert.deepEqual(s.db.store.get(customerReviewCleanupPath(s.uid)),{complete:true})
  assert.equal(s.db.store.has(`customerReviewQuotas/${customerReviewQuotaKey(s.uid)}`),false)
})
test('all states, more than a batch, immutable text/aliases/receipts/audits erased; unrelated counts preserved',async()=>{
  const s=setup();let result
  for(let attempts=0;attempts<100;attempts++){result=await s.run({maxSteps:2,pageSize:1});if(result.complete)break}
  assert.equal(result.complete,true)
  for(const review of s.reviews) {
    assert.deepEqual(s.db.store.get(`customerReviewStats/${review.businessId}`),{sum:5,count:1})
    assert.equal(s.db.store.has(`customerReviewsPublic/${review.publicReviewId}`),false)
    assert.equal([...s.db.store.keys()].some(path=>path.startsWith(`customerReviewSlots/${review.pair}`)),false)
    assert.equal(s.db.store.has(`customerReviewIds/${review.publicReviewId}`),false)
  }
  assert.equal([...s.db.store.keys()].some(path=>path.startsWith('customerReviewRequests/')||path.startsWith('customerReviewAudits/')),false)
  const before=structuredClone(s.db.store);await s.run();assert.deepEqual(structuredClone(s.db.store),before)
})
test('partial interruption after detach is exactly-once and missing business does not block cleanup',async()=>{
  const s=setup(['edit']);const review=s.reviews[0]
  s.db.store.delete(`businesses/${review.businessId}`)
  assert.equal((await s.run({maxSteps:1})).complete,false)
  assert.equal(s.db.store.get(`customerReviewSlots/${review.pair}`).customerReviewCleanup,true)
  assert.deepEqual(s.db.store.get(`customerReviewStats/${review.businessId}`),{sum:5,count:1})
  const transaction=s.db.runTransaction.bind(s.db)
  s.db.runTransaction=async()=>{throw new Error('synthetic interruption')}
  await assert.rejects(s.run(),/synthetic interruption/)
  s.db.runTransaction=transaction
  assert.equal((await s.run()).complete,true)
  assert.deepEqual(s.db.store.get(`customerReviewStats/${review.businessId}`),{sum:5,count:1})
})
test('cancelled/replaced/expired leases reject before destructive writes; corrupt stats fail closed',async()=>{
  for(const change of [{state:'cancelled'},{leaseId:'new-lease'},{requestVersion:9},{leaseExpiresAt:Timestamp.fromMillis(500)}]) {
    const s=setup(['published']);const path=`accountDeletionRequests/${s.uid}`
    s.db.store.set(path,{...s.db.store.get(path),...change})
    await assert.rejects(s.run(),/workflow-stale/);assert.equal(s.db.writePaths.length,0)
  }
  for(const value of [null,{sum:0,count:0},{sum:99,count:1}]) {
    const s=setup(['published']);const path=`customerReviewStats/${s.reviews[0].businessId}`
    if(value)s.db.store.set(path,value);else s.db.store.delete(path)
    await assert.rejects(s.run());assert.equal(s.db.writePaths.length,0)
  }
})

test('corrupt progress cannot erase another author revision subtree',async()=>{
  const s=setup(['published']);await s.run({maxSteps:1})
  const markerPath=`customerReviewSlots/${s.reviews[0].pair}`
  s.db.store.set(markerPath,{...s.db.store.get(markerPath),authorUid:'different-author'})
  const writes=s.db.writePaths.length
  await assert.rejects(s.run(),/cleanup-integrity/)
  assert.equal(s.db.writePaths.length,writes)
})

test('more than fifty historical audit/receipt records drain without pagination skips',async()=>{
  const s=setup(['published']);const review=s.reviews[0]
  for(let i=0;i<55;i++) {
    s.db.store.set(`customerReviewAudits/extra-${i}`,{pair:review.pair,actorUid:'admin',moderationNote:'synthetic evidence'})
    s.db.store.set(`customerReviewRequests/extra-${i}`,{actorUid:'admin',outcome:{publicReviewId:review.publicReviewId}})
  }
  let complete=false
  for(let attempt=0;attempt<20&&!complete;attempt++)complete=(await s.run({maxSteps:3})).complete
  assert.equal(complete,true)
  assert.equal([...s.db.store.keys()].some(path=>path.startsWith('customerReviewRequests/')||path.startsWith('customerReviewAudits/')),false)
  assert.deepEqual(s.db.store.get(`customerReviewStats/${review.businessId}`),{sum:5,count:1})
})


test('reporter and author erasure drain sensitive report details, receipts, audits and quota in bounded steps',async()=>{
  const s=setup(['published']);const review=s.reviews[0]
  const {customerReviewReportQuotaId}=await import('../src/customerReviewReports.js')
  for(let i=0;i<55;i++) {
    const publicReviewId=i%2?review.publicReviewId:'unrelated-review'
    const reporterUid=i%2?'other-reporter':s.uid
    s.db.store.set(`customerReviewReports/r${i}`,{reporterUid,publicReviewId,details:'Sensitive fictional details'})
    s.db.store.set(`customerReviewReportRequests/r${i}`,{reporterUid,actorUid:'admin',publicReviewId})
    s.db.store.set(`customerReviewReportAudits/r${i}`,{reporterUid,actorUid:'admin',publicReviewId,moderationNote:'Sensitive note'})
  }
  s.db.store.set('customerReviewReports/unrelated',{reporterUid:'other',publicReviewId:'other',details:'Preserved'})
  s.db.store.set(`customerReviewReportQuotas/${customerReviewReportQuotaId(s.uid)}`,{used:30})
  let complete=false
  for(let i=0;i<150&&!complete;i++)complete=(await s.run({maxSteps:2,pageSize:2})).complete
  assert.equal(complete,true)
  assert.deepEqual([...s.db.store.keys()].filter(p=>p.startsWith('customerReviewReport')),['customerReviewReports/unrelated'])
  const before=structuredClone(s.db.store);await s.run();assert.deepEqual(structuredClone(s.db.store),before)
})
