import assert from 'node:assert/strict'
import test from 'node:test'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import { readFile } from 'node:fs/promises'
import { FakeFirestore } from './fakeFirestore.mjs'
import { discoverStagingIntakePage, discoveryProgressPath, DISCOVERY_PROTOCOL, STAGING_DISCOVERY_COLLECTION } from '../src/stagingIntakeDiscovery.js'
import { retainStagingEvent, stagingEventIdentity, DEFERRED_STAGING_EVENTS } from '../src/stagingMediaDeferral.js'
import { sweepExpiredMediaSessions } from '../src/stagingMediaMaintenance.js'
import { openCutoverControl } from './mediaCutoverFixture.mjs'
const scope={schemaVersion:1,mode:'observe-only',bucket:'demo-staging-bucket',prefix:'users/'}
const marker='request-observation-1234'
const object=(uid='one',generation='12')=>({bucket:scope.bucket,name:`users/${uid}/staging/profile/avatar`,generation,metadata:{holalocalUploadSession:marker}})
const session=o=>({kind:'profile',principalUid:o.name.split('/')[1],requestId:marker,version:3,state:'uploaded',stagingPath:o.name,stagingGeneration:o.generation})
const put=(db,path,value)=>db.runTransaction(async tx=>{tx.set(db.doc(path),value)})
const data=async(db,path)=>(await db.doc(path).get()).data()
const candidate=(db,o)=>data(db,`${STAGING_DISCOVERY_COLLECTION}/${stagingEventIdentity(o)}`)
const page=(items,nextPageToken=null,s=scope)=>({protocol:DISCOVERY_PROTOCOL,bucket:s.bucket,prefix:s.prefix,inventoryMode:'live-only',items,nextPageToken})
const inventory=fn=>({protocol:DISCOVERY_PROTOCOL,listPage:fn})
const scan=(db,items,s=scope)=>discoverStagingIntakePage({db,scope:s,inventory:inventory(async()=>page(items,null,s))})
const emulator=process.env.HOLALOCAL_DISCOVERY_EMULATOR==='1'
let app,realDb
if(emulator){
 assert.equal(process.env.GCLOUD_PROJECT,'demo-holalocal-functions');assert.match(process.env.FIRESTORE_EMULATOR_HOST,/^127\.0\.0\.1:/)
 const {initializeApp}=await import('firebase-admin/app');const {getFirestore}=await import('firebase-admin/firestore')
 app=initializeApp();realDb=getFirestore(app)
}
async function database(){
 if(!emulator)return new FakeFirestore()
 for(const c of [STAGING_DISCOVERY_COLLECTION,DEFERRED_STAGING_EVENTS,'maintenanceProgress','mediaUploadSessions','mediaCutoverHolds','mediaCutoverControls'])await realDb.recursiveDelete(realDb.collection(c))
 return realDb
}

test('surviving object gets non-executable evidence; no intake, cleanup, mutation or gate is invoked',async()=>{
 const db=await database(),o=object()
 await scan(db,[o]);const row=await candidate(db,o)
 assert.equal(row.state,'observation-only');assert.equal(row.executable,false)
 assert.equal(row.observation.binding,'session-absent');assert.equal(row.observation.exactIntake,'absent')
 assert.equal((await db.collection(DEFERRED_STAGING_EVENTS).get()).size,0)
 await put(db,'mediaCutoverControls/current',openCutoverControl())
 await sweepExpiredMediaSessions({db,bucket:{file:()=>assert.fail('discovery executed Storage')}})
 assert.equal((await candidate(db,o)).version,1)
 assert.equal((await db.collection(DEFERRED_STAGING_EVENTS).get()).size,0)
 const source=await readFile(new URL('../src/index.js',import.meta.url),'utf8')
 assert.equal(source.includes('stagingIntakeDiscovery'),false)
})

test('exact pending/completed/transferred intake and nullable bucket evidence remain unchanged and separate',async()=>{
 const db=await database()
 for(const [i,disposition] of [null,'unclassified','transferred'].entries()){
  const o=object(`u${i}`),ref=(await retainStagingEvent({db,object:o,marker,now:new Date(0)})).ref
  if(disposition)await put(db,ref.path,{...(await data(db,ref.path)),state:'completed',evidence:{schemaVersion:1,disposition}})
  const before=await data(db,ref.path)
  await retainStagingEvent({db,object:{...o,bucket:null},marker,now:new Date(0)})
  await scan(db,[o]);const row=await candidate(db,o)
  assert.equal(row.observation.exactIntake,disposition?`completed-${disposition}`:'pending')
  assert.equal(row.observation.nullableIntake,'present-unresolved-bucket')
  assert.deepEqual(await data(db,ref.path),before)
 }
})

test('bindings distinguish absence, mismatch, replacement, marker changes, protected promotion and held account',async()=>{
 const db=await database(),o=object()
 await put(db,'mediaUploadSessions/profile_one',{...session(o),state:'promoting',promotionObligation:'copying'})
 await put(db,'mediaCutoverHolds/one',{state:'held'})
 await scan(db,[o]);let row=await candidate(db,o)
 assert.equal(row.observation.binding,'verified');assert.equal(row.observation.promotion,'protected')
 assert.equal(row.observation.hold,'record-present');assert.equal(row.observation.dependency.sessionVersion,3)
 await put(db,'mediaUploadSessions/profile_one',{...session(o),requestId:'replacement',version:4})
 await scan(db,[o]);row=await candidate(db,o)
 assert.equal(row.observation.binding,'marker-mismatch');assert.equal(row.observation.dependency,null)
 assert.equal(row.history.protectionObserved,true);assert.equal(row.history.holdObserved,true)
 assert.equal(row.history.bindings[0].dependency.sessionVersion,3)
 await scan(db,[{...o,metadata:{holalocalUploadSession:'different-request-1234'}}])
 assert.equal((await candidate(db,o)).observation.binding,'marker-changed')
 assert.equal((await candidate(db,o)).marker,marker)
 await scan(db,[o]);assert.equal((await candidate(db,o)).observation.binding,'marker-changed')
 const s={...scope,prefix:'businesses/'},business={...o,name:'businesses/b1/staging/logos/logo'}
 await put(db,'businesses/b1',{ownerId:'current-owner'})
 await scan(db,[business],s)
 const b=await candidate(db,business);assert.equal(b.observation.binding,'session-absent');assert.equal(b.observation.hold,'unknown')
 assert.equal(b.observation.dependency,null)
})

test('pages persist restart cursor, account for skipped paths and revisit insertions on a later cycle',async()=>{
 let db=await database()
 let items=Array.from({length:30},(_,i)=>object(`u${String(i).padStart(2,'0')}`))
 const calls=[]
 // Adapter models an exclusive lexical boundary token, including when its object
 // disappears. This tests our protocol; it is not a provider inventory claim.
 const inv=inventory(async req=>{
  calls.push(req);const sorted=items.filter(o=>!req.pageToken||o.name>req.pageToken).sort((a,b)=>a.name.localeCompare(b.name))
  const selected=sorted.slice(0,req.maxResults)
  return page(selected,sorted.length>selected.length?selected.at(-1).name:null)
 })
 await discoverStagingIntakePage({db,scope,inventory:inv})
 const first=await data(db,discoveryProgressPath(scope));assert.equal(first.page.recorded,25)
 items=items.filter(o=>o.name!==first.pageToken);items.push(object('aaa'))
 if(!emulator){
  db=new FakeFirestore(Object.fromEntries(db.store))
  await discoverStagingIntakePage({db,scope,inventory:inv})
 }else{
  const remaining=items.filter(o=>o.name>first.pageToken)
  const script=`
    import {initializeApp,deleteApp} from ${JSON.stringify(import.meta.resolve('firebase-admin/app'))};
    import {getFirestore} from ${JSON.stringify(import.meta.resolve('firebase-admin/firestore'))};
    import {discoverStagingIntakePage} from ${JSON.stringify(new URL('../src/stagingIntakeDiscovery.js',import.meta.url).href)};
    const app=initializeApp(),db=getFirestore(app);let request;
    await discoverStagingIntakePage({db,scope:${JSON.stringify(scope)},inventory:{protocol:${JSON.stringify(DISCOVERY_PROTOCOL)},listPage:async req=>{request=req;return ${JSON.stringify(page(remaining))}}}});
    console.log(JSON.stringify(request));await db.terminate();await deleteApp(app);
  `
  const {stdout}=await promisify(execFile)(process.execPath,['--input-type=module','-e',script])
  calls.push(JSON.parse(stdout.trim()))
 }
 assert.equal(calls[1].pageToken,first.pageToken);assert.equal(await candidate(db,object('aaa')),undefined)
 await discoverStagingIntakePage({db,scope,inventory:inv})
 assert.ok(await candidate(db,object('aaa')))
 assert.ok(calls.every(c=>c.maxResults===25&&c.inventoryMode==='live-only'))
 await scan(db,[{...object(),name:'users/one/unrecognized'}])
 assert.equal((await data(db,discoveryProgressPath(scope))).page.skippedUnrecognized,1)
})

test('concurrent stale scanner cannot overwrite observations or progress; live intake remains independent',async()=>{
 const db=await database(),o=object();let enter,release
 const started=new Promise(r=>{enter=r}),barrier=new Promise(r=>{release=r})
 const slow=discoverStagingIntakePage({db,scope,inventory:inventory(async()=>{enter();await barrier;return page([o])})})
 await started
 await scan(db,[o]);await retainStagingEvent({db,object:o,marker,now:new Date()});await scan(db,[o])
 const before=await candidate(db,o),progress=await data(db,discoveryProgressPath(scope))
 release();assert.equal((await slow).status,'stale')
 assert.deepEqual(await candidate(db,o),before);assert.deepEqual(await data(db,discoveryProgressPath(scope)),progress)
 assert.equal(before.observation.exactIntake,'pending')
})

test('page and atomic checkpoint failures cannot skip or partially commit candidates',async()=>{
 const db=await database(),o=object()
 await assert.rejects(discoverStagingIntakePage({db,scope,inventory:inventory(async()=>{throw Error('private secret')})}),/^Error: discovery-inventory-unavailable$/)
 const wrapped={doc:p=>db.doc(p),runTransaction:callback=>db.runTransaction(async tx=>{
  const set=tx.set.bind(tx);tx.set=(ref,value)=>{if(ref.path===discoveryProgressPath(scope))throw Error('checkpoint fault');return set(ref,value)}
  return callback(tx)
 })}
 await assert.rejects(scan(wrapped,[o]),/checkpoint fault/)
 assert.equal(await candidate(db,o),undefined);assert.equal(await data(db,discoveryProgressPath(scope)),undefined)
 await scan(db,[o]);assert.ok(await candidate(db,o))
})

test('lost successful checkpoint response is idempotent and does not skip the following page',async()=>{
 const db=await database(),o=object();let lost=false
 const wrapped={doc:p=>db.doc(p),runTransaction:async callback=>{
  const result=await db.runTransaction(callback)
  if(!lost){lost=true;throw Error('lost response')}return result
 }}
 const inv=inventory(async req=>req.pageToken===null?page([o],'next-page'):page([object('two')]))
 await assert.rejects(discoverStagingIntakePage({db:wrapped,scope,inventory:inv}),/lost response/)
 assert.ok(await candidate(db,o))
 await discoverStagingIntakePage({db,scope,inventory:inv})
 assert.ok(await candidate(db,object('two')))
 assert.equal((await candidate(db,o)).version,1)
})

test('exact generations never coalesce; malformed scope and unsupported inventory fail closed',async()=>{
 const db=await database(),o=object()
 for(const invalid of [undefined,{...scope,bucket:null},{...scope,mode:'process'},{...scope,prefix:''}]){
  await assert.rejects(discoverStagingIntakePage({db,scope:invalid,inventory:inventory(()=>assert.fail())}),/scope-invalid/)
 }
 for(const response of [page([{...o,generation:12}]),page([{...o,bucket:'other-bucket'}]),page([o,o]),{...page([o]),inventoryMode:'versions'},page([o],''),page(Array(26).fill(o))]){
  await assert.rejects(discoverStagingIntakePage({db,scope,inventory:inventory(async()=>response)}),/discovery-/)
  assert.equal(await data(db,discoveryProgressPath(scope)),undefined)
 }
 await scan(db,[o]);await scan(db,[object('one','13')])
 assert.equal((await db.collection(STAGING_DISCOVERY_COLLECTION).get()).size,2)
 const invalidMarker={...object('bad'),metadata:{holalocalUploadSession:'raw sensitive content !'}}
 await scan(db,[invalidMarker]);const row=await candidate(db,invalidMarker)
 assert.equal(row.marker,null);assert.equal(row.markerStatus,'invalid');assert.equal(JSON.stringify(row).includes('sensitive'),false)
})

test.after(async()=>{if(app){await realDb.terminate();const {deleteApp}=await import('firebase-admin/app');await deleteApp(app)}})

test('history retains verified binding and exact generations after session absence',async()=>{
 const db=await database(),o=object(),path='mediaUploadSessions/profile_one'
 await put(db,path,{...session(o),canonicalPath:'users/one/profile/avatar',promotedGeneration:'99'})
 await scan(db,[o]);const before=await candidate(db,o)
 await db.runTransaction(async tx=>tx.delete(db.doc(path)))
 await scan(db,[o]);const after=await candidate(db,o)
 assert.equal(after.observation.binding,'session-absent');assert.equal(after.observation.dependency,null)
 assert.deepEqual(after.history.bindings,before.history.bindings)
 assert.equal(after.history.bindings[0].dependency.destination.generation,'99')
 assert.equal(after.history.conflict,true);assert.equal(after.executable,false)
})

test('protected promotion remains historically unresolved after absence, without claiming current activity',async()=>{
 const db=await database(),o=object(),path='mediaUploadSessions/profile_one'
 await put(db,path,{...session(o),state:'promoting',promotionObligation:'copying',cleanupPending:true})
 await scan(db,[o]);await db.runTransaction(async tx=>tx.delete(db.doc(path)))
 await scan(db,[o]);const row=await candidate(db,o)
 assert.equal(row.observation.promotion,'not-established')
 assert.equal(row.history.protectionObserved,true);assert.equal(row.history.cleanupObserved,true)
 assert.equal(row.history.bindings[0].protectionObserved,true)
 assert.equal(row.history.bindings[0].dependency.requestId,marker)
})

test('replacement request/version cannot erase prior binding or protection',async()=>{
 const db=await database(),o=object(),path='mediaUploadSessions/profile_one'
 await put(db,path,{...session(o),state:'promoting',promotionObligation:'copying'})
 await scan(db,[o]);const before=await candidate(db,o)
 await put(db,path,{...session(o),requestId:'replacement-request-1234',version:4})
 await scan(db,[o]);const row=await candidate(db,o)
 assert.equal(row.observation.binding,'marker-mismatch')
 assert.deepEqual(row.history.bindings,before.history.bindings)
 assert.equal(row.history.conflict,true)
})

test('identical observations do not grow history, including dependency property reordering',async()=>{
 const db=await database(),o=object()
 await put(db,'mediaUploadSessions/profile_one',session(o));await scan(db,[o])
 const before=await candidate(db,o)
 const ref=db.doc(`${STAGING_DISCOVERY_COLLECTION}/${stagingEventIdentity(o)}`)
 const dependency=before.history.bindings[0].dependency
 before.history.bindings[0].dependency=Object.fromEntries(Object.entries(dependency).reverse())
 await put(db,ref.path,before)
 for(let i=0;i<6;i++)await scan(db,[o])
 assert.deepEqual((await candidate(db,o)).history,before.history)
})

test('four binding capacity preserves first evidence and latches overflow/conflict permanently',async()=>{
 const db=await database(),o=object()
 for(let version=1;version<=4;version++){
  await put(db,'mediaUploadSessions/profile_one',{...session(o),version,state:'promoting',promotionObligation:'copying'})
  await scan(db,[o])
 }
 const full=await candidate(db,o)
 assert.equal(full.history.bindings.length,4);assert.equal(full.history.overflow,false)
 await put(db,'mediaUploadSessions/profile_one',{...session(o),version:5});await scan(db,[o])
 const overflow=await candidate(db,o)
 assert.deepEqual(overflow.history.bindings,full.history.bindings)
 assert.equal(overflow.history.overflow,true);assert.equal(overflow.history.conflict,true)
 assert.equal(overflow.observation.dependency.sessionVersion,5)
 await put(db,'mediaUploadSessions/profile_one',{...session(o),version:1});await scan(db,[o])
 assert.equal((await candidate(db,o)).history.overflow,true)
 assert.equal((await candidate(db,o)).history.bindings.length,4)
})

test('stale concurrent scan cannot erase accumulated history',async()=>{
 const db=await database(),o=object();let enter,release
 await put(db,'mediaUploadSessions/profile_one',{...session(o),state:'promoting',promotionObligation:'copying'})
 await scan(db,[o])
 const started=new Promise(r=>{enter=r}),barrier=new Promise(r=>{release=r})
 const slow=discoverStagingIntakePage({db,scope,inventory:inventory(async()=>{enter();await barrier;return page([o])})})
 await started
 await put(db,'mediaUploadSessions/profile_one',{...session(o),version:4})
 await scan(db,[o]);const before=await candidate(db,o)
 release();assert.equal((await slow).status,'stale')
 assert.deepEqual(await candidate(db,o),before)
 assert.equal(before.history.bindings.length,2);assert.equal(before.history.protectionObserved,true)
})

test('legacy latest evidence is preserved conservatively; unknown history blocks atomic progress',async()=>{
 const db=await database(),o=object()
 await put(db,'mediaUploadSessions/profile_one',session(o));await scan(db,[o])
 const row=await candidate(db,o),path=`${STAGING_DISCOVERY_COLLECTION}/${stagingEventIdentity(o)}`
 delete row.history;row.schemaVersion=1;await put(db,path,row)
 await db.runTransaction(async tx=>tx.delete(db.doc('mediaUploadSessions/profile_one')))
 await scan(db,[o]);const upgraded=await candidate(db,o)
 assert.equal(upgraded.history.priorHistoryUnknown,true)
 assert.equal(upgraded.history.bindings[0].dependency.sessionVersion,3)
 const progress=await data(db,discoveryProgressPath(scope))
 await put(db,path,{...upgraded,history:{...upgraded.history,schemaVersion:99}})
 await assert.rejects(scan(db,[o]),/history-incompatible/)
 assert.deepEqual(await data(db,discoveryProgressPath(scope)),progress)
})

for (const [label,categories] of [
 ['unknown category',['unsupported-category']],
 ['duplicate categories',['absent','absent']],
 ['reported seven-entry malformed history',Array(7).fill('unsupported-category')],
]) test(`persisted intake history rejects ${label} without changing candidate or progress`,async()=>{
 const db=await database(),o=object()
 await scan(db,[o]);const row=await candidate(db,o)
 row.history.intakeStates=categories
 await put(db,`${STAGING_DISCOVERY_COLLECTION}/${stagingEventIdentity(o)}`,row)
 const before=await candidate(db,o),progress=await data(db,discoveryProgressPath(scope))
 await assert.rejects(scan(db,[o]),/^Error: discovery-history-incompatible$/)
 assert.deepEqual(await candidate(db,o),before)
 assert.deepEqual(await data(db,discoveryProgressPath(scope)),progress)
})

test('valid maximum-size intake history remains idempotent on repeated observations',async()=>{
 const db=await database(),o=object()
 await scan(db,[o]);const row=await candidate(db,o)
 row.history.intakeStates=['absent','unknown-or-conflicting','pending','completed-settled',
  'completed-transferred','completed-protected','completed-unclassified']
 await put(db,`${STAGING_DISCOVERY_COLLECTION}/${stagingEventIdentity(o)}`,row)
 const before=await candidate(db,o)
 for(let i=0;i<3;i++)await scan(db,[o])
 const after=await candidate(db,o)
 assert.deepEqual(after.history,before.history)
 assert.equal(after.version,before.version+3)
})

test('malformed history late in page prevents both earlier candidate writes and checkpoint advancement',async()=>{
 const db=await database(),existing=object('existing'),fresh=object('fresh'),bad=object('bad')
 await scan(db,[existing,bad])
 const row=await candidate(db,bad);row.history.intakeStates=['pending','pending']
 await put(db,`${STAGING_DISCOVERY_COLLECTION}/${stagingEventIdentity(bad)}`,row)
 const beforeExisting=await candidate(db,existing),beforeBad=await candidate(db,bad)
 const progress=await data(db,discoveryProgressPath(scope))
 await assert.rejects(scan(db,[existing,fresh,bad]),/^Error: discovery-history-incompatible$/)
 assert.deepEqual(await candidate(db,existing),beforeExisting)
 assert.equal(await candidate(db,fresh),undefined)
 assert.deepEqual(await candidate(db,bad),beforeBad)
 assert.deepEqual(await data(db,discoveryProgressPath(scope)),progress)
})
