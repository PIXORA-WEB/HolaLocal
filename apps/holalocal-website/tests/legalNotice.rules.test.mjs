import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore'
import { buildRegistrationProfile } from '../../holalocal-app/src/services/userPayloads.js'
import { createLegalNoticeClient } from '../../../shared/legal-notice/client.js'
import { BUNDLED_LEGAL_PUBLICATION } from '../../../shared/firebase-contract/legalNotice.js'
let env,db,client,website
const registry = db => doc(db,'legalPublications','current')
const ref = () => doc(db,'users','owner')
function profile(extra={}) {return {...buildRegistrationProfile('owner',{email:'a@example.invalid',privacyAccepted:true,termsAccepted:true,privacyVersion:BUNDLED_LEGAL_PUBLICATION.privacyVersion,termsVersion:BUNDLED_LEGAL_PUBLICATION.termsVersion},serverTimestamp),...extra}}
async function seed(extra={}) {await env.withSecurityRulesDisabled(async ctx=>{const p=profile(extra);delete p.privacyNoticeVersion;delete p.termsNoticeVersion;await setDoc(doc(ctx.firestore(),'users','owner'),p)})}
before(async()=>{
 assert.match(process.env.FIRESTORE_EMULATOR_HOST??'',/^(127\.0\.0\.1|localhost):\d+$/)
 env=await initializeTestEnvironment({projectId:'demo-holalocal-notice',firestore:{rules:(await readFile(new URL('../../../firestore.rules',import.meta.url),'utf8'))
   // Synthetic bounded future support only in emulator; runtime publication is 1.2.
   .replaceAll("['1.0', '1.1', '1.2']", "['1.0', '1.1', '1.2', '1.3']")
   .replaceAll("{'1.0': 0, '1.1': 1, '1.2': 2}", "{'1.0': 0, '1.1': 1, '1.2': 2, '1.3': 3}")}})
 db=env.authenticatedContext('owner').firestore();client=createLegalNoticeClient(db)
 globalThis.__legalTestDatabase=db;website=await import('../src/services/userService.js')
})
after(async()=>{await env?.cleanup();delete globalThis.__legalTestDatabase})
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(ctx=>setDoc(registry(ctx.firestore()),BUNDLED_LEGAL_PUBLICATION));await seed()})
for(const shown of [{privacy:'1.2'},{terms:'1.2'},{privacy:'1.2',terms:'1.2'}])test('actual transaction '+JSON.stringify(shown),async()=>{
 const before=(await getDoc(ref())).data();const update=await client.acknowledge('owner',shown)
 assert.deepEqual(Object.keys(update).sort(),Object.keys(shown).map(k=>k+'NoticeVersion').sort())
 const after=(await getDoc(ref())).data()
 for(const key of Object.keys(before)) if(key!=='updatedAt') assert.deepEqual(after[key],before[key],key)
 assert.deepEqual(await client.acknowledge('owner',shown),{})
})
test('mobile new registration baseline passes actual Rules',async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(ctx=>setDoc(registry(ctx.firestore()),BUNDLED_LEGAL_PUBLICATION));await assertSucceeds(setDoc(ref(),profile()))})
test('website actual registration baseline and repair preservation',async()=>{
 await env.clearFirestore();await env.withSecurityRulesDisabled(ctx=>setDoc(registry(ctx.firestore()),BUNDLED_LEGAL_PUBLICATION))
 await website.createUserProfile('owner',{email:'a@example.invalid',privacyAccepted:true,termsAccepted:true,privacyVersion:BUNDLED_LEGAL_PUBLICATION.privacyVersion,termsVersion:BUNDLED_LEGAL_PUBLICATION.termsVersion})
 assert.equal((await getDoc(ref())).data().privacyNoticeVersion,'1.2')
 await seed();await website.ensureUserProfile({uid:'owner',email:'a@example.invalid'})
 assert.equal((await getDoc(ref())).data().privacyNoticeVersion,undefined)
})
for(const value of ['1.0','1.1','99',null,12])test('reject unapproved/stale value '+value,async()=>assertFails(updateDoc(ref(),{privacyNoticeVersion:value,updatedAt:serverTimestamp()})))
test('mixed acceptance and notice write rejected even for missing acceptance',async()=>{
 await seed({privacyAccepted:false,privacyAcceptedAt:null,privacyVersion:null})
 await assertFails(updateDoc(ref(),{privacyNoticeVersion:'1.2',privacyAccepted:true,privacyAcceptedAt:serverTimestamp(),privacyVersion:'1.1',updatedAt:serverTimestamp()}))
})
test('mixed unrelated field/notice write rejected',async()=>assertFails(updateDoc(ref(),{privacyNoticeVersion:'1.2',city:'Madrid',updatedAt:serverTimestamp()})))
test('registry publicly readable but all client writes denied and siblings private',async()=>{
 const anon=env.unauthenticatedContext().firestore()
 await assertSucceeds(getDoc(registry(anon)));await assertFails(setDoc(registry(anon),BUNDLED_LEGAL_PUBLICATION))
 await assertFails(setDoc(registry(db),BUNDLED_LEGAL_PUBLICATION));await assertFails(getDoc(doc(anon,'legalPublications','other')))
})
test('other user and unauthenticated acknowledgement denied',async()=>{
 for(const ctx of [env.authenticatedContext('other'),env.unauthenticatedContext()])await assertFails(updateDoc(doc(ctx.firestore(),'users','owner'),{termsNoticeVersion:'1.2',updatedAt:serverTimestamp()}))
})
test('inactive account denied',async()=>{await seed({accountStatus:'suspended'});await assertFails(updateDoc(ref(),{termsNoticeVersion:'1.2',updatedAt:serverTimestamp()}))})
test('delete notice state denied',async()=>{await client.acknowledge('owner',{privacy:'1.2'});await assertFails(updateDoc(ref(),{privacyNoticeVersion:deleteField(),updatedAt:serverTimestamp()}))})
test('missing/malformed registry and stale displayed state fail without writes',async()=>{
 await assert.rejects(client.acknowledge('owner',{privacy:'1.0'}))
 await env.withSecurityRulesDisabled(ctx=>setDoc(registry(ctx.firestore()),{...BUNDLED_LEGAL_PUBLICATION,privacyVersion:'99'}))
 await assert.rejects(client.acknowledge('owner',{privacy:'99'}));assert.equal((await getDoc(ref())).data().privacyNoticeVersion,undefined)
})
test('normal owner edit works; unknown/privileged fields remain rejected',async()=>{
 await assertSucceeds(updateDoc(ref(),{city:'Madrid',updatedAt:serverTimestamp()}))
 for(const patch of [{unknown:true},{roles:['admin']}]) await assertFails(updateDoc(ref(),{...patch,updatedAt:serverTimestamp()}))
})

async function futureState(kind,stored,published) {
 await env.withSecurityRulesDisabled(async ctx=>{
  await updateDoc(doc(ctx.firestore(),'users','owner'),{[kind+'NoticeVersion']:stored})
  await setDoc(registry(ctx.firestore()),{...BUNDLED_LEGAL_PUBLICATION,[kind+'Version']:published})
 })
}
for(const kind of ['privacy','terms']) {
 test('Rules reject '+kind+' downgrade despite current rolled-back registry',async()=>{
  await futureState(kind,'1.3','1.2')
  await assertFails(updateDoc(ref(),{[kind+'NoticeVersion']:'1.2',updatedAt:serverTimestamp()}))
  assert.equal((await getDoc(ref())).data()[kind+'NoticeVersion'],'1.3')
 })
 test('Rules allow '+kind+' advance and same-version profile update',async()=>{
  await futureState(kind,'1.2','1.3')
  await assertSucceeds(updateDoc(ref(),{[kind+'NoticeVersion']:'1.3',updatedAt:serverTimestamp()}))
  await assertSucceeds(updateDoc(ref(),{[kind+'NoticeVersion']:'1.3',updatedAt:serverTimestamp()}))
 })
}
test('Rules preserve newer Privacy while Terms advances independently',async()=>{
 await futureState('privacy','1.3','1.2')
 await env.withSecurityRulesDisabled(ctx=>updateDoc(registry(ctx.firestore()),{termsVersion:'1.2'}))
 await assertSucceeds(updateDoc(ref(),{termsNoticeVersion:'1.2',updatedAt:serverTimestamp()}))
 const result=(await getDoc(ref())).data();assert.equal(result.privacyNoticeVersion,'1.3');assert.equal(result.termsNoticeVersion,'1.2')
})
