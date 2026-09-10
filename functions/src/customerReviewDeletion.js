import { customerReviewReportQuotaId } from './customerReviewReports.js'
import { Timestamp } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import * as contracts from '@holalocal/firebase-contract/customerReviewContracts'
import * as lifecycle from '@holalocal/firebase-contract/customerReviewLifecycle'
import { createBoundedCustomerReviewHelpers } from './customerReviewBounded.js'
import { customerReviewPairKey, customerReviewQuotaKey } from './customerReviewCommands.js'
const h=createBoundedCustomerReviewHelpers({...contracts,...lifecycle})
const check=(ok)=>{if(!ok)throw new HttpsError('failed-precondition','customer-review-cleanup-integrity')}
export const CUSTOMER_REVIEW_CLEANUP_PAGE_SIZE=50
export const CUSTOMER_REVIEW_CLEANUP_MAX_STEPS=25
export const customerReviewCleanupPath=uid=>`accountDeletionRequests/${uid}/customerReviewCleanup/state`

// No feature gate. Fixed bounded work per invocation; repeat head queries after deleting each page.
export async function cleanupAccountCustomerReviews({uid,leaseId,expectedRequestVersion,db,
  maxSteps=CUSTOMER_REVIEW_CLEANUP_MAX_STEPS,pageSize=CUSTOMER_REVIEW_CLEANUP_PAGE_SIZE,now=()=>Timestamp.now()}) {
  check(contracts.isCustomerReviewId(uid)&&Number.isInteger(maxSteps)&&maxSteps>=1&&maxSteps<=25
    &&Number.isInteger(pageSize)&&pageSize>=1&&pageSize<=50)
  const requestRef=db.doc(`accountDeletionRequests/${uid}`);const progressRef=db.doc(customerReviewCleanupPath(uid))
  for(let step=0;step<maxSteps;step++) {
    const sampled=now() // trusted clock outside retryable callback
    const done=await db.runTransaction(async tx=>{
      const requestSnap=await tx.get(requestRef);const progressSnap=await tx.get(progressRef)
      const request=requestSnap.exists?requestSnap.data():null
      if(!request||request.state!=='finalizing'||request.leaseId!==leaseId||request.requestVersion!==expectedRequestVersion
        || !(request.leaseExpiresAt?.toMillis?.()>sampled.toMillis())) throw new HttpsError('aborted','account-deletion-workflow-stale')
      const progress=progressSnap.exists?progressSnap.data():{phase:'select'}
      if(progress.complete===true)return true
      const phase=progress.phase
      if(phase==='select') {
        const matches=await tx.get(db.collection('customerReviewSlots').where('authorUid','==',uid).limit(1))
        if(matches.empty){tx.set(progressRef,{phase:'actorRequests'});return false}
        const row=matches.docs[0];const state=row.data();const pair=row.id
        check(state.authorUid===uid&&contracts.isCustomerReviewId(state.businessId)&&contracts.isCustomerReviewId(state.publicReviewId)
          &&pair===customerReviewPairKey(state.businessId,uid))
        if(state.customerReviewCleanup===true)check(Object.keys(state).sort().join() === 'authorUid,businessId,customerReviewCleanup,publicReviewId')
        if(state.customerReviewCleanup!==true) {
          const revisions=await Promise.all(h.customerReviewRevisionNumbers(state).map(n=>tx.get(db.doc(`customerReviewSlots/${pair}/revisions/${n}`))))
          const before={...state,revisions:revisions.map(doc=>doc.exists?doc.data():null)}
          h.assertCustomerReviewSlot(before)
          const publicRef=db.doc(`customerReviewsPublic/${state.publicReviewId}`)
          const publicSnap=await tx.get(publicRef)
          const mappingRef=db.doc(`customerReviewIds/${state.publicReviewId}`);const mapping=await tx.get(mappingRef)
          if(mapping.exists)check(mapping.data().authorUid===uid&&mapping.data().businessId===state.businessId)
          const statsRef=db.doc(`customerReviewStats/${state.businessId}`);const statsSnap=await tx.get(statsRef)
          const projection=h.projectPublishedCustomerReview(before)
          const contribution=h.customerReviewRatingContribution(before)
          if(projection)check(publicSnap.exists&&Object.keys(projection).every(key=>publicSnap.data()[key]===projection[key]))
          else check(!publicSnap.exists)
          if(contribution.count)check(statsSnap.exists)
          let nextStats
          if(statsSnap.exists)nextStats=h.applyCustomerReviewRatingDelta(statsSnap.data(),{sum:-contribution.sum,count:-contribution.count})
          // No business read/eligibility requirement: missing business does not erase authoritative stats.
          if(nextStats)tx.set(statsRef,nextStats)
          tx.delete(publicRef);tx.delete(mappingRef)
          tx.set(db.doc(`customerReviewSlots/${pair}`),{authorUid:uid,businessId:state.businessId,
            publicReviewId:state.publicReviewId,customerReviewCleanup:true})
        }
        tx.set(progressRef,{phase:'revisions',pair,publicReviewId:state.publicReviewId})
        return false
      }
      if(['revisions','receipts','audits','targetReports','targetReportReceipts','targetReportAudits'].includes(phase)) {
        check(typeof progress.pair==='string'&&/^[a-f0-9]{64}$/.test(progress.pair)&&contracts.isCustomerReviewId(progress.publicReviewId))
        const marker=await tx.get(db.doc(`customerReviewSlots/${progress.pair}`))
        check(marker.exists&&marker.data().customerReviewCleanup===true&&marker.data().authorUid===uid
          &&marker.data().publicReviewId===progress.publicReviewId
          &&progress.pair===customerReviewPairKey(marker.data().businessId,uid))
        const query=phase==='revisions'?db.collection(`customerReviewSlots/${progress.pair}/revisions`)
          :phase==='receipts'?db.collection('customerReviewRequests').where('outcome.publicReviewId','==',progress.publicReviewId)
            :phase==='audits'?db.collection('customerReviewAudits').where('pair','==',progress.pair)
              :db.collection(phase==='targetReports'?'customerReviewReports':phase==='targetReportReceipts'?'customerReviewReportRequests':'customerReviewReportAudits').where('publicReviewId','==',progress.publicReviewId)
        const rows=await tx.get(query.limit(pageSize))
        for(const row of rows.docs)tx.delete(row.ref)
        if(rows.empty) {
          if(phase==='targetReportAudits'){tx.delete(db.doc(`customerReviewSlots/${progress.pair}`));tx.set(progressRef,{phase:'select'})}
          else tx.set(progressRef,{...progress,phase:({revisions:'receipts',receipts:'audits',audits:'targetReports',targetReports:'targetReportReceipts',targetReportReceipts:'targetReportAudits'})[phase]})
        }
        return false
      }
      if(['actorRequests','actorAudits'].includes(phase)) {
        const rows=await tx.get(db.collection(phase==='actorRequests'?'customerReviewRequests':'customerReviewAudits').where('actorUid','==',uid).limit(pageSize))
        for(const row of rows.docs)tx.delete(row.ref)
        if(rows.empty) {
          if(phase==='actorRequests')tx.set(progressRef,{phase:'actorAudits'})
          else {tx.delete(db.doc(`customerReviewQuotas/${customerReviewQuotaKey(uid)}`));tx.set(progressRef,{phase:'reporterReports'})}
        }
        return false
      }
      const reportPhases={reporterReports:['customerReviewReports','reporterUid','reporterReceipts'],
        reporterReceipts:['customerReviewReportRequests','reporterUid','reporterAudits'],
        reporterAudits:['customerReviewReportAudits','reporterUid','reportActorReceipts'],
        reportActorReceipts:['customerReviewReportRequests','actorUid','reportActorAudits'],
        reportActorAudits:['customerReviewReportAudits','actorUid',null]}
      if(reportPhases[phase]) {
        const [collection,field,next]=reportPhases[phase]
        const rows=await tx.get(db.collection(collection).where(field,'==',uid).limit(pageSize))
        for(const row of rows.docs)tx.delete(row.ref)
        if(rows.empty){
          if(next)tx.set(progressRef,{phase:next})
          else {tx.delete(db.doc(`customerReviewReportQuotas/${customerReviewReportQuotaId(uid)}`));tx.set(progressRef,{complete:true});return true}
        }
        return false
      }
      check(false)
    })
    if(done)return {complete:true}
  }
  return {complete:false}
}
