import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { assertCallableBoundaryEnvironment } from '../scripts/runIsolatedEmulatorTests.mjs'

if(process.env.HOLALOCAL_CALLABLE_BOUNDARY!=='1') {
  test('customer review callable HTTP gate',{skip:'NOT RUN: protected demo workflow required'},()=>{})
} else {
  assertCallableBoundaryEnvironment()
  assert.equal(process.env.CUSTOMER_REVIEWS_ENABLED,'true')
  const {initializeApp,deleteApp}=await import('firebase-admin/app')
  const {getFirestore}=await import('firebase-admin/firestore')
  const {getAuth}=await import('firebase-admin/auth')
  const app=initializeApp({projectId:'demo-holalocal-functions'},`review-callables-${randomUUID()}`)
  const db=getFirestore(app);const auth=getAuth(app)
  test.after(async()=>{await db.terminate();await deleteApp(app)})
  const prefix=randomUUID();const businessId=`callable-business-${prefix}`
  const tokens={};const ids={}
  async function user(role,{verified=true,status='active',roles=['customer'],admin=false}={}) {
    const uid=`${prefix}-${role}`;ids[role]=uid
    const email=`${uid}@example.invalid`;const password='Fictional-test-password-47!'
    await auth.createUser({uid,email,password,emailVerified:verified})
    if(admin)await auth.setCustomUserClaims(uid,{admin:true})
    await db.doc(`users/${uid}`).set({accountStatus:status,roles,deletionRequestedAt:null})
    const response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-only',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})})
    assert.equal(response.status,200)
    tokens[role]=(await response.json()).idToken
  }
  async function invoke(name,data,role) {
    const response=await fetch(`http://127.0.0.1:5001/demo-holalocal-functions/europe-west1/${name}`,{
      method:'POST',headers:{'content-type':'application/json',...(role?{authorization:`Bearer ${tokens[role]}`}:{})},body:JSON.stringify({data})})
    return {status:response.status,body:await response.json()}
  }
  function ok(result) {assert.equal(result.status,200,JSON.stringify(result.body));return result.body.result}
  function denied(result,code) {assert.notEqual(result.status,200);assert.equal(result.body.error.status,code);assert.equal(result.body.error.details,undefined)}

  test('callable wrapper: default-disabled configuration rejects before constructing review dependencies',async()=>{
    const {onCall}=await import('firebase-functions/v2/https')
    const {createCustomerReviewCallableHandler}=await import('../src/customerReviewCallables.js')
    const disabled=onCall({region:'europe-west1'},createCustomerReviewCallableHandler('listPublishedCustomerReviews',{
      env:{},createServices:()=>{throw new Error('must not construct')}}))
    await assert.rejects(disabled.run({data:{businessId,CUSTOMER_REVIEWS_ENABLED:true}}),error=>error.message==='customer-reviews-disabled')
    // Direct wrapper test; enabled lifecycle below traverses the real emulator HTTP boundary.
  })
  test('HTTP callables: real authentication, moderation, pagination, safe errors and withdrawal',async()=>{
    await user('customer');await user('other');await user('unverified',{verified:false});await user('inactive',{status:'suspended'})
    await user('owner',{roles:['customer','business']});await user('manager',{roles:['customer','business']});await user('admin',{roles:['admin'],admin:true})
    await db.doc(`businesses/${businessId}`).set({ownerId:ids.owner,managerIds:[ids.owner,ids.manager],
      name:'Fictional callable service',description:'Synthetic isolated test business',primaryCategoryId:'home',categoryIds:['home'],
      serviceAreas:['Madrid'],languages:['en'],primaryLanguage:'en',status:'active',publishedAt:1,
      location:{locality:'Madrid',region:'Madrid',countryCode:'ES'}})
    const payload={businessId,requestId:'first',expectedVersion:0,rating:4,originalText:'Fictional review describing thoughtful and helpful service.'}
    assert.equal(ok(await invoke('listPublishedCustomerReviews',{businessId})).items.length,0)
    denied(await invoke('submitCustomerReview',payload),'UNAUTHENTICATED')
    for(const role of ['unverified','inactive'])denied(await invoke('submitCustomerReview',payload,role),'FAILED_PRECONDITION')
    for(const role of ['owner','manager'])denied(await invoke('submitCustomerReview',payload,role),'PERMISSION_DENIED')
    denied(await invoke('submitCustomerReview',{...payload,authorUid:ids.other},'customer'),'INVALID_ARGUMENT')
    const pending=ok(await invoke('submitCustomerReview',payload,'customer'))
    assert.deepEqual(ok(await invoke('submitCustomerReview',payload,'customer')),pending)
    denied(await invoke('submitCustomerReview',{...payload,rating:5},'customer'),'ALREADY_EXISTS')
    const moderate={publicReviewId:pending.publicReviewId,expectedVersion:pending.version,requestId:'approve-first'}
    denied(await invoke('approveCustomerReview',moderate,'customer'),'PERMISSION_DENIED')
    const approved=ok(await invoke('approveCustomerReview',moderate,'admin'))
    denied(await invoke('approveCustomerReview',{...moderate,requestId:'stale'},'admin'),'ABORTED')
    assert.equal(ok(await invoke('getOwnCustomerReview',{businessId},'other')),null)
    denied(await invoke('getOwnCustomerReview',{businessId,authorUid:ids.customer},'other'),'INVALID_ARGUMENT')
    const publicFirst=ok(await invoke('listPublishedCustomerReviews',{businessId})).items[0]
    assert.equal(publicFirst.rating,4)
    assert.deepEqual(ok(await invoke('getCustomerReviewRatingSummaries',{businessIds:[businessId]})),[{businessId,available:true,average:4,count:1}])
    denied(await invoke('getCustomerReviewRatingSummaries',{businessIds:Array(21).fill(businessId)}),'INVALID_ARGUMENT')
    assert.deepEqual(Object.keys(publicFirst).sort(),['publicReviewId','publishedRevision','reviewerAlias','rating','originalText','declaredSourceLanguage','publishedAt','updatedAt'].sort())
    const edit=ok(await invoke('editCustomerReview',{...payload,expectedVersion:approved.version,requestId:'edit',rating:2},'customer'))
    assert.deepEqual(ok(await invoke('listPublishedCustomerReviews',{businessId})).items[0],publicFirst)
    const own=ok(await invoke('getOwnCustomerReview',{businessId},'customer'))
    assert.equal(own.pending.rating,2);assert.equal(own.published.rating,4)
    const caseDetail=ok(await invoke('getCustomerReviewModerationCase',{publicReviewId:pending.publicReviewId},'admin'))
    assert.equal(caseDetail.pending.rating,2);assert.equal(caseDetail.authorUid,undefined)
    denied(await invoke('listCustomerReviewModerationQueue',{},'customer'),'PERMISSION_DENIED')
    const queue=ok(await invoke('listCustomerReviewModerationQueue',{pageSize:1},'admin'))
    assert.ok(queue.items.every(item=>item.status==='pending'))
    denied(await invoke('rejectCustomerReview',{publicReviewId:pending.publicReviewId,expectedVersion:edit.version,requestId:'no-reason'},'admin'),'INVALID_ARGUMENT')
    assert.ok(caseDetail.pendingSubmittedAt)
    assert.deepEqual(caseDetail.publicationDates,{publishedAt:publicFirst.publishedAt,updatedAt:publicFirst.updatedAt})
    // Other protected test cases may also have pending records. Walk bounded pages to find this case.
    let queueMatch=queue.items.find(item=>item.publicReviewId===pending.publicReviewId),queueCursor=queue.nextCursor
    while(!queueMatch&&queueCursor){
      const page=ok(await invoke('listCustomerReviewModerationQueue',{pageSize:20,cursor:queueCursor},'admin'))
      queueMatch=page.items.find(item=>item.publicReviewId===pending.publicReviewId);queueCursor=page.nextCursor
    }
    assert.ok(queueMatch);assert.deepEqual(queueMatch.pendingSubmittedAt,caseDetail.pendingSubmittedAt)
    let rejected=ok(await invoke('rejectCustomerReview',{publicReviewId:pending.publicReviewId,expectedVersion:edit.version,
      requestId:'reject-edit',rejectionReasonCode:'personal_information',moderationNote:'PRIVATE EMULATOR NOTE'},'admin'))
    assert.deepEqual(ok(await invoke('listPublishedCustomerReviews',{businessId})).items[0],publicFirst)
    assert.ok(!JSON.stringify(ok(await invoke('listOwnCustomerReviews',{},'customer'))).includes('PRIVATE EMULATOR NOTE'))
    const rejectionOwn=ok(await invoke('getOwnCustomerReview',{businessId},'customer'))
    assert.deepEqual(rejectionOwn.rejection,{revision:2,reasonCode:'personal_information'})
    assert.equal(rejectionOwn.pendingSubmittedAt,undefined)
    const rejectionAdmin=ok(await invoke('getCustomerReviewModerationCase',{publicReviewId:pending.publicReviewId},'admin'))
    assert.deepEqual(rejectionAdmin.rejection,rejectionOwn.rejection)
    assert.equal(rejectionAdmin.pendingSubmittedAt,null)
    assert.ok(!JSON.stringify(rejectionAdmin).includes('PRIVATE EMULATOR NOTE'))
    const publicRejected=ok(await invoke('listPublishedCustomerReviews',{businessId})).items[0]
    assert.equal(publicRejected.rejection,undefined)
    assert.equal(publicRejected.moderationNote,undefined)
    assert.deepEqual(ok(await invoke('rejectCustomerReview',{publicReviewId:pending.publicReviewId,expectedVersion:edit.version,requestId:'reject-edit',rejectionReasonCode:'personal_information',moderationNote:'PRIVATE EMULATOR NOTE'},'admin')),rejected)
    const resubmittedEdit=ok(await invoke('editCustomerReview',{...payload,expectedVersion:rejected.version,requestId:'resubmit-after-rejection'},'customer'))
    assert.equal(ok(await invoke('getOwnCustomerReview',{businessId},'customer')).rejection,null)
    assert.deepEqual(ok(await invoke('listPublishedCustomerReviews',{businessId})).items[0],publicFirst)
    rejected=ok(await invoke('rejectCustomerReview',{publicReviewId:pending.publicReviewId,expectedVersion:resubmittedEdit.version,requestId:'reject-new-revision',rejectionReasonCode:'irrelevant_content'},'admin'))
    assert.deepEqual(ok(await invoke('getOwnCustomerReview',{businessId},'customer')).rejection,{revision:3,reasonCode:'irrelevant_content'})
    const other=ok(await invoke('submitCustomerReview',payload,'other'))
    ok(await invoke('approveCustomerReview',{publicReviewId:other.publicReviewId,expectedVersion:other.version,requestId:'approve-other'},'admin'))
    const page=ok(await invoke('listPublishedCustomerReviews',{businessId,pageSize:1}))
    const next=ok(await invoke('listPublishedCustomerReviews',{businessId,pageSize:1,cursor:page.nextCursor}))
    assert.notEqual(page.items[0].publicReviewId,next.items[0].publicReviewId)
    denied(await invoke('listPublishedCustomerReviews',{businessId,cursor:'invalid'}),'INVALID_ARGUMENT')
    // Unknown internal errors must not leak counters, records or stack/provider messages.
    const statsRef=db.doc(`customerReviewStats/${businessId}`);const stats=(await statsRef.get()).data()
    await statsRef.set({sum:999,count:1})
    const broken=await invoke('withdrawCustomerReview',{publicReviewId:pending.publicReviewId,expectedVersion:rejected.version,requestId:'withdraw'},'customer')
    denied(broken,'INTERNAL');assert.equal(broken.body.error.message,'customer-review-unavailable')
    await statsRef.set(stats)
    // Loss of participation eligibility does not block author withdrawal/status.
    await db.doc(`users/${ids.customer}`).update({accountStatus:'suspended',roles:[]})
    const withdrawn=ok(await invoke('withdrawCustomerReview',{publicReviewId:pending.publicReviewId,expectedVersion:rejected.version,requestId:'withdraw'},'customer'))
    assert.equal(withdrawn.status,'withdrawn')
    assert.equal(ok(await invoke('getOwnCustomerReview',{businessId},'customer')).status,'withdrawn')
    const otherOwn=ok(await invoke('getOwnCustomerReview',{businessId},'other'))
    ok(await invoke('removeCustomerReview',{publicReviewId:other.publicReviewId,expectedVersion:otherOwn.version,requestId:'remove-other'},'admin'))
    assert.equal(ok(await invoke('listPublishedCustomerReviews',{businessId})).items.length,0)
    await db.doc(`businesses/${businessId}`).update({status:'draft'})
    denied(await invoke('listPublishedCustomerReviews',{businessId}),'FAILED_PRECONDITION')
  })
}
