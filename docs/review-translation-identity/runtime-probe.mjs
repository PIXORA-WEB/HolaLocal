// Diagnostic entrypoint only. Never deployed as a website or Function.
import assert from 'node:assert/strict'
import {writeFile} from 'node:fs/promises'
import translate from '@google-cloud/translate'
import {createGoogleCloudTranslator,sanitizeGoogleTranslationError} from './src/providers/googleCloudTranslator.js'
import {createCustomerReviewTranslationService,REVIEW_TRANSLATION_PROVIDER_OPTIONS,reviewTranslationProviderVersion} from './src/customerReviewTranslation.js'
import {CustomerReviewFakeDatabase} from './tests/customerReviewFakeDatabase.mjs'
import {fixtureData} from './tests/customerReviewReadFixtures.mjs'
const text='This is a synthetic review of a fictional service for translation testing.'
const project='holalocal-491c9',identity='holalocal-review-translation@holalocal-491c9.iam.gserviceaccount.com'
const mode=process.argv[2]??'--plan'
assert.ok(['--plan','--self-test','--execute-approved'].includes(mode))
assert.equal([...text].length,74)
const plan={project,identity,endpoint:REVIEW_TRANSLATION_PROVIDER_OPTIONS.apiEndpoint,location:REVIEW_TRANSLATION_PROVIDER_OPTIONS.location,model:'general/base',maximumRequests:1,maximumCharacters:74,retries:0,database:'in-memory synthetic fixture only',estimatedTranslationUSD:0.00148}
let requests=0,characters=0,stage='plan'
async function checkPermissions(){
 stage='runtime-identity'
 assert.equal(process.env.CLOUD_RUN_JOB,'holalocal-review-translation-identity-probe')
 assert.equal(process.env.CLOUD_RUN_TASK_INDEX,'0');assert.equal(process.env.CLOUD_RUN_TASK_ATTEMPT,'0');assert.equal(process.env.CLOUD_RUN_TASK_COUNT,'1')
 assert.equal(process.env.HOLALOCAL_APPROVED_RUNTIME_PROBE,'dedicated-identity-candidate-v1')
 for(const key of ['GOOGLE_APPLICATION_CREDENTIALS','CLOUDSDK_AUTH_ACCESS_TOKEN','GOOGLE_OAUTH_ACCESS_TOKEN'])assert.ok(!process.env[key])
 await writeFile('/tmp/holalocal-runtime-probe-started','one execution only',{flag:'wx'})
 const headers={'Metadata-Flavor':'Google'}
 const email=await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email',{headers,signal:AbortSignal.timeout(5000)});assert.equal(email.status,200);const actualIdentity=(await email.text()).trim();console.log(JSON.stringify({stage,actualIdentity:/^[a-zA-Z0-9@._-]{1,160}$/.test(actualIdentity)?actualIdentity:'unexpected-format'}));assert.equal(actualIdentity,identity)
 const tokenResponse=await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',{headers,signal:AbortSignal.timeout(5000)});assert.equal(tokenResponse.status,200);const token=(await tokenResponse.json()).access_token;assert.ok(token)
 stage='runtime-permissions'
 const permissions=['cloudtranslate.generalModels.predict','serviceusage.services.use']
 const result=await fetch(`https://cloudresourcemanager.googleapis.com/v1/projects/${project}:testIamPermissions`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','x-goog-user-project':project},body:JSON.stringify({permissions}),signal:AbortSignal.timeout(5000)})
 const permissionBody=await result.json();const grantedPermissions=(permissionBody.permissions??[]).filter(value=>permissions.includes(value)).sort();console.log(JSON.stringify({stage,httpStatus:result.status,grantedPermissions}));assert.equal(result.status,200);assert.deepEqual(grantedPermissions,permissions.sort())
 console.log(JSON.stringify({stage,identity,permissionsVerified:true}))
}
async function run(client){
 const f=fixtureData('runtime-probe'),review=f.review('one'),database=new CustomerReviewFakeDatabase();database.data=f.data
 const path=`customerReviewsPublic/${review.publicReviewId}`;database.data.get(path).originalText=text
 const wrapped={translateText:async(request,options)=>{
  assert.equal(request.parent,`projects/${project}/locations/europe-west1`);assert.equal(request.model,`${request.parent}/models/general/base`);assert.deepEqual(request.contents,[text]);assert.equal(request.sourceLanguageCode,'en');assert.equal(request.targetLanguageCode,'es');assert.equal(options.retry,null);assert.equal(options.timeout,10000)
  assert.equal(requests,0,'second provider request forbidden');requests++;characters+=[...text].length
  return client.translateText(request,options)
 }}
 const provider=createGoogleCloudTranslator({projectId:project,...REVIEW_TRANSLATION_PROVIDER_OPTIONS,client:wrapped})
 const service=createCustomerReviewTranslationService({database,provider,providerVersion:reviewTranslationProviderVersion('google_cloud'),configured:true})
 const input={publicReviewId:review.publicReviewId,publishedRevision:1,targetLanguage:'es'}
 assert.equal((await service.translate({...input,targetLanguage:'en'})).status,'original');assert.equal(requests,0)
 stage='provider-rpc-and-cache'
 const first=await service.translate(input);assert.equal(first.status,'translated','provider result unavailable; stop')
 assert.deepEqual(await service.translate(input),first);assert.equal(requests,1)
 database.data.get(path).publishedRevision=2;await assert.rejects(service.translate(input),/review-refresh-required/);database.data.get(path).publishedRevision=1
 database.data.get(`businesses/${f.businessId}`).status='suspended';await assert.rejects(service.translate(input),/business-unavailable/)
 database.data.delete(path);await assert.rejects(service.translate(input),/review-refresh-required/);assert.equal(requests,1)
 return {sameLanguageBypass:true,cacheHit:true,staleRevisionRejected:true,unavailableRejected:true,removedRejected:true,productionDatabaseWrites:0}
}
try{
 if(mode==='--plan')console.log(JSON.stringify({...plan,executed:false}))
 else if(mode==='--self-test'){
  const checks=await run({translateText:async()=>[{translations:[{translatedText:'Texto sintético de prueba.'}]}]});console.log(JSON.stringify({mode,checks,simulatedRequests:requests,paidRequests:0}))
  requests=0;characters=0;await assert.rejects(run({translateText:async()=>{throw Object.assign(new Error('injected provider failure'),{code:7})}}));assert.equal(requests,1);console.log(JSON.stringify({mode,failureStopped:true,duplicateRequests:0,paidRequests:0}))
 }else{
  await checkPermissions();const client=new translate.v3.TranslationServiceClient({apiEndpoint:REVIEW_TRANSLATION_PROVIDER_OPTIONS.apiEndpoint})
  const checks=await run(client);await client.close();console.log(JSON.stringify({...plan,stage:'complete',requests,characters,checks,qualityReviewed:false}))
 }
}catch(error){console.error(JSON.stringify({stage,requests,characters,...sanitizeGoogleTranslationError(error),success:false}));process.exitCode=1}
