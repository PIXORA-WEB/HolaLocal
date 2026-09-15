import assert from 'node:assert/strict'
import test from 'node:test'
import { FieldValue } from 'firebase-admin/firestore'
import { OpenMediaFirestore, openCutoverControl } from './mediaCutoverFixture.mjs'
import { cleanupUserMedia } from '../src/accountDeletionPrimitives.js'
import { cleanFinalizedStagingObject, sweepExpiredMediaSessions } from '../src/stagingMediaMaintenance.js'
import { checkpointStagingCleanupResponsibility } from '../src/mediaUploadSessions.js'
import { retainStagingEvent, finishStagingEvent, DEFERRED_STAGING_EVENTS } from '../src/stagingMediaDeferral.js'
const path='users/evidence/staging/profile/avatar', sessionPath='mediaUploadSessions/profile_evidence'
const marker='request-evidence-1234'
const object={name:path,generation:'12',metadata:{holalocalUploadSession:marker}}
const session={kind:'profile',principalUid:'evidence',requestId:marker,version:7,
  state:'prepared',stagingPath:path,expiresAt:new Date('2099-01-01')}
const metadata={name:path,generation:'12',metageneration:'1',contentType:'image/png',size:'12',metadata:object.metadata}
const bucket={file:()=>({getMetadata:async()=>[metadata]})}
const emulator=process.env.HOLALOCAL_EVIDENCE_EMULATOR==='1'
let app,realDb
if(emulator){
  assert.equal(process.env.GCLOUD_PROJECT,'demo-holalocal-functions')
  assert.match(process.env.FIRESTORE_EMULATOR_HOST,/^127\.0\.0\.1:/)
  const {initializeApp}=await import('firebase-admin/app')
  const {getFirestore}=await import('firebase-admin/firestore')
  app=initializeApp();realDb=getFirestore(app)
}
const put=(db,p,v)=>db.runTransaction(async tx=>{tx.set(db.doc(p),v)})
const data=async(db,p)=>(await db.doc(p).get()).data()
async function setup(extra={}){
  let db
  if(emulator){
    db=realDb
    for(const c of [DEFERRED_STAGING_EVENTS,'mediaUploadSessions','mediaCutoverHolds','mediaCutoverControls'])await db.recursiveDelete(db.collection(c))
    await put(db,'mediaCutoverControls/current',openCutoverControl())
    await put(db,sessionPath,{...session,...extra})
  }else db=new OpenMediaFirestore({[sessionPath]:{...session,...extra}})
  const retained=await retainStagingEvent({db,object,marker,now:new Date(0)})
  return {db,ref:retained.ref,run:changes=>cleanFinalizedStagingObject({db,object,bucket,clean:async()=>{},...changes})}
}

test('settled processing records commit-time evidence, not processing-start time',async()=>{
  const f=await setup();await f.run({now:new Date(1000)})
  const row=await data(f.db,f.ref.path)
  assert.equal(row.evidence.disposition,'settled');assert.equal(row.state,'completed')
  assert.equal(row.evidence.dependency,null)
  if(emulator){assert.ok(row.completedAt.toMillis()>1000);assert.equal(row.completedAt.toMillis(),row.evidence.recordedAt.toMillis())}
  else assert.ok(row.completedAt.isEqual(FieldValue.serverTimestamp()))
})

test('cleanup_retry transfers only to a transactionally existing exact session incarnation',async()=>{
  const f=await setup({state:'cleanup_retry',cleanupPending:true,stagingGeneration:'12'})
  await f.run();const row=await data(f.db,f.ref.path)
  assert.equal(row.evidence.disposition,'transferred')
  assert.deepEqual(row.evidence.dependency,{collection:'mediaUploadSessions',documentId:'profile_evidence',requestId:marker,
    sessionVersion:7,stagingGeneration:'12',observedState:'cleanup_retry',promotionObligation:null,promotedGeneration:null})
})

test('missing handoff target and checkpoint failure never manufacture transfer evidence',async()=>{
  const f=await setup({state:'cleanup_retry',cleanupPending:true,stagingGeneration:'12'})
  await f.run({checkpoint:async input=>{
    const result=await checkpointStagingCleanupResponsibility(input)
    await f.db.doc(sessionPath).delete()
    return result
  }})
  assert.equal((await data(f.db,f.ref.path)).evidence.disposition,'unclassified')
  const g=await setup()
  await assert.rejects(g.run({checkpoint:async()=>{throw Error('checkpoint failed')}}),/checkpoint failed/)
  assert.equal((await data(g.db,g.ref.path)).state,'pending')
  assert.equal((await data(g.db,g.ref.path)).evidence.disposition,'failed')
})

test('outstanding promotion is protected without another Storage operation',async()=>{
  const f=await setup({state:'promoting',promotionObligation:'copying',stagingGeneration:'12'})
  await f.run({bucket:{file:()=>assert.fail('protected operation')}})
  const row=await data(f.db,f.ref.path)
  assert.equal(row.evidence.disposition,'protected');assert.equal(row.state,'completed')
  assert.equal((await data(f.db,sessionPath)).promotionObligation,'copying')
})

test('ignored no-session processing never proves dependency-free completion; unattributable business stays pending',async()=>{
  const f=await setup();await f.db.doc(sessionPath).delete();await f.run()
  assert.equal((await data(f.db,f.ref.path)).evidence.disposition,'unclassified')
  const other={name:'businesses/b1/staging/logos/logo',generation:'99'}
  const {ref}=await retainStagingEvent({db:f.db,object:other,marker:null,now:new Date()})
  await cleanFinalizedStagingObject({db:f.db,object:other,bucket:{file:()=>assert.fail()}})
  const row=await data(f.db,ref.path);assert.equal(row.state,'pending');assert.equal(row.evidence.reason,'unattributable')
})

test('hold placed during cleaning prevents settled classification; replacement loses binding',async()=>{
  const f=await setup()
  await f.run({clean:async()=>{await put(f.db,'mediaCutoverHolds/evidence',{state:'held'})}})
  assert.equal((await data(f.db,f.ref.path)).state,'pending')
  assert.equal((await data(f.db,f.ref.path)).evidence.reason,'held')
  await f.db.doc('mediaCutoverHolds/evidence').delete() // synthetic reset only
  await f.run()
  assert.equal((await data(f.db,f.ref.path)).evidence.disposition,'settled')
  const g=await setup()
  await g.run({clean:async()=>{await put(g.db,sessionPath,{...session,version:8,requestId:'replacement'})}})
  assert.equal((await data(g.db,g.ref.path)).evidence.disposition,'unclassified')
})

test('concurrent completion and duplicate intake cannot overwrite newer terminal evidence',async()=>{
  const f=await setup({state:'uploaded',stagingGeneration:'12'})
  const args={db:f.db,ref:f.ref,expectedVersion:1,parsed:{kind:'profile',uid:'evidence'},uid:'evidence',object,marker}
  await Promise.all([finishStagingEvent({...args,result:{status:'already-clean'}}),finishStagingEvent({...args,result:{status:'already-clean'}})])
  const original=await data(f.db,f.ref.path);assert.equal(original.version,2)
  assert.equal(await finishStagingEvent({...args,failure:'processing-failed'}),false)
  await retainStagingEvent({db:f.db,object,marker,now:new Date()});await f.run()
  assert.deepEqual(await data(f.db,f.ref.path),original)
})

test('completion/timestamp write failure leaves pending; retry uses partially persisted session safely',async()=>{
  const f=await setup();const real=f.db.runTransaction.bind(f.db);let fail=true
  const wrapped={doc:p=>f.db.doc(p),runTransaction:callback=>real(async tx=>{
    const update=tx.update.bind(tx)
    tx.update=(ref,v)=>{if(fail&&ref.path===f.ref.path&&v.evidence){assert.ok(v.evidence.recordedAt.isEqual(FieldValue.serverTimestamp()));throw Error('synthetic completion timestamp write failure')}return update(ref,v)}
    return callback(tx)
  })}
  await assert.rejects(f.run({db:wrapped}),/timestamp write failure/)
  assert.equal((await data(f.db,f.ref.path)).state,'pending')
  assert.equal((await data(f.db,sessionPath)).state,'uploaded')
  fail=false;await f.run({db:wrapped,bucket:{file:()=>assert.fail('already cleaned')}})
  assert.equal((await data(f.db,f.ref.path)).evidence.disposition,'settled')
})

test('lost successful completion response cannot reset terminal evidence on retry',async()=>{
  const f=await setup();const real=f.db.runTransaction.bind(f.db)
  let lost=false
  const wrapped={doc:p=>f.db.doc(p),runTransaction:async callback=>{
    let completion=false
    const result=await real(async tx=>{
      const update=tx.update.bind(tx)
      tx.update=(ref,v)=>{if(ref.path===f.ref.path&&v.state==='completed')completion=true;return update(ref,v)}
      return callback(tx)
    })
    if(completion&&!lost){lost=true;throw Error('lost commit response')}
    return result
  }}
  await assert.rejects(f.run({db:wrapped}),/lost commit response/)
  const original=await data(f.db,f.ref.path);assert.equal(original.state,'completed')
  await f.run({bucket:{file:()=>assert.fail()}})
  assert.deepEqual(await data(f.db,f.ref.path),original)
})

test('processing failure retains bounded reason; legacy completed and unknown schemas remain conservative',async()=>{
  const f=await setup();await assert.rejects(f.run({bucket:{file:()=>{throw Error('private-path secret')}}}),/private-path/)
  const failed=await data(f.db,f.ref.path)
  assert.equal(failed.state,'pending');assert.equal(failed.evidence.reason,'processing-failed')
  assert.equal(JSON.stringify(failed).includes('secret'),false)
  for(const row of [{...failed,state:'completed',evidence:null},{...failed,schemaVersion:99},{...failed,evidence:{schemaVersion:99}}]){
    await put(f.db,f.ref.path,row);await f.run({bucket:{file:()=>assert.fail()}})
    assert.deepEqual(await data(f.db,f.ref.path),row)
  }
})

test('transferred cleanup survives partial/repeated Storage failure and scheduled retry removes exact retained generation',async()=>{
  const f=await setup({state:'cleanup_retry',cleanupPending:true,stagingGeneration:'12',expiresAt:new Date(0)})
  await put(f.db,'users/evidence',{accountStatus:'deletion_requested',deletionRequestedAt:new Date(0)})
  await f.run()
  const eventBefore=await data(f.db,f.ref.path), sessionBefore=await data(f.db,sessionPath)
  assert.equal(eventBefore.evidence.disposition,'transferred')
  const objects=new Map([[path,'12'],['users/evidence/other','15']])
  const failingBucket={getFiles:async({prefix})=>{
    assert.equal(prefix,'users/evidence/')
    return [[...objects.keys()].map(name=>({delete:async()=>{
      if(name===path)throw Error('synthetic storage unavailable')
      objects.delete(name)
    }}))]
  }}
  assert.deepEqual(await cleanupUserMedia({uid:'evidence',db:f.db,bucket:failingBucket}),{
    ok:false,retryable:true,counts:{attempted:2,deleted:1,alreadyMissing:0,failed:1}})
  assert.deepEqual(await data(f.db,sessionPath),sessionBefore)
  assert.deepEqual((await cleanupUserMedia({uid:'evidence',db:f.db,bucket:failingBucket})).counts,
    {attempted:1,deleted:0,alreadyMissing:0,failed:1})
  assert.deepEqual(await data(f.db,sessionPath),sessionBefore)
  await sweepExpiredMediaSessions({db:f.db,bucket:{},remove:async target=>{
    assert.equal(target.path,path);assert.equal(String(target.generation),'12');throw Error('scheduled failure')
  }})
  assert.equal((await data(f.db,sessionPath)).requestId,marker)
  assert.equal((await data(f.db,sessionPath)).stagingGeneration,'12')
  const result=await sweepExpiredMediaSessions({db:f.db,bucket:{},remove:async target=>{
    assert.equal(target.path,path);assert.equal(String(target.generation),objects.get(path));objects.delete(path)
  }})
  assert.equal(result.expired,1);assert.equal(await data(f.db,sessionPath),undefined)
  assert.equal(objects.size,0)
  assert.deepEqual(await data(f.db,f.ref.path),eventBefore) // Never reactivate event.
})

test('successful account retry removes owner; concurrent replacement is retained without attempted metadata deletion',async()=>{
  const f=await setup({state:'cleanup_retry',cleanupPending:true,stagingGeneration:'12'})
  await put(f.db,'users/evidence',{accountStatus:'deletion_requested',deletionRequestedAt:new Date(0)})
  await f.run()
  const result=await cleanupUserMedia({uid:'evidence',db:f.db,bucket:{getFiles:async()=>[[{delete:async()=>{}}]]}})
  assert.deepEqual(result,{ok:true,retryable:false,counts:{attempted:2,deleted:2,alreadyMissing:0,failed:0}})
  assert.equal(await data(f.db,sessionPath),undefined)
  const g=await setup({state:'cleanup_retry',cleanupPending:true,stagingGeneration:'12'})
  const replacement={...session,requestId:'replacement',version:8,stagingGeneration:'13',state:'cleanup_retry',cleanupPending:true}
  let persistedReplacement
  const changed=await cleanupUserMedia({uid:'evidence',db:g.db,bucket:{getFiles:async()=>{
    await put(g.db,sessionPath,replacement);persistedReplacement=await data(g.db,sessionPath);return [[]]
  }}})
  assert.deepEqual(changed,{ok:false,retryable:true,counts:{attempted:0,deleted:0,alreadyMissing:0,failed:1}})
  assert.deepEqual(await data(g.db,sessionPath),persistedReplacement)
})

test.after(async()=>{if(app){await realDb.terminate();const {deleteApp}=await import('firebase-admin/app');await deleteApp(app)}})
