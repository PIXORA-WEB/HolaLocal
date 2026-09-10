import test from 'node:test'
import assert from 'node:assert/strict'
import { fixtureData, fakeReads } from './customerReviewReadFixtures.mjs'

test('public only reads projections and allowlists originals, aliases and precise dates', async () => {
  const f = fixtureData(); f.review('a','edit')
  for (const state of ['pending','rejected','withdrawn','removed']) f.review(state,state,state)
  const { services,reads } = fakeReads(f)
  const result = await services.listPublic({ businessId: f.businessId })
  assert.equal(result.items.length,1); assert.equal(result.items[0].publishedRevision,1)
  assert.deepEqual(result.items[0].publishedAt,{seconds:200,nanoseconds:1000})
  assert.deepEqual(Object.keys(result.items[0]).sort(), ['publicReviewId','publishedRevision','reviewerAlias','rating',
    'originalText','declaredSourceLanguage','publishedAt','updatedAt'].sort())
  assert.ok(reads.every(path => !path.startsWith('customerReviewSlots')))
})

test('public eligibility checked for every page; own status survives unavailable business and ineligible account', async () => {
  const f = fixtureData(); f.review('a','rejected'); f.business.status = 'draft'
  const { services } = fakeReads(f)
  await assert.rejects(services.listPublic({ businessId:f.businessId }), /business-unavailable/)
  const own = await services.getOwn('author',{ businessId:f.businessId })
  assert.equal(own.businessAvailable,false); assert.equal(own.status,'rejected')
  assert.equal(own.guidance,'customer-review-rejected-may-resubmit')
  assert.ok(!JSON.stringify(own).includes('SECRET')); assert.ok(!JSON.stringify(own).includes('DO NOT EXPOSE'))
})

test('author and admin identity cannot be supplied in payload; admin sees both comparison revisions', async () => {
  const f = fixtureData(); f.review('a','edit'); f.review('b','pending','other')
  const { services } = fakeReads(f)
  await assert.rejects(services.getOwn('author',{ businessId:f.businessId,authorUid:'other' }),/invalid-payload/)
  await assert.rejects(services.listOwn({uid:f.uid}),/authentication-required/)
  await assert.rejects(services.listAdminQueue('author'),/admin-required/)
  assert.equal((await services.listOwn('author')).items.length,1)
  const queue = await services.listAdminQueue('admin')
  const comparison = queue.items.find(item => item.published)
  assert.equal(comparison.pending.revision,2); assert.equal(comparison.published.revision,1)
  const detail = await services.getAdminCase('admin',{publicReviewId:comparison.publicReviewId})
  assert.equal(detail.authorUid,undefined); assert.equal(detail.moderationNote,undefined)
})

test('pagination handles ties, page bounds, malformed and cross-scope cursors', async () => {
  const f = fixtureData(); for(let i=0;i<5;i++) f.review(String(i),'published',`author${i}`)
  const {services} = fakeReads(f)
  const first = await services.listPublic({businessId:f.businessId,pageSize:2})
  const next = await services.listPublic({businessId:f.businessId,pageSize:2,cursor:first.nextCursor})
  assert.equal(new Set([...first.items,...next.items].map(item=>item.publicReviewId)).size,4)
  for(const pageSize of [0,21,1.5,'2']) await assert.rejects(services.listPublic({businessId:f.businessId,pageSize}),/invalid-page-size/)
  for(const cursor of ['bad','x'.repeat(4097),Buffer.from(JSON.stringify({v:2})).toString('base64url')]) {
    await assert.rejects(services.listPublic({businessId:f.businessId,cursor}),/invalid-cursor/)
  }
  await assert.rejects(services.listPublic({businessId:'different',cursor:first.nextCursor}),/invalid-cursor/)
  await assert.rejects(services.listOwn('author',{cursor:first.nextCursor}),/invalid-cursor/)
})

test('summary distinguishes zero from unavailable and never uses legacy rating fields', async () => {
  const f=fixtureData();f.business.rating=5;f.business.reviewCount=999
  const {services}=fakeReads(f)
  assert.deepEqual((await services.readRatingSummaries({businessIds:[f.businessId]}))[0],
    {businessId:f.businessId,available:true,average:null,count:0})
  f.data.set(`customerReviewStats/${f.businessId}`,{sum:9,count:2})
  assert.equal((await services.readRatingSummaries({businessIds:[f.businessId]}))[0].average,4.5)
  f.data.set(`customerReviewStats/${f.businessId}`,{sum:99,count:2})
  assert.deepEqual((await services.readRatingSummaries({businessIds:[f.businessId]}))[0],
    {businessId:f.businessId,available:false,average:null,count:null})
  await assert.rejects(services.readRatingSummaries({businessIds:Array(21).fill('x')}),/invalid-batch-size/)
})

test('own pagination cursor is bound to authenticated author and returns no private business fields',async()=>{
  const f=fixtureData();f.review('one')
  const second=fixtureData('second');second.review('two','published',f.uid)
  for(const [path,data] of second.data) f.data.set(path,data)
  const {services}=fakeReads(f)
  const first=await services.listOwn('author',{pageSize:1})
  assert.equal(typeof first.nextCursor,'string')
  const next=await services.listOwn('author',{pageSize:1,cursor:first.nextCursor})
  assert.notEqual(first.items[0].publicReviewId,next.items[0].publicReviewId)
  const other=fakeReads({...f,uid:'another-author'}).services
  await assert.rejects(other.listOwn('author',{cursor:first.nextCursor}),/invalid-cursor/)
  assert.equal(await other.getOwn('author',{businessId:f.businessId}),null)
})

test('Firestore read adapter uses one read-only transaction and exact bounded composite query',async()=>{
  const {createCustomerReviewReadFirestore}=await import('../src/customerReviewReadFirestore.js')
  const calls=[]
  const query={where:(...args)=>{calls.push(['where',...args]);return query},orderBy:(...args)=>{calls.push(['orderBy',...args]);return query},
    startAfter:(...args)=>{calls.push(['startAfter',...args]);return query},limit:n=>{calls.push(['limit',n]);return query}}
  const db=createCustomerReviewReadFirestore({collection:name=>{calls.push(['collection',name]);return query},
    runTransaction:async(callback,options)=>{assert.deepEqual(options,{readOnly:true});return callback({get:async()=>({docs:[]})})}})
  await db.readSnapshot(tx=>tx.query({collection:'customerReviewsPublic',filters:[['businessId','business']],
    order:[['publishedAt','desc'],['publicReviewId','asc']],after:[{seconds:1,nanoseconds:1000},'opaque-review-id-long'],limit:11}))
  assert.deepEqual(calls,[['collection','customerReviewsPublic'],['where','businessId','==','business'],
    ['orderBy','publishedAt','desc'],['orderBy','publicReviewId','asc'],['startAfter',new (await import('firebase-admin/firestore')).Timestamp(1,1000),'opaque-review-id-long'],['limit',11]])
})

test('chronological publication order beats revision count, preserves microseconds, and rejects old cursors',async()=>{
  const f=fixtureData();const a=f.review('a','published','one');const b=f.review('b','published','two');const c=f.review('c','published','three')
  const pa=f.data.get(`customerReviewsPublic/${a.publicReviewId}`)
  const pb=f.data.get(`customerReviewsPublic/${b.publicReviewId}`)
  const pc=f.data.get(`customerReviewsPublic/${c.publicReviewId}`)
  for(const projection of [pa,pb,pc]) projection.updatedAt={seconds:201,nanoseconds:0}
  pa.publishedRevision=99;pa.publishedAt={seconds:200,nanoseconds:1000}
  pb.publishedAt={seconds:200,nanoseconds:2000};pc.publishedAt={seconds:200,nanoseconds:2000}
  const {services}=fakeReads(f)
  const first=await services.listPublic({businessId:f.businessId,pageSize:1})
  assert.equal(first.items[0].publicReviewId,b.publicReviewId)
  const cursor=JSON.parse(Buffer.from(first.nextCursor,'base64url').toString())
  assert.deepEqual(cursor.position[0],{seconds:200,nanoseconds:2000})
  const second=await services.listPublic({businessId:f.businessId,pageSize:1,cursor:first.nextCursor})
  assert.equal(second.items[0].publicReviewId,c.publicReviewId)
  const third=await services.listPublic({businessId:f.businessId,pageSize:1,cursor:second.nextCursor})
  assert.equal(third.items[0].publicReviewId,a.publicReviewId)
  assert.equal(third.nextCursor,null)
  const ids=[...first.items,...second.items,...third.items].map(item=>item.publicReviewId)
  assert.deepEqual(ids,[b.publicReviewId,c.publicReviewId,a.publicReviewId])
  assert.equal(new Set(ids).size,3)
  for(const nanos of [-1,1000000000,1.2]) {
    const bad={...cursor,position:[{seconds:200,nanoseconds:nanos},b.publicReviewId]}
    await assert.rejects(services.listPublic({businessId:f.businessId,cursor:Buffer.from(JSON.stringify(bad)).toString('base64url')}),/invalid-cursor/)
  }
  cursor.v=1
  await assert.rejects(services.listPublic({businessId:f.businessId,cursor:Buffer.from(JSON.stringify(cursor)).toString('base64url')}),/restart-pagination/)
})

test('queue sorts oldest pending timestamp and own list newest lifecycle activity',async()=>{
  const f=fixtureData();const a=f.review('a','pending');const b=f.review('b','pending','other')
  const state=f.data.get(`customerReviewSlots/${b.pair}`)
  state.pendingSubmittedAt={seconds:101,nanoseconds:0}
  f.data.get(`customerReviewSlots/${b.pair}/revisions/1`).submittedAt=state.pendingSubmittedAt
  const second=fixtureData('second');const c=second.review('c','published',f.uid)
  second.data.get(`customerReviewSlots/${c.pair}`).updatedAt={seconds:400,nanoseconds:1000}
  for(const [path,value] of second.data)f.data.set(path,value)
  const {services}=fakeReads(f)
  assert.equal((await services.listAdminQueue('admin')).items[0].publicReviewId,a.publicReviewId)
  assert.equal((await services.listOwn('author')).items[0].publicReviewId,c.publicReviewId)
})


test('temporary eligibility loss hides every public page and summary without erasing review data', async () => {
  const f=fixtureData();f.review('a','edit');f.review('b','published','other');f.review('c','pending','pending-author')
  f.data.set(`customerReviewStats/${f.businessId}`,{sum:8,count:2})
  const {services,reads}=fakeReads(f)
  const first=await services.listPublic({businessId:f.businessId,pageSize:1})
  const preserved=structuredClone([...f.data].filter(([path])=>!path.startsWith('businesses/')))
  for(const patch of [{status:'suspended'},{status:'archived'},{status:'deleted'},{publishedAt:null},
    {deletedAt:1},{deletionRequestedAt:1},{description:''},null]) {
    const original=structuredClone(f.business)
    if(patch===null)f.data.delete(`businesses/${f.businessId}`)
    else f.data.set(`businesses/${f.businessId}`,{...original,...patch})
    reads.length=0
    for(const cursor of [undefined,first.nextCursor])
      await assert.rejects(services.listPublic({businessId:f.businessId,...(cursor?{cursor}:{})}),/business-unavailable/)
    assert.deepEqual(await services.readRatingSummaries({businessIds:[f.businessId]}),
      [{businessId:f.businessId,available:false,average:null,count:null}])
    assert.ok(!reads.includes('customerReviewsPublic'))
    assert.ok(!reads.includes(`customerReviewStats/${f.businessId}`),'public summary must not even read hidden stats')
    const own=await services.getOwn('author',{businessId:f.businessId})
    assert.equal(own.businessAvailable,false);assert.equal(own.pending.revision,2);assert.equal(own.published.revision,1)
    f.data.set(`businesses/${f.businessId}`,original)
    const restored=await services.listPublic({businessId:f.businessId})
    assert.equal(restored.items.length,2);assert.ok(restored.items.every(item=>item.publishedRevision===1))
    assert.equal((await services.readRatingSummaries({businessIds:[f.businessId]}))[0].count,2)
    assert.deepEqual([...f.data].filter(([path])=>!path.startsWith('businesses/')),preserved)
  }
})

test('author-safe rejection is revision scoped, never derived from internal notes',async()=>{
 const f=fixtureData(),review=f.review('reason','rejected'),path=`customerReviewSlots/${review.pair}`
 const {services}=fakeReads(f)
 assert.equal((await services.getOwn('author',{businessId:f.businessId})).rejection,null)
 f.data.get(path).rejection={revision:1,reasonCode:'personal_information'}
 const own=await services.getOwn('author',{businessId:f.businessId})
 assert.deepEqual(own.rejection,{revision:1,reasonCode:'personal_information'})
 assert.ok(!JSON.stringify(own).includes('SECRET NOTE'))
 assert.equal(own.pendingSubmittedAt,undefined)
 const admin=await services.getAdminCase('admin',{publicReviewId:review.publicReviewId})
 assert.deepEqual(admin.rejection,own.rejection);assert.ok(!JSON.stringify(admin).includes('SECRET NOTE'))
 f.data.get(path).rejection={revision:999,reasonCode:'spam'}
 await assert.rejects(services.getOwn('author',{businessId:f.businessId}),/inconsistent-review-rejection/)
})
test('admin dates identify pending revision submission and previous publication without changing cursor precision',async()=>{
 const f=fixtureData(),review=f.review('dates','edit'),{services}=fakeReads(f)
 const result=await services.getAdminCase('admin',{publicReviewId:review.publicReviewId})
 assert.deepEqual(result.pendingSubmittedAt,{seconds:250,nanoseconds:1000})
 assert.deepEqual(result.publicationDates,{publishedAt:{seconds:200,nanoseconds:1000},updatedAt:{seconds:200,nanoseconds:1000}})
 const queue=await services.listAdminQueue('admin',{})
 assert.deepEqual(queue.items[0].pendingSubmittedAt,result.pendingSubmittedAt)
 delete f.data.get(`customerReviewSlots/${review.pair}/revisions/2`).submittedAt
 assert.equal((await services.getAdminCase('admin',{publicReviewId:review.publicReviewId})).pendingSubmittedAt,null)
})
