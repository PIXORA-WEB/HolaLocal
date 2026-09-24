import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {prepareBusinessMediaPresentation,resolveBusinessMediaPresentation} from '../src/services/businessMediaPresentation.js'
const source=await readFile(new URL('../src/services/conversationService.js',import.meta.url),'utf8')
const start=source.indexOf('export async function getParticipantBusinessContext')
const end=source.indexOf('export async function hideConversationForUser',start)
const factory=new Function('getConversationBusinessContextCallable','prepareBusinessMediaPresentation','resolveBusinessMediaPresentation',source.slice(start,end).replace('export ','')+';return getParticipantBusinessContext')
const context={businessId:'a',name:'Validated A',canSendMessages:false,profileAvailable:true,logoStoragePath:'businesses/a/logos/logo/a'}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}}
test('actual service option returns filtered validated context without media; default callers still await media',async()=>{
 const media=deferred();let calls=0,downloads=0
 const read=factory(async()=>{calls++;return{data:{businessContext:context}}},prepareBusinessMediaPresentation,()=>{downloads++;return media.promise})
 const prepared=await read('a',{deferMedia:true});assert.equal(prepared.name,context.name);assert.equal(prepared.canSendMessages,false);assert.equal(prepared.logoUrl,null);assert.equal(downloads,0)
 const pending=read('a');await new Promise(setImmediate);assert.equal(downloads,1);media.resolve(prepared);await pending;assert.equal(calls,2)
})
test('context rejection and absence are not converted into successful prepared data',async()=>{
 let downloads=0
 const read=factory(async()=>{throw Error('denied')},prepareBusinessMediaPresentation,()=>downloads++)
 await assert.rejects(read('a',{deferMedia:true}),/denied/);assert.equal(downloads,0)
 assert.equal(await factory(async()=>({data:{businessContext:null}}),prepareBusinessMediaPresentation,()=>downloads++)('a',{deferMedia:true}),null)
})
test('optional media failure preserves context fields and fallback',async()=>{
 const result=await resolveBusinessMediaPresentation('a',context,{signal:new AbortController().signal,resolveCanonicalUrl:async()=>{throw Error('missing')}})
 assert.equal(result.name,'Validated A');assert.equal(result.canSendMessages,false);assert.equal(result.logoUrl,null)
})
test('late stale URLs are revoked exactly once without revoking current presentation',async()=>{
 const a=new AbortController(),b=new AbortController(),late=deferred(),revoked=[]
 const old=resolveBusinessMediaPresentation('a',context,{signal:a.signal,resolveCanonicalUrl:()=>late.promise})
 await new Promise(setImmediate);a.abort()
 const current=await resolveBusinessMediaPresentation('a',context,{signal:b.signal,resolveCanonicalUrl:async()=>({url:'blob:current',revoke:()=>revoked.push('current')})})
 late.resolve({url:'blob:old',revoke:()=>revoked.push('old')});await old
 assert.deepEqual(revoked,['old']);assert.equal(current.logoUrl,'blob:current');b.abort();b.abort();assert.deepEqual(revoked,['old','current'])
})
