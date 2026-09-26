import { before, after, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { register } from 'node:module'
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, setDoc, updateDoc, getDoc, deleteField, serverTimestamp, Timestamp } from 'firebase/firestore'
register('./helpers/preferenceContractLoader.mjs', import.meta.url)
const { buildRegistrationProfile, buildProfileUpdates } = await import('../../holalocal-app/src/services/userPayloads.js')

const projectId = 'demo-holalocal-preference-contract'
const preference = 'messageTranslationEnabled'
const cutoff = 'messageTranslationEnabledSince'
const oldTime = Timestamp.fromMillis(1000)
let environment, database, service
function profile(uid, extra = {}) {
  return { ...buildRegistrationProfile(uid, {
    email: `${uid}@example.invalid`, termsAccepted: true, privacyAccepted: true,
    termsVersion: '1.0', privacyVersion: '1.0',
  }, serverTimestamp), ...extra }
}
async function seed(extra = {}, uid = 'owner') {
  await environment.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'users', uid), profile(uid, extra)))
}
const ownRef = () => doc(database, 'users', 'owner')
const save = fields => updateDoc(ownRef(), { ...fields, updatedAt: serverTimestamp() })
const stored = async () => (await getDoc(ownRef())).data()
before(async () => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? '', /^(127\.0\.0\.1|localhost):\d+$/, 'local emulator required')
  environment = await initializeTestEnvironment({ projectId, firestore: {
    rules: await readFile(new URL('../../../firestore.rules', import.meta.url), 'utf8'),
  } })
  database = environment.authenticatedContext('owner').firestore()
  globalThis.__preferenceTestDatabase = database
  service = await import('../src/services/userService.js')
})
after(async () => { await environment?.cleanup(); delete globalThis.__preferenceTestDatabase })
beforeEach(async () => { await environment.clearFirestore(); await seed() })

for (const [name, extra] of [['absent', {}], ['true', { [preference]: true }]]) {
  test(`owner ${name} -> OFF accepted`, async () => {
    await seed(extra); await assertSucceeds(save({ [preference]: false }))
    assert.equal((await stored())[preference], false)
  })
}
test('another account cannot read or change the preference', async () => {
  const ref = doc(environment.authenticatedContext('other').firestore(), 'users', 'owner')
  await assertFails(getDoc(ref))
  await assertFails(updateDoc(ref, { [preference]: false, updatedAt: serverTimestamp() }))
})
for (const state of ['suspended', 'deleted', 'deletion_pending']) test(`inactive ${state} cannot change preference`, async () => {
  await seed({ accountStatus: state }); await assertFails(save({ [preference]: false }))
})
for (const value of [null, 'false', 0]) test(`nonboolean ${String(value)} rejected`, async () => {
  await assertFails(save({ [preference]: value }))
})
test('unknown field still rejected', async () => { await assertFails(save({ messageTranslationSurprise: true })) })
for (const [label, next] of [['true', true], ['deleted field', deleteField()]]) {
  test(`OFF -> ${label} requires and accepts serverTimestamp cutoff`, async () => {
    await seed({ [preference]: false, [cutoff]: oldTime })
    await assertFails(save({ [preference]: next }))
    await assertFails(save({ [preference]: next, [cutoff]: Timestamp.fromMillis(2000) }))
    await assertSucceeds(save({ [preference]: next, [cutoff]: serverTimestamp() }))
    const result = await stored()
    assert.equal(result[cutoff].isEqual(result.updatedAt), true, 'both transforms equal request.time')
    assert.ok(result[cutoff].toMillis() > oldTime.toMillis())
    assert.equal(result[preference], label === 'true' ? true : undefined)
  })
}
test('first OFF -> ON cutoff accepted when cutoff was absent', async () => {
  await seed({ [preference]: false })
  await assertSucceeds(save({ [preference]: true, [cutoff]: serverTimestamp() }))
})
for (const [label, old, next] of [['OFF -> OFF', false, false], ['ON -> OFF', true, false], ['ON -> ON', true, true]]) {
  test(`${label} preserves cutoff and rejects rewrite/deletion`, async () => {
    await seed({ [preference]: old, [cutoff]: oldTime })
    await assertFails(save({ [preference]: next, [cutoff]: serverTimestamp() }))
    await assertFails(save({ [preference]: next, [cutoff]: Timestamp.fromMillis(2000) }))
    await assertFails(save({ [preference]: next, [cutoff]: deleteField() }))
    await assertSucceeds(save({ [preference]: next }))
    assert.equal((await stored())[cutoff].isEqual(oldTime), true)
  })
}
for (const next of [false, true]) test(`legacy ON -> ${next}: cannot add cutoff`, async () => {
  await assertFails(save({ [preference]: next, [cutoff]: serverTimestamp() }))
  await assertSucceeds(save({ [preference]: next }))
})
test('ON -> absence keeps existing cutoff', async () => {
  await seed({ [preference]: true, [cutoff]: oldTime })
  await assertSucceeds(save({ [preference]: deleteField() }))
  assert.equal((await stored())[cutoff].isEqual(oldTime), true)
})
for (const [label, extra] of [['absent', {}], ['true', { [preference]: true }], ['false', { [preference]: false }]]) {
  test(`creation ${label} accepted without cutoff`, async () => {
    const uid = 'new-account'
    const ref = doc(environment.authenticatedContext(uid).firestore(), 'users', uid)
    await assertSucceeds(setDoc(ref, profile(uid, extra)))
  })
}
for (const value of [oldTime, serverTimestamp(), null]) test(`creation cutoff ${String(value)} rejected`, async () => {
  const uid = 'new-account'
  await assertFails(setDoc(doc(environment.authenticatedContext(uid).firestore(), 'users', uid), profile(uid, { [cutoff]: value })))
})
test('creation rejects nonboolean and unknown fields', async () => {
  const uid = 'new-account', ref = doc(environment.authenticatedContext(uid).firestore(), 'users', uid)
  await assertFails(setDoc(ref, profile(uid, { [preference]: 'false' })))
  await assertFails(setDoc(ref, profile(uid, { unknownField: true })))
})
test('unrelated owner profile updates work; forbidden role/account mutation remains denied', async () => {
  await assertSucceeds(save({ city: 'Madrid' }))
  for (const fields of [{ roles: ['admin'] }, { accountStatus: 'suspended' }, { email: 'other@example.invalid' }]) {
    await assertFails(save(fields))
  }
})
test('real website profile, language and completion writers preserve explicit false/cutoff', async () => {
  await seed({ [preference]: false, [cutoff]: oldTime })
  for (const fields of [{ city: 'Madrid' }, { preferredLocale: 'es' }, {
    firstName: 'Test', lastName: 'Person', displayName: 'Test Person', city: 'Madrid',
    preferredLocale: 'es', country: 'Spain', profileCompleted: true,
  }]) {
    await service.updateUserProfile('owner', fields)
    const result = await stored()
    assert.equal(result[preference], false); assert.equal(result[cutoff].isEqual(oldTime), true)
  }
})
test('real website missing-field repair neither injects true nor destroys explicit false', async () => {
  await seed({ [preference]: false, [cutoff]: oldTime })
  await environment.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), 'users', 'owner'), { firstName: deleteField() }))
  await service.ensureUserProfile({ uid: 'owner', email: 'owner@example.invalid', displayName: 'Owner' })
  assert.equal((await stored())[preference], false)
  assert.equal((await stored())[cutoff].isEqual(oldTime), true)
  await seed()
  await service.ensureUserProfile({ uid: 'owner', email: 'owner@example.invalid' })
  assert.equal(Object.hasOwn(await stored(), preference), false)
})
test('registration create-if-absent never replaces an existing false', async () => {
  await seed({ [preference]: false, [cutoff]: oldTime })
  await service.createUserProfile('owner', {})
  assert.equal((await stored())[preference], false)
})
test('old mobile edit/language/onboarding payloads and complete synthetic fixture preserve false', async () => {
  await seed({ [preference]: false, [cutoff]: oldTime })
  for (const fields of [{ city: 'Madrid' }, { preferredLocale: 'de' }, {
    firstName: 'Test', lastName: 'Person', displayName: 'Test Person', preferredLocale: 'de',
    city: 'Madrid', country: 'Spain', profileCompleted: true,
  }]) {
    await save(buildProfileUpdates(fields))
    assert.equal((await stored())[preference], false)
    assert.equal((await stored())[cutoff].isEqual(oldTime), true)
  }
})
