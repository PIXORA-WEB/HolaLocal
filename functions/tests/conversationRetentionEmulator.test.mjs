import {before,after,test} from 'node:test'
import assert from 'node:assert/strict'
import {initializeApp,deleteApp} from 'firebase-admin/app'
import {getFirestore,Timestamp} from 'firebase-admin/firestore'
import {getAuth} from 'firebase-admin/auth'
import {assessConversationRetention,removeUnneededConversationBatch,redactAssessedConversationMessage} from '../src/accountDeletionPrimitives.js'
const enabled=process.env.HOLALOCAL_RETENTION_EMULATOR==='1';let app,db,auth
before(()=>{if(!enabled)return;assert.equal(process.env.GCLOUD_PROJECT,'demo-holalocal-retention');assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:18080');app=initializeApp({projectId:process.env.GCLOUD_PROJECT},'conversation-retention');db=getFirestore(app);assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:19099');auth=getAuth(app)})
after(async()=>{if(app)await deleteApp(app)})
const now=Timestamp.fromMillis(1800000000000)
// Real Auth and Firestore emulators; only the explicit network-failure case injects a failure.
const opts=id=>({conversationId:id,actorUid:'admin',claims:{admin:true},db,auth,enabled:true})
async function seed(id,count=3){
 const ref=db.doc(`conversations/${id}`),ids=[id+'-a',id+'-b']
 await ref.set({participantIds:ids,customerId:ids[0],status:'participant_deleted',lastMessage:{preview:'synthetic',senderId:ids[0]},participantTombstones:{}})
 for(const uid of ids)await db.doc(`accountDeletionRequests/${uid}`).set({uid,state:'completed',lastCompletedStep:'completed'})
 for(let i=0;i<count;i++)await ref.collection('messages').doc('m'+i).set({senderId:ids[0],text:'synthetic',attachment:null,translation:{text:'synthetic copy'}})
 await assessConversationRetention({...opts(id),expectedRevision:0,action:'hold',reason:'verify history need',endingCondition:'no participant needs history',reviewAt:Timestamp.fromMillis(now.toMillis()+1),now})
 return {ref,ids}
}
test('private holds, no recent-login inference, both-account checks and bounded retry without orphan text',{skip:!enabled},async()=>{
 const id='conversation-boundary',{ref,ids}=await seed(id)
 assert.equal((await ref.get()).data().retentionDecision,undefined)
 assert.equal((await removeUnneededConversationBatch({...opts(id),enabled:false})).disabled,true)
 await auth.createUser({uid:ids[0],disabled:true})
 assert.equal((await removeUnneededConversationBatch(opts(id))).accountRetained,true)
 await auth.deleteUser(ids[0])
 assert.equal((await removeUnneededConversationBatch(opts(id))).held,true)
 await assessConversationRetention({...opts(id),expectedRevision:1,action:'release',reason:'no remaining need after assessment',now})
 await db.doc(`users/${ids[0]}`).set({accountStatus:'suspended'})
 assert.equal((await removeUnneededConversationBatch(opts(id))).needsAssessment,true)
 await db.doc(`users/${ids[0]}`).delete()
 const first=await removeUnneededConversationBatch({...opts(id),pageSize:2});assert.deepEqual(first,{removed:2,complete:false})
 assert.equal((await ref.get()).data().lastMessage,null)
 const second=await removeUnneededConversationBatch({...opts(id),pageSize:2});assert.deepEqual(second,{removed:1,complete:true})
 assert.equal((await ref.get()).exists,false);assert.equal((await ref.collection('messages').get()).size,0);assert.equal((await db.doc(`conversationRetention/${id}`).get()).exists,false)
 assert.equal((await removeUnneededConversationBatch(opts(id))).complete,true)
})
test('unauthorised access, unknown account state and storage attachments fail closed',{skip:!enabled},async()=>{
 const id='conversation-blocked',{ref,ids}=await seed(id)
 await assert.rejects(assessConversationRetention({...opts(id),claims:{moderator:true},expectedRevision:1,action:'release',reason:'not authorised',now}),/admin-required/)
 await assessConversationRetention({...opts(id),expectedRevision:1,action:'release',reason:'verified need ended',now})
 await assert.rejects(removeUnneededConversationBatch({...opts(id),auth:{getUser:async()=>{throw new Error('network failure')}}}),/network failure/)
 await db.doc(`accountDeletionRequests/${ids[0]}`).delete()
 assert.equal((await removeUnneededConversationBatch(opts(id))).needsAssessment,true)
 await db.doc(`accountDeletionRequests/${ids[0]}`).set({state:'completed',lastCompletedStep:'completed'})
 await ref.collection('messages').doc('m0').update({attachment:{storagePath:'unverified-legacy'}})
 assert.equal((await removeUnneededConversationBatch(opts(id))).needsAssessment,true)
 assert.equal((await ref.collection('messages').get()).size,3)
})

test('explicit authorised erasure removes message and preview copies without erasing other history',{skip:!enabled},async()=>{
 const id='conversation-redact',{ref,ids}=await seed(id)
 await ref.update({lastMessage:{messageId:'m0',preview:'synthetic private text'}})
 const options={...opts(id),messageId:'m0',subjectUid:ids[0],reason:'assessed personal text in authorised erasure',now}
 assert.equal((await redactAssessedConversationMessage({...options,enabled:false})).disabled,true)
 assert.equal((await redactAssessedConversationMessage(options)).held,true)
 await assessConversationRetention({...opts(id),expectedRevision:1,action:'release',reason:'preservation no longer needed',now})
 await assert.rejects(redactAssessedConversationMessage({...options,claims:{}}),/admin-required/)
 await assert.rejects(redactAssessedConversationMessage({...options,subjectUid:'unrelated'}),/authorised-participant/)
 assert.equal((await redactAssessedConversationMessage(options)).redacted,true)
 const row=(await ref.collection('messages').doc('m0').get()).data()
 assert.equal(row.text,'');assert.equal(row.translation,undefined);assert.equal(row.moderationStatus,'removed')
 assert.equal((await ref.get()).data().lastMessage,null)
 assert.equal((await ref.collection('messages').doc('m1').get()).data().text,'synthetic')
 assert.equal((await redactAssessedConversationMessage(options)).idempotent,true)
 assert.equal((await ref.get()).data().lastErasureAssessment,undefined)
})

test('private exception records are denied to signed-out and participant browser requests by real rules',{skip:!enabled},async()=>{
 const id='conversation-private-rules',{ids}=await seed(id)
 const response=await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=synthetic-emulator-key',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'participant@example.test',password:'Synthetic-Only-123!',returnSecureToken:true})})
 assert.equal(response.status,200)
 const session=await response.json();assert.equal(typeof session.idToken,'string')
 await db.doc(`conversations/${id}`).update({participantIds:[session.localId,ids[1]],customerId:session.localId})
 await db.doc(`users/${session.localId}`).set({accountStatus:'active'})
 const endpoint=`http://127.0.0.1:18080/v1/projects/demo-holalocal-retention/databases/(default)/documents/conversationRetention/${id}`
 for(const headers of [{},{Authorization:'Bearer '+session.idToken}]){
  const read=await fetch(endpoint,{headers});assert.equal(read.status,403)
 }
})
