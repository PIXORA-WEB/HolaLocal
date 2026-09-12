import { Timestamp, FieldPath } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { requireRetentionAdmin, nextRetentionDecision, retentionText, validRetentionDecision } from './recordRetention.js'

export const BUSINESS_REPORT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000
function reportRef(db, reportId) {
  if (typeof reportId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(reportId)) throw new HttpsError('invalid-argument','invalid-report-id')
  return db.doc(`reports/${reportId}`)
}
function requireModerator(actorUid, claims) {
  if (typeof actorUid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(actorUid) || (claims?.admin !== true && claims?.moderator !== true)) throw new HttpsError('permission-denied','moderator-required')
}
// Records handling only. Never changes the business, its approval or its visibility.
export async function resolveBusinessReport({db,reportId,actorUid,claims,summary,now=Timestamp.now()}) {
  requireModerator(actorUid,claims)
  const resolution={summary:retentionText(summary),handledBy:actorUid}
  const ref=reportRef(db,reportId)
  return db.runTransaction(async tx=>{
    const snapshot=await tx.get(ref), row=snapshot.data()
    if(!snapshot.exists || row.targetType!=='business')throw new HttpsError('not-found','business-report-not-found')
    if(row.status==='resolved' && row.resolutionVersion===1 && row.resolution?.summary===resolution.summary && row.resolution?.handledBy===actorUid)return {resolved:true,idempotent:true}
    if(row.status!=='open')throw new HttpsError('failed-precondition','report-resolution-needs-assessment')
    tx.update(ref,{status:'resolved',resolution,resolutionVersion:1,resolvedAt:now,updatedAt:now})
    return {resolved:true,idempotent:false}
  })
}
export async function assessBusinessReportRetention({db,reportId,actorUid,claims,expectedRevision,action,reason,endingCondition,reviewAt,now=Timestamp.now()}) {
  requireRetentionAdmin(actorUid,claims)
  const ref=reportRef(db,reportId)
  return db.runTransaction(async tx=>{
    const snapshot=await tx.get(ref), row=snapshot.data()
    if(!snapshot.exists || row.targetType!=='business')throw new HttpsError('not-found','business-report-not-found')
    const decision=nextRetentionDecision({previous:row.retentionDecision,expectedRevision,actorUid,action,reason,endingCondition,reviewAt,now})
    tx.update(ref,{retentionDecision:decision})
    return {revision:decision.revision,state:decision.state}
  })
}
export async function removeExpiredBusinessReport({db,reportId,actorUid,claims,enabled=false,now=Timestamp.now()}) {
  requireRetentionAdmin(actorUid,claims)
  if(enabled!==true)return {removed:false,disabled:true}
  return pruneExpiredBusinessReport({db,reportId,now})
}

// Private shared transaction: browser callers retain their admin checks; the worker
// can reach this only after its independent server gate. No fabricated admin claims.
async function pruneExpiredBusinessReport({db,reportId,now}) {
  const ref=reportRef(db,reportId)
  return db.runTransaction(async tx=>{
    const snapshot=await tx.get(ref),row=snapshot.data()
    if(!snapshot.exists)return {removed:false,idempotent:true}
    if(row.targetType!=='business'||row.status!=='resolved'||row.resolutionVersion!==1||!(row.resolvedAt instanceof Timestamp))return {removed:false,needsAssessment:true}
    if(row.resolvedAt.toMillis()+BUSINESS_REPORT_RETENTION_MS>now.toMillis())return {removed:false,notDue:true}
    if(row.retentionDecision!=null && (!validRetentionDecision(row.retentionDecision)||row.retentionDecision.state!=='released'))return {removed:false,held:true}
    // Unknown legacy schema/copy references require assessment before destructive work.
    const fields=new Set(['reporterId','targetType','targetId','parentId','reason','details','evidence','status','priority','assignedTo','resolution','createdAt','updatedAt','resolutionVersion','resolvedAt','retentionDecision'])
    if(Object.keys(row).some(key=>!fields.has(key))||!Array.isArray(row.evidence)||row.evidence.length!==0||row.parentId!=null)return {removed:false,needsAssessment:true}
    // No legitimate non-personal report summary exists in this schema: remove the record,
    // including free text, resolution notes and identifying links, rather than keep them accidentally.
    tx.delete(ref)
    return {removed:true}
  })
}


// Prepared worker, deliberately not exported as a deployed Function yet.
export async function runBusinessReportRetention({env=process.env,createDatabase,now=Timestamp.now(),pageSize=50}) {
  if(env.BUSINESS_REPORT_RETENTION_ENABLED!=='true')return {disabled:true}
  if(!(now instanceof Timestamp)||!Number.isInteger(pageSize)||pageSize<1||pageSize>50)throw new Error('invalid-business-retention-options')
  const db=createDatabase(),progress=db.doc('maintenanceProgress/businessReportRetention')
  const state=(await progress.get()).data()??{}
  const cutoff=Timestamp.fromMillis(now.toMillis()-BUSINESS_REPORT_RETENTION_MS)
  let query=db.collection('reports').where('resolvedAt','<=',cutoff).orderBy('resolvedAt').orderBy(FieldPath.documentId())
  if(state.resolvedAt instanceof Timestamp&&typeof state.documentId==='string')query=query.startAfter(state.resolvedAt,state.documentId)
  const page=await query.limit(pageSize).get()
  const counts={disabled:false,examined:page.size,removed:0,preserved:0,needsAssessment:0,failed:0,pageLimitReached:page.size===pageSize}
  for(const candidate of page.docs){
    // Progress precedes work so one poison record or timeout cannot pin the queue.
    await progress.set({resolvedAt:candidate.get('resolvedAt'),documentId:candidate.id})
    try{
      const result=await pruneExpiredBusinessReport({db,reportId:candidate.id,now})
      if(result.removed)counts.removed++
      else if(result.needsAssessment)counts.needsAssessment++
      else counts.preserved++
    }catch{counts.failed++}
  }
  if(page.size<pageSize)await progress.set({resolvedAt:null,documentId:null})
  return counts
}
