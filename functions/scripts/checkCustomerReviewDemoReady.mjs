import {pathToFileURL} from 'node:url'
import {confirmEmulators,businessId} from './seedCustomerReviewDemo.mjs'
const origin='http://127.0.0.1:4190'
export const requiredCallables=['listPublicBusinesses','getPublicBusiness','getCustomerReviewRatingSummaries',
 'listPublishedCustomerReviews','submitCustomerReview','editCustomerReview','withdrawCustomerReview','approveCustomerReview',
 'rejectCustomerReview','removeCustomerReview','getOwnCustomerReview','listOwnCustomerReviews','listCustomerReviewModerationQueue',
 'getCustomerReviewModerationCase','submitCustomerReviewReport','listCustomerReviewReports','getCustomerReviewReport','resolveCustomerReviewReport']
const publicInputs={listPublicBusinesses:{maxResults:1},getPublicBusiness:{businessId},
 listPublishedCustomerReviews:{businessId,pageSize:1},getCustomerReviewRatingSummaries:{businessIds:[businessId]}}
export async function checkCallables(request=fetch){
 for(const name of requiredCallables){
  const url=`http://127.0.0.1:5001/demo-holalocal-functions/europe-west1/${name}`
  const options=await request(url,{method:'OPTIONS',redirect:'error',signal:AbortSignal.timeout(10000),headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,authorization'}})
  if(!options.ok||options.headers.get('access-control-allow-origin')!==origin)throw new Error(`${name}: preflight not ready (HTTP ${options.status}); inspect Functions loading and CORS.`)
  const methods=options.headers.get('access-control-allow-methods')??'',headers=options.headers.get('access-control-allow-headers')??''
  if(!methods.includes('POST')||!headers.toLowerCase().includes('content-type')||!headers.toLowerCase().includes('authorization'))throw new Error(`${name}: incomplete preflight.`)
  const response=await request(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({data:publicInputs[name]??{}})})
  if(response.headers.get('access-control-allow-origin')!==origin)throw new Error(`${name}: POST lacks expected origin.`)
  let body;try{body=await response.json()}catch{throw new Error(`${name}: non-callable response (HTTP ${response.status}).`)}
  if(Object.hasOwn(publicInputs,name)){
   if(!response.ok||!Object.hasOwn(body,'result'))throw new Error(`${name}: public read failed (HTTP ${response.status}).`)
   if(name==='getPublicBusiness'&&!body.result?.business)throw new Error(`${name}: seeded business missing.`)
  }else if(response.status!==401||body.error?.status!=='UNAUTHENTICATED')throw new Error(`${name}: expected anonymous authentication rejection (HTTP ${response.status}).`)
 }
}
async function main(){await confirmEmulators(process.env);await checkCallables();console.log('Demo callables ready: business and review OPTIONS/POST checks passed. Starting website.')}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error.message);process.exitCode=1})
