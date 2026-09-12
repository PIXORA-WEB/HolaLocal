import { FieldPath, Timestamp } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { RETENTION_ACTION_FIELDS, RETENTION_KINDS, RETENTION_PAGE_LIMIT, RETENTION_EXECUTION_LIMIT } from '@holalocal/firebase-contract'
import { requireRetentionAdmin, retentionReviewStatus } from './recordRetention.js'
import { assessAcknowledgmentRetention, removeReleasedAcknowledgmentEvidence, assessConversationRetention, removeUnneededConversationBatch, redactAssessedConversationMessage } from './accountDeletionPrimitives.js'
import { assessBusinessReportRetention, resolveBusinessReport, removeExpiredBusinessReport, BUSINESS_REPORT_RETENTION_MS } from './businessReports.js'
const collections = {acknowledgment:'accountDeletionRequests','business-report':'reports',conversation:'conversations'}
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value)
const iso = value => value instanceof Timestamp ? value.toDate().toISOString() : null
function projectDecision(decision, now) {
  const status = retentionReviewStatus(decision,now)
  return {status,revision:Number.isSafeInteger(decision?.revision)?decision.revision:0,
    reason:typeof decision?.reason==='string'?decision.reason.slice(0,500):null,
    reviewerId:typeof decision?.reviewerId==='string'?decision.reviewerId:null,
    endingCondition:typeof decision?.endingCondition==='string'?decision.endingCondition.slice(0,500):null,
    reviewAt:iso(decision?.reviewAt)}
}
function validate(data) {
  if(!data||typeof data!=='object'||Array.isArray(data)||!Object.hasOwn(RETENTION_ACTION_FIELDS,data.action)||!RETENTION_KINDS.includes(data.kind))throw new HttpsError('invalid-argument','invalid-retention-request')
  if(Object.keys(data).some(key=>!RETENTION_ACTION_FIELDS[data.action].includes(key)))throw new HttpsError('invalid-argument','unexpected-retention-field')
  if(data.action==='list'){if(data.view!=null&&!['all','cleanup-due','reviews-due'].includes(data.view))throw new HttpsError('invalid-argument','invalid-retention-view');if(data.view==='cleanup-due'&&data.kind!=='business-report')throw new HttpsError('invalid-argument','report-only-view');if(data.cursor!=null&&!identifier(data.cursor))throw new HttpsError('invalid-argument','invalid-retention-cursor')}
  else if(data.action==='execute'){
    if(!Array.isArray(data.ids)||!data.ids.length||data.ids.length>RETENTION_EXECUTION_LIMIT||new Set(data.ids).size!==data.ids.length||data.ids.some(id=>!identifier(id)))throw new HttpsError('invalid-argument','invalid-retention-batch')
  }else if(!identifier(data.id))throw new HttpsError('invalid-argument','invalid-retention-id')
}

export async function manageRetentionRecords({actorUid,claims,data,db,auth,env=process.env,now=Timestamp.now()}) {
  // Existing admin permission protects cross-record queues and private exception reasons.
  requireRetentionAdmin(actorUid,claims)
  validate(data)
  const cleanupEnabled=env.RECORD_RETENTION_CLEANUP_ENABLED==='true'
  const common={db,actorUid,claims,now}
  if(data.action==='list'){
    const view=data.view??'all'
    const dueReviews=view==='reviews-due', dueCleanup=view==='cleanup-due'
    const source=dueReviews&&data.kind!=='business-report'?`${data.kind==='acknowledgment'?'acknowledgment':'conversation'}Retention`:collections[data.kind]
    const dateField=dueCleanup?'resolvedAt':dueReviews?(data.kind==='business-report'?'retentionDecision.reviewAt':'decision.reviewAt'):null
    let query=db.collection(source)
    if(dateField)query=query.where(dateField,'<=',dueCleanup?Timestamp.fromMillis(now.toMillis()-BUSINESS_REPORT_RETENTION_MS):now).orderBy(dateField).orderBy(FieldPath.documentId())
    else query=query.orderBy(FieldPath.documentId())
    if(data.cursor){
      if(dateField){const cursor=await db.doc(`${source}/${data.cursor}`).get();const date=cursor.get(dateField);if(!(date instanceof Timestamp))throw new HttpsError('failed-precondition','retention-cursor-changed');query=query.startAfter(date,data.cursor)}
      else query=query.startAfter(data.cursor)
    }
    const page=await query.limit(RETENTION_PAGE_LIMIT+1).get()
    const documents=page.docs.slice(0,RETENTION_PAGE_LIMIT)
    const rows=[]
    for(const doc of documents){
      const row=source===collections[data.kind]?doc.data():(await db.doc(`${collections[data.kind]}/${doc.id}`).get()).data()
      if(!row)continue
      if(data.kind==='acknowledgment'&&row.state!=='completed')continue
      if(data.kind==='business-report'&&row.targetType!=='business')continue
      const decision=data.kind==='acknowledgment'?(await db.doc(`acknowledgmentRetention/${doc.id}`).get()).data()?.decision:data.kind==='conversation'?(await db.doc(`conversationRetention/${doc.id}`).get()).data()?.decision:row.retentionDecision
      if(dueReviews&&decision?.state!=='held')continue
      if(dueCleanup&&(row.status!=='resolved'||row.resolutionVersion!==1))continue
      rows.push({id:doc.id,status:row.status??row.state??'unknown',decision:projectDecision(decision,now),
        ...(data.kind==='acknowledgment'?{evidencePresent:row.retainedConsentEvidence!=null}:{}),
        ...(data.kind==='business-report'?{details:typeof row.details==='string'?row.details.slice(0,2000):'',businessId:typeof row.targetId==='string'?row.targetId:null,resolvedAt:iso(row.resolvedAt),eligibleAt:row.resolutionVersion===1&&row.resolvedAt instanceof Timestamp?iso(Timestamp.fromMillis(row.resolvedAt.toMillis()+BUSINESS_REPORT_RETENTION_MS)):null}:{}),
      })
    }
    return {rows,cleanupEnabled,nextCursor:page.size>RETENTION_PAGE_LIMIT?documents.at(-1)?.id:null}
  }
  if(data.action==='assess'){
    let reviewAt
    if(data.reviewAt!=null){const date=new Date(data.reviewAt);if(typeof data.reviewAt!=='string'||!Number.isFinite(date.valueOf()))throw new HttpsError('invalid-argument','invalid-review-date');reviewAt=Timestamp.fromDate(date)}
    const options={...common,expectedRevision:data.expectedRevision,action:data.decision,reason:data.reason,endingCondition:data.endingCondition,reviewAt}
    if(data.kind==='acknowledgment')return assessAcknowledgmentRetention({...options,uid:data.id})
    if(data.kind==='business-report')return assessBusinessReportRetention({...options,reportId:data.id})
    return assessConversationRetention({...options,conversationId:data.id})
  }
  if(data.action==='resolve'){
    if(data.kind!=='business-report')throw new HttpsError('invalid-argument','report-only-action')
    return resolveBusinessReport({...common,reportId:data.id,summary:data.summary})
  }
  if(data.action==='redact'){
    if(data.kind!=='conversation')throw new HttpsError('invalid-argument','conversation-only-action')
    return redactAssessedConversationMessage({...common,conversationId:data.id,messageId:data.messageId,subjectUid:data.subjectUid,reason:data.reason,enabled:cleanupEnabled})
  }
  if(!cleanupEnabled)return {disabled:true,results:[]}
  const results=[]
  // No automatic retries at this boundary; bounded, sequential records with isolated failure.
  for(const id of data.ids){
    try{
      const result=data.kind==='acknowledgment'?await removeReleasedAcknowledgmentEvidence({...common,uid:id,enabled:true})
        :data.kind==='business-report'?await removeExpiredBusinessReport({...common,reportId:id,enabled:true})
          :await removeUnneededConversationBatch({...common,conversationId:id,auth,enabled:true,pageSize:10})
      results.push({id,...result})
    }catch{results.push({id,failed:true})}
  }
  return {results,disabled:false}
}
