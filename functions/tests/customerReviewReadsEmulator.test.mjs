import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { moderateBusiness } from '../src/businessModeration.js'
import { assertCallableBoundaryEnvironment } from '../scripts/runIsolatedEmulatorTests.mjs'
import { createCustomerReviewReadServices } from '../src/customerReviewReads.js'
import { createCustomerReviewReadFirestore } from '../src/customerReviewReadFirestore.js'
import { fixtureData, helpers, isPublicBusinessEligible, syntheticAuth } from './customerReviewReadFixtures.mjs'

if (process.env.HOLALOCAL_CALLABLE_BOUNDARY !== '1') {
  test('customer review read/rules emulator gate', {skip:'NOT RUN: protected demo workflow required'},()=>{})
} else {
  assertCallableBoundaryEnvironment()
  const {initializeApp,deleteApp}=await import('firebase-admin/app')
  const {getFirestore,Timestamp}=await import('firebase-admin/firestore')
  const app=initializeApp({projectId:'demo-holalocal-functions'},`review-reads-${randomUUID()}`)
  const firestore=getFirestore(app)
  test.after(async()=>{await firestore.terminate();await deleteApp(app)})
  async function setup() {
    const f=fixtureData(randomUUID())
    f.review('edit','edit')
    for(const state of ['pending','rejected','withdrawn','removed']) f.review(state,state,`${f.uid}-${state}`)
    for(let i=0;i<4;i++) f.review(`published-${i}`,'published',`${f.uid}-${i}`)
    const batch=firestore.batch()
    const nativeDates=value=>{
      if(value&&typeof value==='object'&&Number.isInteger(value.seconds)&&Number.isInteger(value.nanoseconds)) return new Timestamp(value.seconds,value.nanoseconds)
      if(Array.isArray(value))return value.map(nativeDates)
      if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,child])=>[key,nativeDates(child)]))
      return value
    }
    for(const [path,value] of f.data) batch.set(firestore.doc(path),nativeDates(value))
    await batch.commit()
    const services=createCustomerReviewReadServices({helpers,isPublicBusinessEligible,
      auth:syntheticAuth(f.uid),database:createCustomerReviewReadFirestore(firestore)})
    return {...f,services}
  }
  test('Admin SDK: public projection privacy, lifecycle exclusion, ties and cursor scope',async()=>{
    const f=await setup();const s=f.services
    const first=await s.listPublic({businessId:f.businessId,pageSize:2})
    const second=await s.listPublic({businessId:f.businessId,pageSize:2,cursor:first.nextCursor})
    const third=await s.listPublic({businessId:f.businessId,pageSize:2,cursor:second.nextCursor})
    const items=[...first.items,...second.items,...third.items]
    assert.equal(items.length,5);assert.equal(new Set(items.map(item=>item.publicReviewId)).size,5)
    assert.ok(items.every(item=>item.authorUid===undefined&&item.moderationNote===undefined&&item.email===undefined))
    assert.equal(items.find(item=>item.publicReviewId.endsWith('-edit')).publishedRevision,1)
    await assert.rejects(s.listPublic({businessId:'other',cursor:first.nextCursor}),/invalid-cursor/)
    await assert.rejects(s.listPublic({businessId:f.businessId,pageSize:21}),/invalid-page-size/)
    await assert.rejects(s.listPublic({businessId:f.businessId,cursor:'invalid'}),/invalid-cursor/)
    const moderate=operation=>moderateBusiness({uid:'synthetic-moderator',claims:{moderator:true},
      businessId:f.businessId,operation,requestId:randomUUID(),db:firestore})
    await moderate('suspend')
    await assert.rejects(s.listPublic({businessId:f.businessId,cursor:first.nextCursor}),/business-unavailable/)
    const own=await s.getOwn('author',{businessId:f.businessId})
    assert.equal(own.businessAvailable,false);assert.equal(own.pending.revision,2)
    await moderate('restore')
    const restoredSecond=await s.listPublic({businessId:f.businessId,pageSize:2,cursor:first.nextCursor})
    assert.deepEqual(restoredSecond,second,'business restoration does not change review chronology or reveal pending content')
  })
  test('Admin SDK: trusted author/admin boundaries and bounded pending/published comparison',async()=>{
    const f=await setup();const s=f.services
    await assert.rejects(s.listOwn({uid:f.uid}),/authentication-required/)
    await assert.rejects(s.getOwn('author',{businessId:f.businessId,authorUid:'other'}),/invalid-payload/)
    await assert.rejects(s.listAdminQueue('author'),/admin-required/)
    const mine=await s.listOwn('author');assert.equal(mine.items.length,1)
    const own=mine.items[0];assert.equal(own.pending.revision,2);assert.equal(own.published.revision,1)
    const detail=await s.getAdminCase('admin',{publicReviewId:own.publicReviewId})
    assert.equal(detail.authorUid,undefined);assert.equal(detail.moderationNote,undefined)
    // Queue is global across synthetic tests; exercise cursor without assuming global counts.
    const queue=await s.listAdminQueue('admin',{pageSize:1})
    assert.equal(queue.items.length,1);assert.equal(queue.items[0].status,'pending')
    if(queue.nextCursor) {
      const next=await s.listAdminQueue('admin',{pageSize:1,cursor:queue.nextCursor})
      assert.notEqual(next.items[0].publicReviewId,queue.items[0].publicReviewId)
    }
  })
  test('Admin SDK: missing/malformed authoritative stats never use legacy ratings',async()=>{
    const f=await setup();const input={businessIds:[f.businessId]}
    assert.equal((await f.services.readRatingSummaries(input))[0].count,0)
    await firestore.doc(`customerReviewStats/${f.businessId}`).set({sum:99,count:1})
    assert.deepEqual((await f.services.readRatingSummaries(input))[0],{businessId:f.businessId,available:false,average:null,count:null})
    await firestore.doc(`customerReviewStats/${f.businessId}`).set({sum:9,count:2})
    assert.equal((await f.services.readRatingSummaries(input))[0].average,4.5)
  })
  test('Admin SDK: persisted microsecond cursors preserve chronology, ties and complete pagination',async()=>{
    const f=await setup()
    const rows=[...f.data.keys()].filter(path=>path.startsWith('customerReviewsPublic/')).sort()
    // SDK accepts nanoseconds; storage rounds down to microseconds before reads/cursors.
    const finerInput=new Timestamp(500,2999)
    assert.equal(finerInput.nanoseconds,2999)
    await firestore.doc(rows[0]).update({publishedAt:finerInput})
    assert.equal((await firestore.doc(rows[0]).get()).data().publishedAt.nanoseconds,2000)
    const persisted=new Map()
    for(let i=0;i<rows.length;i++) {
      const nanoseconds=i<2?2000:1000 // two distinct microseconds inside the SAME millisecond
      await firestore.doc(rows[i]).update({publishedAt:new Timestamp(500,nanoseconds),updatedAt:new Timestamp(600,0),publishedRevision:i+1})
      const stored=(await firestore.doc(rows[i]).get()).data().publishedAt
      assert.deepEqual({seconds:stored.seconds,nanoseconds:stored.nanoseconds},{seconds:500,nanoseconds})
      persisted.set(rows[i].split('/')[1],stored)
    }
    const expected=rows.map(path=>path.split('/')[1]) // newer group first; ID resolves each timestamp tie
    let firstCursor
    for(const pageSize of [1,2]) {
      const seen=[];let cursor
      do {
        const page=await f.services.listPublic({businessId:f.businessId,pageSize,...(cursor?{cursor}:{})})
        assert.ok(page.items.length>0)
        for(const item of page.items) {
          const stored=persisted.get(item.publicReviewId)
          assert.deepEqual(item.publishedAt,{seconds:stored.seconds,nanoseconds:stored.nanoseconds})
          seen.push(item.publicReviewId)
        }
        assert.ok(seen.length<=expected.length,'pagination must terminate without repeated rows')
        cursor=page.nextCursor
        if(cursor) {
          firstCursor ??= cursor
          const decoded=JSON.parse(Buffer.from(cursor,'base64url').toString())
          const last=page.items.at(-1);const stored=persisted.get(last.publicReviewId)
          assert.deepEqual(decoded.position,[{seconds:stored.seconds,nanoseconds:stored.nanoseconds},last.publicReviewId])
        }
      } while(cursor)
      assert.deepEqual(seen,expected,'every row exactly once, including the microsecond boundary and ties')
      assert.equal(new Set(seen).size,expected.length)
    }
    // Older rows have HIGHER revision counts: publication dates, not revisions, control order.
    const decoded=JSON.parse(Buffer.from(firstCursor,'base64url').toString())
    assert.deepEqual(decoded.position[0],{seconds:500,nanoseconds:2000})
    decoded.v=1
    await assert.rejects(f.services.listPublic({businessId:f.businessId,cursor:Buffer.from(JSON.stringify(decoded)).toString('base64url')}),/restart-pagination/)
  })
  test('CLIENT RULES via emulator REST: anonymous and authenticated collection reads/writes denied',async()=>{
    // Explicit loopback-only URLs. No Admin token/owner bypass is used for these requests.
    const response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=synthetic-key',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({returnSecureToken:true})})
    assert.equal(response.status,200)
    const {idToken}=await response.json();assert.equal(typeof idToken,'string')
    const root='http://127.0.0.1:8080/v1/projects/demo-holalocal-functions/databases/(default)/documents'
    const collections=['customerReviewSlots','customerReviewIds','customerReviewsPublic','customerReviewStats',
      'customerReviewQuotas','customerReviewRequests','customerReviewAudits',
      'customerReviewReports','customerReviewReportRequests','customerReviewReportAudits','customerReviewReportQuotas','customerReviewSlots/synthetic/revisions']
    for(const token of [null,idToken]) for(const collection of collections) {
      const headers={'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})}
      for(const [method,path] of [['GET',collection],['GET',`${collection}/synthetic`],['PATCH',`${collection}/synthetic`]]) {
        const result=await fetch(`${root}/${path}`,{method,headers,
          ...(method==='PATCH'?{body:JSON.stringify({fields:{synthetic:{booleanValue:true}}})}:{})})
        assert.equal(result.status,403,`${method} ${collection}: must be denied`)
        assert.equal((await result.json()).error.status,'PERMISSION_DENIED')
      }
    }
  })
}
