import { before, after, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION, BUNDLED_LEGAL_PUBLICATION } from '@holalocal/firebase-contract'
import { buildRegistrationProfile } from '../../holalocal-app/src/services/userPayloads.js'
import { protectedAccountDecision } from '../src/routes/accountRoutePolicy.js'

let environment, db, service
const versions = { termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION }
function profile(uid = 'owner', extra = {}) {
  const result = { ...buildRegistrationProfile(uid, {
    email: `${uid}@example.invalid`, termsAccepted: true, privacyAccepted: true, ...versions,
  }, serverTimestamp), ...extra }
  // Historical registration fixtures do not claim current-document notice exposure.
  for (const kind of ['privacy', 'terms']) if (result[kind + 'Version'] !== versions[kind + 'Version']) delete result[kind + 'NoticeVersion']
  return result
}
const ref = () => doc(db, 'users', 'owner')
const stored = async () => (await getDoc(ref())).data()
async function seed(extra = {}) {
  await environment.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'users', 'owner'), profile('owner', extra)))
}
before(async () => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? '', /^(127\.0\.0\.1|localhost):\d+$/, 'local emulator required')
  environment = await initializeTestEnvironment({ projectId: 'demo-holalocal-legal-foundation', firestore: {
    rules: await readFile(new URL('../../../firestore.rules', import.meta.url), 'utf8'),
  } })
  db = environment.authenticatedContext('owner').firestore()
  globalThis.__legalTestDatabase = db
  service = await import('../src/services/userService.js')
})
after(async () => { await environment?.cleanup(); delete globalThis.__legalTestDatabase })
beforeEach(async () => {
  await environment.clearFirestore()
  await environment.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'legalPublications', 'current'), BUNDLED_LEGAL_PUBLICATION))
})

test('actual website registration writer persists canonical current versions under Rules', async () => {
  await assertSucceeds(service.createUserProfile('owner', {
    email: 'owner@example.invalid', termsAccepted: true, privacyAccepted: true, ...versions,
  }))
  const p = await stored()
  assert.equal(p.termsVersion, CURRENT_TERMS_VERSION); assert.equal(p.privacyVersion, CURRENT_PRIVACY_VERSION)
  assert.ok(p.termsAcceptedAt instanceof Timestamp); assert.ok(p.privacyAcceptedAt instanceof Timestamp)
})
test('actual mobile registration payload persists the same canonical versions under Rules', async () => {
  await assertSucceeds(setDoc(ref(), profile()))
  const p = await stored()
  assert.equal(p.termsVersion, CURRENT_TERMS_VERSION); assert.equal(p.privacyVersion, CURRENT_PRIVACY_VERSION)
})
for (const termsVersion of ['1.0', '1.1', '1.2']) for (const privacyVersion of ['1.0', '1.1', '1.2']) {
  test(`Rules retain supported independent registration pair ${termsVersion}/${privacyVersion}`, async () => {
    await assertSucceeds(setDoc(ref(), profile('owner', { termsVersion, privacyVersion })))
  })
}
for (const field of ['termsVersion', 'privacyVersion']) for (const value of ['1.3', '99', '0.9', '', 1.1, null]) {
  test(`Rules reject create ${field}=${JSON.stringify(value)}`, async () => {
    await assertFails(setDoc(ref(), profile('owner', { [field]: value })))
  })
}
for (const field of ['terms', 'privacy']) {
  test(`Rules allow only supported missing-${field} recovery and trusted timestamps`, async () => {
    await seed({ [field + 'Accepted']: false, [field + 'AcceptedAt']: null, [field + 'Version']: null })
    const patch = { [field + 'Accepted']: true, [field + 'AcceptedAt']: serverTimestamp(),
      [field + 'Version']: versions[field + 'Version'], updatedAt: serverTimestamp() }
    await assertFails(updateDoc(ref(), { ...patch, [field + 'Version']: '99' }))
    await assertFails(updateDoc(ref(), { ...patch, [field + 'AcceptedAt']: Timestamp.fromMillis(1000) }))
    await assertSucceeds(updateDoc(ref(), patch))
  })
  test(`Rules still forbid rewriting accepted ${field} evidence`, async () => {
    await seed()
    await assertFails(updateDoc(ref(), { [field + 'Version']: '1.0', updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(ref(), { [field + 'AcceptedAt']: Timestamp.fromMillis(1000), updatedAt: serverTimestamp() }))
  })
}
test('owner normal profile updates and login repairs preserve both evidence timestamps', async () => {
  await seed()
  const before = await stored()
  await assertSucceeds(service.updateUserProfile('owner', { city: 'Madrid' }))
  await assertSucceeds(service.ensureUserProfile({ uid: 'owner', email: 'owner@example.invalid' }))
  await assertSucceeds(service.updateLastActive('owner'))
  const after = await stored()
  assert.equal(after.city, 'Madrid')
  for (const kind of ['terms', 'privacy']) {
    assert.equal(after[kind + 'Version'], before[kind + 'Version'])
    assert.ok(after[kind + 'AcceptedAt'].isEqual(before[kind + 'AcceptedAt']))
  }
  assert.equal(protectedAccountDecision({ user: { uid: 'owner' }, emailVerified: true,
    profileStatus: 'loaded', userProfile: { ...after, profileCompleted: true, onboardingCompleted: true } }), 'allow')
})
test('valid historical evidence still permits today access without asserting current agreement', async () => {
  await seed({ termsVersion: '1.0', privacyVersion: '1.0', profileCompleted: true, onboardingCompleted: true })
  assert.equal(protectedAccountDecision({ user: { uid: 'owner' }, emailVerified: true,
    profileStatus: 'loaded', userProfile: await stored() }), 'allow')
})
test('missing evidence still routes to recovery', async () => {
  await seed({ privacyAccepted: false, privacyAcceptedAt: null, privacyVersion: null })
  assert.equal(protectedAccountDecision({ user: { uid: 'owner' }, emailVerified: true,
    profileStatus: 'loaded', userProfile: await stored() }), 'legal_consent')
})
test('other users and unauthenticated clients cannot write owner legal fields', async () => {
  await seed()
  for (const context of [environment.authenticatedContext('other'), environment.unauthenticatedContext()]) {
    await assertFails(updateDoc(doc(context.firestore(), 'users', 'owner'), { city: 'Other', updatedAt: serverTimestamp() }))
  }
})
test('inactive accounts, unknown fields and privileged edits remain forbidden', async () => {
  await seed()
  for (const patch of [{ surprise: true }, { roles: ['admin'] }, { accountStatus: 'deleted' }]) {
    await assertFails(updateDoc(ref(), { ...patch, updatedAt: serverTimestamp() }))
  }
  await seed({ accountStatus: 'suspended' })
  await assertFails(updateDoc(ref(), { city: 'Madrid', updatedAt: serverTimestamp() }))
})
