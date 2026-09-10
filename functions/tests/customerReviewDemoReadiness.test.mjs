import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,realpath} from 'node:fs/promises'
import {resolve,dirname,join} from 'node:path'
import {createRequire} from 'node:module'
import {createDemoConfig} from '../scripts/customerReviewDemoSetup.mjs'
import {checkCallables,requiredCallables} from '../scripts/checkCustomerReviewDemoReady.mjs'
const origin='http://127.0.0.1:4190'
function response(status,body,extra={}){return {status,ok:status>=200&&status<300,headers:new Headers({'access-control-allow-origin':origin,'access-control-allow-methods':'POST','access-control-allow-headers':'content-type,authorization',...extra}),json:async()=>body}}
function good(url,options){
 if(options.method==='OPTIONS')return response(204,{})
 const name=url.split('/').at(-1)
 if(['listPublicBusinesses','getPublicBusiness','listPublishedCustomerReviews','getCustomerReviewRatingSummaries'].includes(name))return response(200,{result:name==='getPublicBusiness'?{business:{businessId:'review-demo-business-v1'}}:{}})
 return response(401,{error:{status:'UNAUTHENTICATED'}})
}
test('generated project resolves Functions and rules using actual installed Firebase Config.path',async()=>{
 const root=resolve(import.meta.dirname,'../..'),path=await createDemoConfig(root),data=JSON.parse(await readFile(path,'utf8'))
 const require=createRequire(import.meta.url),{Config}=require('firebase-tools/lib/config')
 const config=new Config(data,{projectDir:dirname(path)})
 for(const file of ['functions','firestore.rules','firestore.indexes.json','storage.rules'])assert.equal(await realpath(config.path(file)),resolve(root,file))
 assert.equal(await realpath(join(dirname(path),data.functions[0].source)),resolve(root,'functions'));
 assert.equal(data.functions[0].source,'functions');assert.equal(data.emulators.functions.host,'127.0.0.1')
})
test('readiness covers business and all review callable preflights, public reads and anonymous denials only',async()=>{
 const calls=[];await checkCallables(async(url,options)=>{calls.push({url,options});return good(url,options)})
 assert.equal(calls.length,requiredCallables.length*2)
 assert.ok(calls.every(({url,options})=>url.startsWith('http://127.0.0.1:5001/demo-holalocal-functions/europe-west1/')&&options.redirect==='error'&&!options.headers.Authorization))
})
test('missing functions or rejected origins stop readiness before any POST',async()=>{
 for(const reply of [response(404,{}),response(204,{}, {'access-control-allow-origin':'http://other.invalid'})]){
  let calls=0;await assert.rejects(checkCallables(async()=>{calls++;return reply}),/preflight/);assert.equal(calls,1)
 }
})
test('gate errors, missing seeded business, invalid responses and missing authentication checks fail readiness',async()=>{
 for(const target of ['getPublicBusiness','listPublishedCustomerReviews','submitCustomerReview']){
  await assert.rejects(checkCallables(async(url,options)=>{
   if(options.method==='POST'&&url.endsWith('/'+target))return response(200,{result:{}})
   // Simulate the review gate refusing activation rather than returning public data.
   if(target==='listPublishedCustomerReviews'&&options.method==='POST')return response(500,{error:{status:'INTERNAL'}})
   return good(url,options)
  }))
 }
})
