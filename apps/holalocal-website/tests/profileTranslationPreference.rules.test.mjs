import { before, after, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { register } from 'node:module'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, Timestamp, serverTimestamp } from 'firebase/firestore'
register('./helpers/preferenceContractLoader.mjs', import.meta.url)
const { buildRegistrationProfile } = await import('../../holalocal-app/src/services/userPayloads.js')
let environment, database, save
const ref=()=>doc(database,'users','owner')
async function seed(extra={}) { await environment.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'users','owner'),{...buildRegistrationProfile('owner',{email:'owner@example.invalid',termsAccepted:true,privacyAccepted:true,termsVersion:'1.0',privacyVersion:'1.0'},serverTimestamp),...extra})) }
const stored=async()=> (await getDoc(ref())).data()
before(async()=>{
 assert.match(process.env.FIRESTORE_EMULATOR_HOST??'',/^(127\.0\.0\.1|localhost):\d+$/)
 environment=await initializeTestEnvironment({projectId:'demo-holalocal-profile-preference',firestore:{rules:await readFile(new URL('../../../firestore.rules',import.meta.url),'utf8')}})
 database=environment.authenticatedContext('owner').firestore();globalThis.__preferenceTestDatabase=database
 save=(await import('../src/services/userService.js')).saveMessageTranslationPreference
})
after(async()=>{await environment?.cleanup();delete globalThis.__preferenceTestDatabase})
beforeEach(async()=>{await environment.clearFirestore();await seed()})
for(const extra of [{},{messageTranslationEnabled:true}])test(`ON -> OFF ${JSON.stringify(extra)} only changes boolean`,async()=>{
 await seed(extra);const old=await stored();assert.deepEqual(await save('owner',false),{enabled:false,changed:true});const next=await stored();assert(next.updatedAt instanceof Timestamp);assert.deepEqual(next,{...old,messageTranslationEnabled:false,updatedAt:next.updatedAt})
})
test('OFF -> ON uses trusted server timestamp, preserves unrelated fields',async()=>{
 await seed({messageTranslationEnabled:false,messageTranslationEnabledSince:Timestamp.fromMillis(1)});const old=await stored()
 assert.deepEqual(await save('owner',true),{enabled:true,changed:true});const next=await stored();assert(next.messageTranslationEnabledSince instanceof Timestamp);assert(next.messageTranslationEnabledSince.toMillis()>1)
 assert(next.messageTranslationEnabledSince.isEqual(next.updatedAt));const {messageTranslationEnabled,messageTranslationEnabledSince,updatedAt,...rest}=next;const {messageTranslationEnabled:a,messageTranslationEnabledSince:b,updatedAt:c,...before}=old;assert.deepEqual(rest,before)
})
for(const [extra,desired] of [[{},true],[{messageTranslationEnabled:true},true],[{messageTranslationEnabled:false},false]])test(`unchanged ${JSON.stringify(extra)} is no-op`,async()=>{await seed(extra);const old=await stored();assert.equal((await save('owner',desired)).changed,false);assert.deepEqual(await stored(),old)})
test('stale UI ON, authoritative OFF: fresh cutoff',async()=>{await seed({messageTranslationEnabled:false});await save('owner',true);assert((await stored()).messageTranslationEnabledSince instanceof Timestamp)})
test('stale UI OFF, authoritative ON: narrow OFF write',async()=>{await seed({messageTranslationEnabled:true});await save('owner',false);assert.equal((await stored()).messageTranslationEnabled,false);assert.equal((await stored()).messageTranslationEnabledSince,undefined)})
for(const invalid of [null,'false',1])test(`invalid boolean ${invalid} repairs ON through rules`,async()=>{await seed({messageTranslationEnabled:invalid});await save('owner',true);const p=await stored();assert.equal(p.messageTranslationEnabled,true);assert(p.messageTranslationEnabledSince instanceof Timestamp)})
test('malformed cutoff safely rejects, does not mutate',async()=>{await seed({messageTranslationEnabled:false,messageTranslationEnabledSince:'bad'});const old=await stored();await assert.rejects(()=>save('owner',true));assert.deepEqual(await stored(),old)})
test('missing profile rejects instead of creating enabled account',async()=>{await environment.clearFirestore();await assert.rejects(()=>save('owner',true));assert.equal((await getDoc(ref())).exists(),false)})
test('non-owner cannot persist preference',async()=>{await assert.rejects(()=>save('another',false))})
test('inactive account rejects',async()=>{await seed({accountStatus:'suspended'});await assert.rejects(()=>save('owner',true))})
