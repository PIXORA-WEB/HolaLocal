import {getAuth} from 'firebase-admin/auth'
import {FieldPath} from 'firebase-admin/firestore'
import {info} from 'firebase-functions/logger'
import {isAutomaticErasureEligible} from './accountDeletionPrimitives.js'
import {finalizeAccountDeletion} from './accountDeletionFinalizer.js'

// Only a scheduler/internal caller can reach this service. No public callable is added.
export async function recoverAuthorisedAccountDeletions({db,auth=getAuth(),pageSize=25,finalize=finalizeAccountDeletion}) {
 if(!Number.isInteger(pageSize)||pageSize<1||pageSize>25)throw new Error('invalid-recovery-page-size')
 const progress=db.doc('maintenanceProgress/accountDeletionRecovery')
 const cursor=(await progress.get()).data()?.documentId
 let query=db.collection('accountDeletionRequests').orderBy(FieldPath.documentId())
 if(typeof cursor==='string'&&cursor)query=query.startAfter(cursor)
 const page=await query.limit(pageSize).get()
 const counts={examined:page.size,resumed:0,completed:0,failed:0,blocked:0,exhausted:0,pending:0,pageLimitReached:page.size===pageSize}
 for(const doc of page.docs){
  await progress.set({documentId:doc.id}) // Interrupted work is retried after the cursor wraps and its lease expires.
  const row=doc.data()
  if(row.state==='requested')counts.pending++
  if(['failed_retryable','finalizing'].includes(row.state)&&(row.retryCount??0)>=5)counts.exhausted++
  if(!isAutomaticErasureEligible(row))continue
  try{
   const admin=await auth.getUser(row.finalizedBy)
   if(admin.disabled||admin.customClaims?.admin!==true){counts.blocked++;continue}
   // Pass the real current admin claims; core rechecks ownership and lease/version atomically.
   const result=await finalize({adminUid:admin.uid,claims:admin.customClaims,uid:doc.id,expectedRequestVersion:row.requestVersion,db,recovery:true})
   counts.resumed++
   if(result.state==='completed')counts.completed++
   else if(result.blockerCode)counts.blocked++
   else counts.failed++
  }catch{counts.failed++}
 }
 await progress.set({documentId:page.size===pageSize?page.docs.at(-1).id:null})
 return counts
}
export async function runAccountDeletionRecovery({env=process.env,createDatabase,auth}){
 if(env.ACCOUNT_DELETION_RECOVERY_ENABLED!=='true')return {disabled:true}
 const result=await recoverAuthorisedAccountDeletions({db:createDatabase(),auth})
 info('account-deletion-recovery',result)
 return result
}
