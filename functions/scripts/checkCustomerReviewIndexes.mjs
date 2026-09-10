// Read-only: validates repository intent or a saved gcloud composite-index export.
// This does not contact Firebase and cannot establish deployed readiness without an export.
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
export function checkCustomerReviewIndexes(config, deployed) {
 const required=[
  ['customerReviewsPublic',['businessId','ASCENDING'],['publishedAt','DESCENDING'],['publicReviewId','ASCENDING']],
  ['customerReviewSlots',['authorUid','ASCENDING'],['updatedAt','DESCENDING'],['publicReviewId','ASCENDING']],
  ['customerReviewSlots',['status','ASCENDING'],['pendingSubmittedAt','ASCENDING'],['publicReviewId','ASCENDING']],
  ['customerReviewReports',['status','ASCENDING'],['createdAt','ASCENDING'],['reportId','ASCENDING']],
 ]
 const matches=(row,[group,...fields])=>(row.collectionGroup??row.name?.split('/collectionGroups/')[1]?.split('/')[0])===group
  &&row.queryScope==='COLLECTION'
  &&JSON.stringify(row.fields.filter(f=>f.fieldPath!=='__name__').map(f=>[f.fieldPath,f.order]))===JSON.stringify(fields)
 for(const spec of required) {
  if(!config.indexes.some(row=>matches(row,spec)))throw new Error('Missing local review index: '+spec[0])
  if(deployed&&!deployed.some(row=>matches(row,spec)&&row.state==='READY'))throw new Error('Deployed review index not READY: '+spec[0])
 }
 for(const row of config.fieldOverrides??[]) {
  if(['customerReviewReports','customerReviewReportRequests','customerReviewReportAudits'].includes(row.collectionGroup)
   &&['expiresAt','*'].includes(row.fieldPath)
   &&!row.indexes?.some(i=>i.order==='ASCENDING'&&i.queryScope==='COLLECTION'))throw new Error('Retention expiry index disabled')
 }
 return {requiredCompositeIndexes:4,deployedCompositeReadiness:deployed?'verified from supplied export':'not checked',deployedSingleFieldReadiness:'requires separate field-exemption inspection'}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const config=JSON.parse(readFileSync(new URL('../../firestore.indexes.json',import.meta.url),'utf8'))
 const path=process.argv[2]
 const deployed=path?JSON.parse(readFileSync(path,'utf8')):undefined
 if(deployed&&!Array.isArray(deployed))throw new Error('Expected gcloud JSON index array')
 console.log(JSON.stringify(checkCustomerReviewIndexes(config,deployed),null,2))
}
