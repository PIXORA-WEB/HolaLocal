import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {assertCallableBoundaryEnvironment} from '../scripts/runIsolatedEmulatorTests.mjs'
import {customerReviewReportQuotaId} from '../src/customerReviewReports.js'

if(process.env.HOLALOCAL_CALLABLE_BOUNDARY!=='1') {
  test('customer review reports HTTP/Firestore emulator gate',{skip:'NOT RUN: protected demo workflow required'},()=>{})
} else {
  assertCallableBoundaryEnvironment()
  const {initializeApp,deleteApp}=await import('firebase-admin/app')
  const {getFirestore,Timestamp}=await import('firebase-admin/firestore')
  const {getAuth}=await import('firebase-admin/auth')
  const app=initializeApp({projectId:'demo-holalocal-functions'},`reports-${randomUUID()}`)
  const db=getFirestore(app);const auth=getAuth(app)
  test.after(async()=>{await db.terminate();await deleteApp(app)})
  async function identity({verified=true,status='active',admin=false}={}) {
    const uid=`report-${randomUUID()}`;const email=`${uid}@example.invalid`;const password='Fictional-report-password-54!'
    await auth.createUser({uid,email,password,emailVerified:verified})
    if(admin)await auth.setCustomUserClaims(uid,{admin:true})
    await db.doc(`users/${uid}`).set({accountStatus:status,roles:['customer'],businessId:null,deletionRequestedAt:null,
      termsAccepted:true,termsVersion:'1.0',termsAcceptedAt:Timestamp.now(),privacyAccepted:true,privacyVersion:'1.0',privacyAcceptedAt:Timestamp.now()})
    const response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-only',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})})
    assert.equal(response.status,200);return {uid,token:(await response.json()).idToken}
  }
  async function invoke(name,data,identity) {
    const response=await fetch(`http://127.0.0.1:5001/demo-holalocal-functions/europe-west1/${name}`,{
      method:'POST',headers:{'content-type':'application/json',...(identity?{authorization:`Bearer ${identity.token}`}:{})},body:JSON.stringify({data})})
    return {status:response.status,body:await response.json()}
  }
  const ok=result=>{assert.equal(result.status,200,JSON.stringify(result.body));return result.body.result}
  const denied=(result,code)=>{assert.notEqual(result.status,200);assert.equal(result.body.error.status,code);assert.equal(result.body.error.details,undefined)}
  async function setup() {
    const author=await identity();const reporter=await identity();const admin=await identity({admin:true})
    const businessId=`report-business-${randomUUID()}`
    await db.doc(`businesses/${businessId}`).set({ownerId:'fictional-owner',managerIds:['fictional-owner'],
      name:'Fictional reporting business',description:'Synthetic business for report tests',primaryCategoryId:'home',categoryIds:['home'],
      serviceAreas:['Madrid'],languages:['en'],primaryLanguage:'en',status:'active',publishedAt:Timestamp.now(),
      location:{locality:'Madrid',region:'Madrid',countryCode:'ES'}})
    const payload={businessId,expectedVersion:0,requestId:'initial',rating:4,displayName:'Test reviewer',originalText:'Fictional review describing this synthetic service.'}
    const pending=ok(await invoke('submitCustomerReview',payload,author))
    const approved=ok(await invoke('approveCustomerReview',{publicReviewId:pending.publicReviewId,expectedVersion:pending.version,requestId:'approval'},admin))
    const report={publicReviewId:approved.publicReviewId,observedPublishedRevision:1,submittedAt:Date.now(),reasonCode:'personal_information',details:'Fictional sensitive details',requestId:'report-first'}
    return {author,reporter,admin,businessId,payload,approved,report}
  }
  test('HTTP reports: authorization, owner/manager reporting, idempotency, admin handling and target revision checks',async()=>{
    const s=await setup();const {reporter,admin,report}=s
    const before=(await db.doc(`customerReviewsPublic/${s.approved.publicReviewId}`).get()).data()
    const counters=(await db.doc(`customerReviewStats/${s.businessId}`).get()).data()
    denied(await invoke('submitCustomerReviewReport',report),'UNAUTHENTICATED')
    for(const identityOptions of [{verified:false},{status:'suspended'}]) {
      const user=await identity(identityOptions);denied(await invoke('submitCustomerReviewReport',report,user),'FAILED_PRECONDITION')
    }
    denied(await invoke('submitCustomerReviewReport',{...report,reporterUid:admin.uid},reporter),'INVALID_ARGUMENT')
    denied(await invoke('submitCustomerReviewReport',{...report,reasonCode:'negative_rating'},reporter),'INVALID_ARGUMENT')
    const [a,b]=await Promise.all([invoke('submitCustomerReviewReport',report,reporter),invoke('submitCustomerReviewReport',report,reporter)])
    const filed=ok(a);assert.deepEqual(ok(b),filed)
    const reportIds=[filed.reportId]
    assert.equal((await db.doc(`customerReviewReportQuotas/${customerReviewReportQuotaId(reporter.uid)}`).get()).data().acceptedAt.length,1)
    assert.equal((await db.collection('customerReviewReportAudits').where('reportId','==',filed.reportId).get()).size,1)
    denied(await invoke('submitCustomerReviewReport',{...report,details:'different'},reporter),'ALREADY_EXISTS')
    denied(await invoke('submitCustomerReviewReport',{...report,requestId:'duplicate-open'},reporter),'ALREADY_EXISTS')
    for(const relation of ['owner','manager']) {
      const businessUser=await identity()
      if(relation==='owner')await db.doc(`businesses/${s.businessId}`).update({ownerId:businessUser.uid,managerIds:[businessUser.uid]})
      else {const business=(await db.doc(`businesses/${s.businessId}`).get()).data();await db.doc(`businesses/${s.businessId}`).update({managerIds:[...business.managerIds,businessUser.uid]})}
      const attempts=await Promise.all([invoke('submitCustomerReviewReport',report,businessUser),
        invoke('submitCustomerReviewReport',{...report,requestId:'different-request'},businessUser)])
      assert.equal(attempts.filter(result=>result.status===200).length,1)
      reportIds.push(ok(attempts.find(result=>result.status===200)).reportId)
      denied(attempts.find(result=>result.status!==200),'ALREADY_EXISTS')
      denied(await invoke('listCustomerReviewReports',{},businessUser),'PERMISSION_DENIED')
      denied(await invoke('getCustomerReviewReport',{reportId:filed.reportId},businessUser),'PERMISSION_DENIED')
    }
    const detail=ok(await invoke('getCustomerReviewReport',{reportId:filed.reportId},admin))
    assert.equal(detail.observedRevisionIsCurrent,true);assert.equal(detail.reporterUid,undefined);assert.equal(detail.currentReview.authorUid,undefined)
    for(const reportId of reportIds)await db.doc(`customerReviewReports/${reportId}`).update({createdAt:new Timestamp(1,1000)})
    const first=ok(await invoke('listCustomerReviewReports',{pageSize:1},admin))
    assert.ok(first.nextCursor)
    const second=ok(await invoke('listCustomerReviewReports',{pageSize:1,cursor:first.nextCursor},admin))
    assert.notEqual(first.items[0].reportId,second.items[0].reportId)
    const third=ok(await invoke('listCustomerReviewReports',{pageSize:1,cursor:second.nextCursor},admin))
    assert.deepEqual([first,second,third].map(page=>page.items[0].reportId),reportIds.sort())
    const decoded=JSON.parse(Buffer.from(first.nextCursor,'base64url').toString())
    assert.deepEqual(decoded.position[0],{seconds:1,nanoseconds:1000})
    denied(await invoke('listCustomerReviewReports',{pageSize:21},admin),'INVALID_ARGUMENT')
    const resolution={reportId:filed.reportId,expectedVersion:1,expectedGeneration:filed.generation,requestId:'resolve',disposition:'dismissed',resolutionReason:'No violation in this fictional case.',moderationNote:'Private fictional note'}
    denied(await invoke('resolveCustomerReviewReport',resolution,reporter),'PERMISSION_DENIED')
    const closed=ok(await invoke('resolveCustomerReviewReport',resolution,admin))
    assert.deepEqual(ok(await invoke('resolveCustomerReviewReport',resolution,admin)),closed)
    denied(await invoke('resolveCustomerReviewReport',{...resolution,requestId:'stale'},admin),'ABORTED')
    assert.deepEqual((await db.doc(`customerReviewsPublic/${s.approved.publicReviewId}`).get()).data(),before)
    assert.deepEqual((await db.doc(`customerReviewStats/${s.businessId}`).get()).data(),counters)
    const edit=ok(await invoke('editCustomerReview',{...s.payload,expectedVersion:s.approved.version,requestId:'edit',rating:2},s.author))
    const updated=ok(await invoke('approveCustomerReview',{publicReviewId:edit.publicReviewId,expectedVersion:edit.version,requestId:'approve-edit'},admin))
    denied(await invoke('submitCustomerReviewReport',report,reporter),'FAILED_PRECONDITION')
    assert.equal(ok(await invoke('getCustomerReviewReport',{reportId:filed.reportId},admin)).observedRevisionIsCurrent,false)
    const fresh={...report,observedPublishedRevision:2,submittedAt:Date.now(),requestId:'new-revision'}
    await db.doc(`customerReviewReportQuotas/${customerReviewReportQuotaId(reporter.uid)}`).set({schemaVersion:1,acceptedAt:Array(10).fill(Date.now())})
    denied(await invoke('submitCustomerReviewReport',fresh,reporter),'RESOURCE_EXHAUSTED')
    // Removal is an independent explicit current-version command, never a report resolution side effect.
    ok(await invoke('removeCustomerReview',{publicReviewId:updated.publicReviewId,expectedVersion:updated.version,requestId:'explicit-removal'},admin))
    const removed=ok(await invoke('getCustomerReviewReport',{reportId:filed.reportId},admin))
    assert.equal(removed.targetState,'unpublished');assert.equal(removed.currentReview,null)
  })

  async function finalize(user,admin,requested) {
    let version=requested.request.requestVersion
    for(let i=0;i<15;i++) {
      const result=ok(await invoke('finalizeAccountDeletion',{uid:user.uid,expectedRequestVersion:version},admin))
      if(result.state==='completed')return result
      assert.equal(result.state,'failed_retryable');version=result.requestVersion
    }
    assert.fail('bounded finalization did not finish')
  }
  test('HTTP reporter deletion races report creation and drains report data before Auth deletion',async()=>{
    const s=await setup()
    const [submission,request]=await Promise.all([invoke('submitCustomerReviewReport',s.report,s.reporter),invoke('requestAccountDeletion',{},s.reporter)])
    if(submission.status!==200)denied(submission,'FAILED_PRECONDITION')
    const requested=ok(request)
    denied(await invoke('submitCustomerReviewReport',{...s.report,requestId:'blocked'},s.reporter),'FAILED_PRECONDITION')
    await finalize(s.reporter,s.admin,requested)
    for(const [collection,field] of [['customerReviewReports','reporterUid'],['customerReviewReportRequests','actorUid'],['customerReviewReportRequests','reporterUid'],['customerReviewReportAudits','actorUid'],['customerReviewReportAudits','reporterUid']])
      assert.equal((await db.collection(collection).where(field,'==',s.reporter.uid).get()).empty,true)
    assert.equal((await db.doc(`customerReviewReportQuotas/${customerReviewReportQuotaId(s.reporter.uid)}`).get()).exists,false)
    assert.deepEqual((await db.doc(`customerReviewStats/${s.businessId}`).get()).data(),{sum:4,count:1})
    await assert.rejects(auth.getUser(s.reporter.uid),e=>e.code==='auth/user-not-found')
  })
  test('HTTP author deletion erases referenced report details and prevents old request resurrection',async()=>{
    const s=await setup();const filed=ok(await invoke('submitCustomerReviewReport',s.report,s.reporter))
    await finalize(s.author,s.admin,ok(await invoke('requestAccountDeletion',{},s.author)))
    assert.equal(ok(await invoke('getCustomerReviewReport',{reportId:filed.reportId},s.admin)),null)
    for(const collection of ['customerReviewReports','customerReviewReportRequests','customerReviewReportAudits'])
      assert.equal((await db.collection(collection).where('publicReviewId','==',s.report.publicReviewId).get()).empty,true)
    denied(await invoke('submitCustomerReviewReport',s.report,s.reporter),'FAILED_PRECONDITION')
    assert.deepEqual((await db.doc(`customerReviewStats/${s.businessId}`).get()).data(),{sum:0,count:0})
  })
}
