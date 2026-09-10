import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {assertCallableBoundaryEnvironment} from '../scripts/runIsolatedEmulatorTests.mjs'
import {fixtureData} from './customerReviewReadFixtures.mjs'
import {cleanupAccountCustomerReviews,customerReviewCleanupPath} from '../src/customerReviewDeletion.js'
import {createCustomerReviewCommands} from '../src/customerReviewCommands.js'
import {createCustomerReviewFirestoreDatabase,readCustomerReviewFirestoreEligibility} from '../src/customerReviewFirestore.js'
import * as contracts from '@holalocal/firebase-contract/customerReviewContracts'
import * as lifecycle from '@holalocal/firebase-contract/customerReviewLifecycle'

if(process.env.HOLALOCAL_CALLABLE_BOUNDARY!=='1') {
  test('review account deletion emulator gate',{skip:'protected demo workflow required'},()=>{})
} else {
  assertCallableBoundaryEnvironment()
  const {initializeApp,deleteApp}=await import('firebase-admin/app')
  const {getFirestore,Timestamp}=await import('firebase-admin/firestore')
  const {getAuth}=await import('firebase-admin/auth')
  const app=initializeApp({projectId:'demo-holalocal-functions'},`review-deletion-${randomUUID()}`)
  const db=getFirestore(app);const auth=getAuth(app)
  test.after(async()=>{await db.terminate();await deleteApp(app)})
  const native=value=>{
    if(value&&Number.isInteger(value.seconds)&&Number.isInteger(value.nanoseconds))return new Timestamp(value.seconds,value.nanoseconds)
    if(Array.isArray(value))return value.map(native)
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,child])=>[key,native(child)]))
    return value
  }
  async function seed(uid,states) {
    const reviews=[]
    for(let i=0;i<states.length;i++) {
      const f=fixtureData(randomUUID());const review=f.review('target',states[i],uid)
      const batch=db.batch()
      for(const [path,value] of f.data)batch.set(db.doc(path),native(value))
      batch.set(db.doc(`customerReviewStats/${f.businessId}`),{sum:(review.slot.publishedRevision===null?0:4)+5,count:(review.slot.publishedRevision===null?0:1)+1})
      batch.set(db.doc(`customerReviewsPublic/control-${f.businessId}`),{businessId:f.businessId,rating:5})
      batch.set(db.doc(`customerReviewRequests/${f.businessId}`),{actorUid:uid,outcome:{publicReviewId:review.publicReviewId}})
      batch.set(db.doc(`customerReviewAudits/${f.businessId}`),{actorUid:'admin',pair:review.pair,moderationNote:'synthetic private note'})
      await batch.commit();reviews.push({...review,businessId:f.businessId})
    }
    return reviews
  }
  async function identity(uid,admin=false) {
    const email=`${uid}@example.invalid`;const password='Synthetic-deletion-password-49!'
    await auth.createUser({uid,email,password,emailVerified:true})
    if(admin)await auth.setCustomUserClaims(uid,{admin:true})
    await db.doc(`users/${uid}`).set({accountStatus:'active',roles:['customer'],businessId:null,deletionRequestedAt:null,
      termsAccepted:true,termsVersion:'1.0',termsAcceptedAt:Timestamp.now(),privacyAccepted:true,privacyVersion:'1.0',privacyAcceptedAt:Timestamp.now()})
    const response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-only',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})})
    assert.equal(response.status,200);return (await response.json()).idToken
  }
  async function call(name,data,token) {
    const response=await fetch(`http://127.0.0.1:5001/demo-holalocal-functions/europe-west1/${name}`,{
      method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({data})})
    const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));return body.result
  }
  const commandCore=uid=>createCustomerReviewCommands({helpers:{...contracts,...lifecycle},database:createCustomerReviewFirestoreDatabase(db),
    auth:{resolveActor:async who=>who==='admin'?{uid:'synthetic-review-admin',admin:true}:{uid,emailVerified:true},loadAuthorIdentity:async()=>({uid,emailVerified:true})},
    readEligibility:readCustomerReviewFirestoreEligibility,aliasPolicy:{choose:()=> 'Synthetic alias'},quotaPolicy:{reserve:()=>({used:1})}})

  test('HTTP account deletion: cancel preserves all review data; finalization drains batches before Firestore/Auth removal',async()=>{
    const uid=`deleting-${randomUUID()}`;const token=await identity(uid)
    const adminToken=await identity(`admin-${randomUUID()}`,true)
    const reviews=await seed(uid,['published','pending','rejected','withdrawn','removed','edit'])
    const reviewSnapshot=async()=>Promise.all(reviews.flatMap(review=>[
      `customerReviewSlots/${review.pair}`,`customerReviewIds/${review.publicReviewId}`,`customerReviewsPublic/${review.publicReviewId}`,
      `customerReviewStats/${review.businessId}`,`customerReviewRequests/${review.businessId}`,`customerReviewAudits/${review.businessId}`,
      ...review.slot.revisions.map(revision=>`customerReviewSlots/${review.pair}/revisions/${revision.revision}`),
    ]).map(async path=>{const doc=await db.doc(path).get();return {path,exists:doc.exists,data:doc.data()}}))

    const first=reviews[0];await db.doc(`customerReviewsPublic/${first.publicReviewId}`).update({translationCache:{providerVersion:'test-v1',publishedRevision:1,entries:{es:{status:'translated',translatedText:'Synthetic cached translation'}}}})
    const before=(await db.doc(`customerReviewsPublic/${first.publicReviewId}`).get()).data()
    const allBefore=await reviewSnapshot()
    const revisionBefore=(await db.doc(`customerReviewSlots/${first.pair}/revisions/1`).get()).data()
    await call('requestAccountDeletion',{},token)
    const core=commandCore(uid)
    await assert.rejects(core.submit('author',{businessId:first.businessId,expectedVersion:first.slot.version,requestId:'blocked',rating:5,displayName:'Test reviewer',originalText:'Synthetic attempt during pending deletion.'}),/active-account-required/)
    const pending=reviews[1]
    await assert.rejects(core.approve('admin',{publicReviewId:pending.publicReviewId,expectedVersion:pending.slot.version,requestId:'blocked-approval'}),/active-account-required/)
    await call('cancelAccountDeletion',{},token)
    assert.deepEqual(await reviewSnapshot(),allBefore)
    assert.deepEqual((await db.doc(`customerReviewsPublic/${first.publicReviewId}`).get()).data(),before)
    assert.deepEqual((await db.doc(`customerReviewSlots/${first.pair}/revisions/1`).get()).data(),revisionBefore)
    const requested=await call('requestAccountDeletion',{},token)
    let version=requested.request.requestVersion;let result
    for(let attempt=0;attempt<10;attempt++) {
      result=await call('finalizeAccountDeletion',{uid,expectedRequestVersion:version},adminToken)
      if(result.state==='completed')break
      assert.equal(result.state,'failed_retryable')
      assert.equal((await db.doc(`users/${uid}`).get()).exists,true)
      assert.ok(await auth.getUser(uid));version=result.requestVersion
    }
    assert.equal(result.state,'completed')
    assert.equal((await db.doc(`users/${uid}`).get()).exists,false)
    await assert.rejects(auth.getUser(uid),error=>error.code==='auth/user-not-found')
    for(const review of reviews) {
      assert.equal((await db.doc(`customerReviewsPublic/${review.publicReviewId}`).get()).exists,false)
      assert.equal((await db.collection(`customerReviewSlots/${review.pair}/revisions`).get()).empty,true)
      assert.equal((await db.doc(`customerReviewIds/${review.publicReviewId}`).get()).exists,false)
      assert.deepEqual((await db.doc(`customerReviewStats/${review.businessId}`).get()).data(),{sum:5,count:1})
      assert.equal((await db.collection('customerReviewAudits').where('pair','==',review.pair).get()).empty,true)
      assert.equal((await db.collection('customerReviewRequests').where('outcome.publicReviewId','==',review.publicReviewId).get()).empty,true)
    }
    assert.equal((await call('finalizeAccountDeletion',{uid,expectedRequestVersion:result.requestVersion},adminToken)).idempotent,true)
  })

  test('real transactions: cleanup works gate-off, handles missing business and races withdrawal/approval',async()=>{
    const uid=`cleanup-${randomUUID()}`;await identity(uid)
    const [review]=await seed(uid,['edit']);const core=commandCore(uid)
    await db.doc(`users/${uid}`).update({deletionRequestedAt:Timestamp.now()})
    await db.doc(`accountDeletionRequests/${uid}`).set({state:'finalizing',leaseId:'lease',requestVersion:4,leaseExpiresAt:Timestamp.fromMillis(Date.now()+600000)})
    const run=options=>cleanupAccountCustomerReviews({uid,db,leaseId:'lease',expectedRequestVersion:4,...options})
    const previous=process.env.CUSTOMER_REVIEWS_ENABLED;process.env.CUSTOMER_REVIEWS_ENABLED='false'
    try {
      const results=await Promise.allSettled([run({maxSteps:1}),core.withdraw('author',{publicReviewId:review.publicReviewId,expectedVersion:review.slot.version,requestId:'race-withdraw'}),
        core.approve('admin',{publicReviewId:review.publicReviewId,expectedVersion:review.slot.version,requestId:'race-approval'})])
      assert.equal(results[0].status,'fulfilled');assert.equal(results[2].status,'rejected')
      await db.doc(`businesses/${review.businessId}`).delete()
      assert.equal((await run()).complete,true)
      assert.deepEqual((await db.doc(`customerReviewStats/${review.businessId}`).get()).data(),{sum:5,count:1})
      assert.equal((await run()).complete,true)
      assert.deepEqual((await db.doc(customerReviewCleanupPath(uid)).get()).data(),{complete:true})
    } finally {process.env.CUSTOMER_REVIEWS_ENABLED=previous}
  })
  test('real transactions: corrupt counters block erasure; replacement lease resumes bounded cleanup',async()=>{
    const uid=`corrupt-${randomUUID()}`;const [review]=await seed(uid,['published'])
    const ref=db.doc(`accountDeletionRequests/${uid}`)
    await ref.set({state:'finalizing',leaseId:'lease',requestVersion:4,leaseExpiresAt:Timestamp.fromMillis(Date.now()+600000)})
    const run=leaseId=>cleanupAccountCustomerReviews({uid,db,leaseId,expectedRequestVersion:4,pageSize:1})
    await db.doc(`customerReviewStats/${review.businessId}`).set({sum:0,count:0})
    await assert.rejects(run('lease'));assert.equal((await db.doc(`customerReviewsPublic/${review.publicReviewId}`).get()).exists,true)
    await db.doc(`customerReviewStats/${review.businessId}`).set({sum:9,count:2})
    await cleanupAccountCustomerReviews({uid,db,leaseId:'lease',expectedRequestVersion:4,maxSteps:1})
    await ref.update({leaseId:'replacement'})
    await assert.rejects(run('lease'),/workflow-stale/)
    assert.equal((await run('replacement')).complete,true)
  })
}
