import { CUSTOMER_REVIEW_WINDOW_MS } from './customerReviewQuotas.js'
import { CUSTOMER_REVIEW_REPORT_RETENTION_MS } from './customerReviewRetention.js'
import { createHash, randomUUID } from 'node:crypto'
import { isCustomerReviewId, isCustomerReviewRecord } from '@holalocal/firebase-contract/customerReviewContracts'
import { isPublicBusinessEligible } from '@holalocal/firebase-contract'
import { customerReviewPairKey } from './customerReviewCommands.js'
import { reviewTime } from './customerReviewTime.js'

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const customerReviewReportId = (uid, reviewId) => hash(['customerReviewReport',1,uid,reviewId])
export const customerReviewReportQuotaId = uid => hash(['customerReviewReportQuota',1,uid])
export const CUSTOMER_REVIEW_REPORT_REASONS = Object.freeze(['spam','abusive_content','personal_information','irrelevant_content','conflict_of_interest','other'])
const check = (ok, code) => { if (!ok) throw new Error(code) }
const exact = (value, keys) => check(isCustomerReviewRecord(value) && Reflect.ownKeys(value).every(key=>keys.includes(key)), 'invalid-payload')
const id = value => { check(isCustomerReviewId(value),'invalid-id'); return value }
const version = value => { check(Number.isSafeInteger(value)&&value>=1,'invalid-expected-version'); return value }
function text(value, max, required=false) {
  check(typeof value==='string'&&!/[\uD800-\uDFFF]/u.test(value),'invalid-report-text')
  const normalized=value.trim().normalize('NFC')
  check([...normalized].length<=max&&(!required||normalized.length>0),'invalid-report-text')
  return normalized // Plain text only: never interpreted as HTML or instructions.
}
const safe = row => ({reportId:row.reportId,version:row.version,status:row.status,generation:row.generation})
const terminalDeletion = row => ['finalizing','failed_retryable','completed'].includes(row?.state)

export function createCustomerReviewReportServices({database,readDatabase,auth,reportQuotaPolicy,clock=Date.now}) {
  check(typeof reportQuotaPolicy?.reserve==='function'&&typeof database?.runTransaction==='function'
    &&typeof readDatabase?.readSnapshot==='function'&&typeof auth?.resolveActor==='function','missing-report-dependency')
  async function actor(context,admin=false) {
    const identity=await auth.resolveActor(context)
    check(isCustomerReviewId(identity?.uid),'authentication-required')
    check(!admin||identity.admin===true,'admin-required')
    return identity
  }
  async function fence(tx,uid) {
    check(!terminalDeletion(await tx.get(`accountDeletionRequests/${uid}`)),'active-account-required')
  }
  async function target(tx,publicReviewId) {
    const locator=await tx.get(`customerReviewIds/${publicReviewId}`)
    if(!locator)return {state:'erased',projection:null}
    id(locator.authorUid);id(locator.businessId)
    const slot=await tx.get(`customerReviewSlots/${customerReviewPairKey(locator.businessId,locator.authorUid)}`)
    if(!slot||slot.customerReviewCleanup===true)return {state:'erased',projection:null}
    check(slot.publicReviewId===publicReviewId&&slot.authorUid===locator.authorUid&&slot.businessId===locator.businessId
      &&Number.isSafeInteger(slot.version)&&slot.version>=1,'invalid-report-target')
    const business=await tx.get(`businesses/${locator.businessId}`)
    const projection=await tx.get(`customerReviewsPublic/${publicReviewId}`)
    check(!projection||(projection.businessId===locator.businessId&&projection.publicReviewId===publicReviewId
      &&projection.publishedRevision===slot.publishedRevision),'invalid-report-target')
    return {state:!isPublicBusinessEligible(business)?'unavailable':!projection?'unpublished':'published',
      projection,locator,slot,
      businessContext:isPublicBusinessEligible(business)?{businessId:locator.businessId,name:typeof business.name==='string'?business.name:null}:null}
  }
  async function submit(context,input) {
    exact(input,['publicReviewId','observedPublishedRevision','reasonCode','details','requestId','submittedAt'])
    const payload={publicReviewId:id(input.publicReviewId),observedPublishedRevision:version(input.observedPublishedRevision),
      submittedAt:input.submittedAt,reasonCode:input.reasonCode,details:text(input.details===undefined?'':input.details,2000),requestId:id(input.requestId)}
    check(CUSTOMER_REVIEW_REPORT_REASONS.includes(payload.reasonCode),'invalid-report-reason')
    check(Number.isSafeInteger(payload.submittedAt)&&payload.submittedAt>=0,'invalid-report-submitted-at')
    const identity=await actor(context);check(identity.emailVerified===true,'verified-email-required')
    const reportId=customerReviewReportId(identity.uid,payload.publicReviewId)
    const receiptId=hash(['customerReviewReportRequest',1,identity.uid,payload.requestId])
    const fingerprint=hash(['submit',payload]);const now=clock();check(Number.isSafeInteger(now)&&now>=0,'invalid-clock')
    const timestamp=database.timestampFromMillis(now)
    const generation=randomUUID() // Server entropy outside transaction retries; independent of reusable client request IDs.
    return database.runTransaction(async tx=>{
      const account=await tx.get(`users/${identity.uid}`)
      check(account?.accountStatus==='active'&&account.deletionRequestedAt==null,'active-account-required')
      await fence(tx,identity.uid)
      const current=await target(tx,payload.publicReviewId)
      check(current.state==='published','report-target-unavailable')
      await fence(tx,current.locator.authorUid)
      check(current.projection.publishedRevision===payload.observedPublishedRevision,'review-refresh-required')
      const receipt=await tx.get(`customerReviewReportRequests/${receiptId}`)
      if(receipt){check(receipt.fingerprint===fingerprint&&receipt.actorUid===identity.uid,'request-id-conflict');return safe(receipt.outcome)}
      // A lost response can replay its receipt, but an expired, pruned request cannot create a new report.
      check(payload.submittedAt<=now+5*60*1000&&payload.submittedAt>now-CUSTOMER_REVIEW_WINDOW_MS,'report-request-expired')
      const prior=await tx.get(`customerReviewReports/${reportId}`)
      check(prior?.status!=='open','report-already-open')
      if(prior)check(prior.reporterUid===identity.uid&&prior.publicReviewId===payload.publicReviewId
        &&['resolved','dismissed'].includes(prior.status)&&Number.isSafeInteger(prior.version)&&prior.version>=1,'invalid-report-state')
      const quotaPath=`customerReviewReportQuotas/${customerReviewReportQuotaId(identity.uid)}`
      const quota=await tx.get(quotaPath)
      const nextQuota=reportQuotaPolicy.reserve({current:quota,actorUid:identity.uid,now:clock()})
      check(isCustomerReviewRecord(nextQuota),'invalid-report-quota')
      const row={reportId,reporterUid:identity.uid,publicReviewId:payload.publicReviewId,businessId:current.locator.businessId,
        observedPublishedRevision:payload.observedPublishedRevision,reasonCode:payload.reasonCode,details:payload.details,
        generation,submissionRequestId:receiptId,status:'open',version:(prior?.version??0)+1,createdAt:timestamp,updatedAt:timestamp}
      version(row.version)
      const outcome=safe(row)
      tx.set(`customerReviewReports/${reportId}`,row);tx.set(quotaPath,nextQuota)
      tx.create(`customerReviewReportRequests/${receiptId}`,{actorUid:identity.uid,publicReviewId:payload.publicReviewId,reportId,fingerprint,outcome})
      tx.create(`customerReviewReportAudits/${receiptId}`,{actorUid:identity.uid,publicReviewId:payload.publicReviewId,reportId,action:'submit',version:row.version,at:timestamp})
      return outcome
    })
  }
  async function resolve(context,input) {
    exact(input,['reportId','expectedVersion','expectedGeneration','requestId','disposition','resolutionReason','moderationNote'])
    const payload={reportId:id(input.reportId),expectedVersion:version(input.expectedVersion),expectedGeneration:id(input.expectedGeneration),requestId:id(input.requestId),
      disposition:input.disposition,resolutionReason:text(input.resolutionReason,500,true),moderationNote:text(input.moderationNote===undefined?'':input.moderationNote,2000)}
    check(['resolved','dismissed'].includes(payload.disposition),'invalid-report-disposition')
    const identity=await actor(context,true)
    const receiptId=hash(['customerReviewReportRequest',1,identity.uid,payload.requestId]);const fingerprint=hash(['resolve',payload])
    const now=clock();check(Number.isSafeInteger(now)&&now>=0,'invalid-clock');const timestamp=database.timestampFromMillis(now)
    return database.runTransaction(async tx=>{
      await fence(tx,identity.uid)
      const row=await tx.get(`customerReviewReports/${payload.reportId}`);check(row,'report-not-found')
      await fence(tx,id(row.reporterUid))
      const current=await target(tx,row.publicReviewId)
      if(current.locator)await fence(tx,current.locator.authorUid)
      const receipt=await tx.get(`customerReviewReportRequests/${receiptId}`)
      if(receipt){check(receipt.fingerprint===fingerprint&&receipt.actorUid===identity.uid,'request-id-conflict');return safe(receipt.outcome)}
      check(row.version===payload.expectedVersion&&row.generation===payload.expectedGeneration,'report-version-conflict');check(row.status==='open','report-not-open')
      const submissionId=id(row.submissionRequestId)
      const submissionReceipt=await tx.get(`customerReviewReportRequests/${submissionId}`)
      const submissionAudit=await tx.get(`customerReviewReportAudits/${submissionId}`)
      check(submissionReceipt?.reportId===row.reportId&&submissionReceipt.actorUid===row.reporterUid
        &&submissionReceipt.outcome?.version===row.version&&submissionAudit?.version===row.version
        &&submissionAudit.reportId===row.reportId&&submissionAudit.actorUid===row.reporterUid,'invalid-report-state')
      const expiresAt=database.timestampFromMillis(now+CUSTOMER_REVIEW_REPORT_RETENTION_MS)
      const updated={...row,status:payload.disposition,version:version(row.version+1),updatedAt:timestamp,resolvedAt:timestamp,expiresAt,resolutionAuditId:receiptId}
      const outcome=safe(updated)
      tx.set(`customerReviewReports/${payload.reportId}`,updated)
      tx.set(`customerReviewReportRequests/${submissionId}`,{...submissionReceipt,expiresAt})
      tx.set(`customerReviewReportAudits/${submissionId}`,{...submissionAudit,expiresAt})
      tx.create(`customerReviewReportRequests/${receiptId}`,{actorUid:identity.uid,reporterUid:row.reporterUid,
        publicReviewId:row.publicReviewId,reportId:row.reportId,fingerprint,outcome,expiresAt})
      tx.create(`customerReviewReportAudits/${receiptId}`,{actorUid:identity.uid,reporterUid:row.reporterUid,publicReviewId:row.publicReviewId,
        reportId:row.reportId,action:payload.disposition,version:updated.version,at:timestamp,
        resolutionReason:payload.resolutionReason,moderationNote:payload.moderationNote,expiresAt})
      return outcome // Does NOT call review removal. Separate intentional version-checked removal is required.
    })
  }
  const summary=row=>({ ...safe(row),publicReviewId:row.publicReviewId,observedPublishedRevision:row.observedPublishedRevision,
    reasonCode:row.reasonCode,createdAt:reviewTime(row.createdAt),
    overdue:row.status==='open'&&clock()-(reviewTime(row.createdAt).seconds*1000+reviewTime(row.createdAt).nanoseconds/1000000)>=7*24*60*60*1000 })
  async function detail(context,input) {
    exact(input,['reportId']);id(input.reportId);await actor(context,true)
    return readDatabase.readSnapshot(async tx=>{
      const row=await tx.get(`customerReviewReports/${input.reportId}`);if(!row)return null
      if(row.expiresAt&&(reviewTime(row.expiresAt).seconds*1000+reviewTime(row.expiresAt).nanoseconds/1000000)<=clock())return null
      const current=await target(tx,row.publicReviewId)
      const resolution=row.resolutionAuditId?await tx.get(`customerReviewReportAudits/${id(row.resolutionAuditId)}`):null
      const matches=current.state==='published'&&current.projection.publishedRevision===row.observedPublishedRevision
      return {...summary(row),details:current.state==='erased'?null:row.details,targetState:current.state,
        businessContext:current.businessContext??null,
        observedRevisionIsCurrent:matches,
        resolution:current.state==='erased'||!resolution?null:{reason:resolution.resolutionReason,moderationNote:resolution.moderationNote},
        currentReview:current.state==='published'?{publicReviewId:row.publicReviewId,publishedRevision:current.projection.publishedRevision,
          version:current.slot.version,rating:current.projection.rating,originalText:current.projection.originalText}:null}
    })
  }
  async function queue(context,input={}) {
    exact(input,['pageSize','cursor']);await actor(context,true)
    const limit=input.pageSize===undefined?10:input.pageSize;check(Number.isInteger(limit)&&limit>=1&&limit<=20,'invalid-page-size')
    let after=null
    if(input.cursor!=null){
      check(typeof input.cursor==='string'&&input.cursor.length<=4096&&/^[A-Za-z0-9_-]+$/.test(input.cursor),'invalid-cursor')
      try{
        const value=JSON.parse(Buffer.from(input.cursor,'base64url').toString())
        check(Object.keys(value).sort().join()==='position,scope,v'&&value.v===1&&value.scope==='customer-review-reports-open'
          &&Array.isArray(value.position)&&value.position.length===2,'invalid-cursor')
        exact(value.position[0],['seconds','nanoseconds']);reviewTime(value.position[0]);id(value.position[1]);after=value.position
      }catch{throw new Error('invalid-cursor')}
    }
    return readDatabase.readSnapshot(async tx=>{
      const rows=await tx.query({collection:'customerReviewReports',filters:[['status','open']],
        order:[['createdAt','asc'],['reportId','asc']],after,limit:limit+1})
      const selected=rows.slice(0,limit);const last=selected.at(-1)?.data
      return {items:selected.map(({data})=>summary(data)),nextCursor:rows.length>limit?Buffer.from(JSON.stringify({v:1,
        scope:'customer-review-reports-open',position:[reviewTime(last.createdAt),last.reportId]})).toString('base64url'):null}
    })
  }
  return Object.freeze({submit,resolve,detail,queue})
}
