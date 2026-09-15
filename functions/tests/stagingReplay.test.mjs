import assert from 'node:assert/strict'
import test from 'node:test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { FakeFirestore } from './fakeFirestore.mjs'
import { openCutoverControl } from './mediaCutoverFixture.mjs'
import { replayStagingEvents, retainStagingEvent, STAGING_REPLAY_PROGRESS, DEFERRED_STAGING_EVENTS } from '../src/stagingMediaDeferral.js'
import { cleanFinalizedStagingObject, sweepExpiredMediaSessions } from '../src/stagingMediaMaintenance.js'

const emulator = process.env.HOLALOCAL_REPLAY_EMULATOR === '1'
let app, realDb
if (emulator) {
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-holalocal-functions')
  assert.match(process.env.FIRESTORE_EMULATOR_HOST, /^127\.0\.0\.1:/)
  const { initializeApp } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')
  app = initializeApp(); realDb = getFirestore(app)
}
async function database() {
  if (!emulator) return new FakeFirestore()
  for (const name of [DEFERRED_STAGING_EVENTS, 'maintenanceProgress', 'mediaUploadSessions', 'mediaCutoverHolds', 'mediaCutoverControls']) {
    await realDb.recursiveDelete(realDb.collection(name))
  }
  return realDb
}
const put = (db, path, data) => db.runTransaction(async tx => { tx.set(db.doc(path), data) })
const data = async (db, path) => (await db.doc(path).get()).data()
const id = n => n.toString(16).padStart(64, '0')
async function seed(db, n) {
  for (let i=1;i<=n;i++) await put(db, `${DEFERRED_STAGING_EVENTS}/${id(i)}`, { state:'pending', object:{ generation:String(i) } })
}
const progress = db => data(db, STAGING_REPLAY_PROGRESS)

test('actual sweep passes 50 held or failing rows; wrap revisits released work', async () => {
  for (const held of [true, false]) {
    const db = await database()
    await put(db, 'mediaCutoverControls/current', openCutoverControl())
    const events=[]
    for(let i=0;i<51;i++) {
      const uid=`replay${i}`, object={ name:`users/${uid}/staging/profile/avatar`,generation:'12',metadata:{holalocalUploadSession:'request-12345678'} }
      const { ref } = await retainStagingEvent({db,object,marker:'request-12345678',now:new Date()})
      events.push({uid,object,path:ref.path})
    }
    events.sort((a,b)=>a.path.localeCompare(b.path))
    if(held) for(const e of events.slice(0,50)) await put(db,`mediaCutoverHolds/${e.uid}`,{state:'held'})
    const ready = e => put(db,`mediaUploadSessions/profile_${e.uid}`,{ kind:'profile',principalUid:e.uid,state:'uploaded',requestId:'request-12345678',stagingPath:e.object.name,stagingGeneration:'12',expiresAt:new Date('2099-01-01') })
    const target=events[50]; await ready(target)
    let accesses=0
    const bucket={file(){ accesses++; throw Error('persistent synthetic Storage failure') }}
    await sweepExpiredMediaSessions({db,bucket})
    assert.equal((await data(db,target.path)).state,'pending')
    await sweepExpiredMediaSessions({db,bucket})
    assert.equal((await data(db,target.path)).state,'completed')
    assert.equal((await progress(db)).cursor,null)
    const first=events[0]; await db.doc(`mediaCutoverHolds/${first.uid}`).delete(); await ready(first)
    await sweepExpiredMediaSessions({db,bucket})
    assert.equal((await data(db,first.path)).state,'completed')
    assert.equal((await cleanFinalizedStagingObject({db,bucket,object:target.object})).status,'already-clean')
    if(held) assert.equal(accesses,0)
    else assert.ok(accesses>=50)
  }
})

test('bounded mixed pages, persisted restart, missing cursor and insertions wrap safely', async () => {
  let db=await database(); await seed(db,120)
  const seen=[]
  const process=async object=>{seen.push(object.generation); if(Number(object.generation)%2) throw Error('poison'); await db.doc(`${DEFERRED_STAGING_EVENTS}/${id(Number(object.generation))}`).delete()}
  assert.equal((await replayStagingEvents({db,process})).attempted,50)
  assert.equal((await progress(db)).cursor,id(50)) // deleted cursor remains usable
  await put(db,`${DEFERRED_STAGING_EVENTS}/${id(0)}`,{state:'pending',object:{generation:'0'}})
  await put(db,`${DEFERRED_STAGING_EVENTS}/${id(121)}`,{state:'pending',object:{generation:'121'}})
  if (emulator) {
    // A separate Node process must resume using only the persisted cursor.
    const script = `
      import { initializeApp, deleteApp } from ${JSON.stringify(import.meta.resolve('firebase-admin/app'))};
      import { getFirestore } from ${JSON.stringify(import.meta.resolve('firebase-admin/firestore'))};
      import { replayStagingEvents } from ${JSON.stringify(new URL('../src/stagingMediaDeferral.js', import.meta.url).href)};
      const app=initializeApp(), db=getFirestore(app);
      console.log(JSON.stringify(await replayStagingEvents({db,process:async()=>{}})));
      await db.terminate(); await deleteApp(app);
    `
    const { stdout } = await promisify(execFile)(globalThis.process.execPath, ['--input-type=module','-e',script])
    assert.equal(JSON.parse(stdout.trim()).attempted,50)
  } else {
    db = new FakeFirestore(Object.fromEntries(db.store))
    assert.equal((await replayStagingEvents({db,process})).attempted,50)
  }
  assert.equal((await replayStagingEvents({db,process})).attempted,21)
  assert.equal((await progress(db)).cursor,null)
  await replayStagingEvents({db,process})
  assert.ok(seen.includes('0')); assert.ok(seen.includes('121'))
})

test('concurrent sweeps cannot let a stale checkpoint rewind newer progress', async () => {
  const db=await database(); await seed(db,120)
  let entered,release
  const started=new Promise(r=>{entered=r}), barrier=new Promise(r=>{release=r})
  let first=true
  const stale=replayStagingEvents({db,process:async()=>{if(first){first=false;entered();await barrier}}})
  await started
  await replayStagingEvents({db,process:async()=>{}})
  await replayStagingEvents({db,process:async()=>{}})
  assert.equal((await progress(db)).cursor,id(100))
  release(); assert.equal((await stale).advanced,false)
  assert.equal((await progress(db)).cursor,id(100))
  await put(db,`${DEFERRED_STAGING_EVENTS}/${id(100)}`,{state:'completed',object:{generation:'100'}})
  assert.equal((await replayStagingEvents({db,process:async()=>{}})).attempted,20)
})

test('page-query and checkpoint failures do not skip work', async () => {
  const db=await database(); await seed(db,51)
  const queryFailure={doc:p=>db.doc(p),collection(){throw Error('query unavailable')}}
  await assert.rejects(replayStagingEvents({db:queryFailure,process:async()=>assert.fail()}),/query unavailable/)
  assert.equal(await progress(db),undefined)
  let attempts=0
  const checkpointFailure={doc:p=>db.doc(p),collection:p=>db.collection(p),runTransaction:async()=>{throw Error('checkpoint unavailable')}}
  await assert.rejects(replayStagingEvents({db:checkpointFailure,process:async()=>{attempts++}}),/checkpoint unavailable/)
  assert.equal(attempts,50); assert.equal(await progress(db),undefined)
  const retried=[]; await replayStagingEvents({db,process:async o=>retried.push(o.generation)})
  assert.equal(retried.length,50); assert.equal(retried[0],'1')
})

test.after(async()=>{if(app){await realDb.terminate();const {deleteApp}=await import('firebase-admin/app');await deleteApp(app)}})
