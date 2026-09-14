// Run only in a disposable demo-project Firestore emulator.
import { after, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'

const projectId = 'demo-holalocal-private-create'
assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? '', /^(127\.0\.0\.1|localhost):\d+$/)
let environment
// Exact nested contact shape produced by businessService.sanitizeContact and the
// legacy migration; neither exposes an importable private-document builder.
const contact = {
  phone: '+34000000000', phoneVisible: false, email: 'private@example.invalid', emailVisible: false,
  whatsappNumber: '', whatsappVisible: false, website: '', websiteVisible: false,
  preferredContactMethod: 'holalocal', allowCallbackRequests: false,
}
const rejection = { reasonCode: 'other', guidance: 'Fabricated moderation guidance.', moderationEventId: 'forged', createdAt: serverTimestamp() }
function payload(extra = {}) {
  return { ownerId: 'owner', managerIds: ['owner', 'manager'], contact,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra }
}
function reference(uid, claims = {}) {
  return doc((uid ? environment.authenticatedContext(uid, claims) : environment.unauthenticatedContext()).firestore(), 'businessPrivate', 'business')
}
before(async () => {
  environment = await initializeTestEnvironment({ projectId,
    firestore: { rules: await readFile(new URL('../../../firestore.rules', import.meta.url), 'utf8') } })
})
beforeEach(async () => {
  await environment.clearFirestore()
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore()
    for (const uid of ['owner', 'manager', 'unrelated', 'admin']) {
      await setDoc(doc(db, 'users', uid), { accountStatus: 'active', deletionRequestedAt: null })
    }
    await setDoc(doc(db, 'businesses', 'business'), { ownerId: 'owner', managerIds: ['owner', 'manager'], status: 'draft', contact })
  })
})
after(async () => { await environment?.cleanup() })
for (const uid of ['owner', 'manager']) {
  test(`${uid}: missing private document cannot be created with forged rejection`, async () => {
    assert.equal((await getDoc(reference(uid))).exists(), false)
    await assertFails(setDoc(reference(uid), payload({ currentRejection: rejection })))
  })
  for (const state of ['absent', 'null']) {
    test(`${uid}: canonical contact creation permits ${state} rejection`, async () => {
      await assertSucceeds(setDoc(reference(uid), payload(state === 'null' ? { currentRejection: null } : {})))
      assert.deepEqual((await getDoc(reference(uid))).data().contact, contact)
    })
  }
  test(`${uid}: contact migration merge and updates preserve moderation integrity`, async () => {
    // Website updateBusinessProfile creates missing private data via merge with
    // owner/manager IDs, contact and both timestamps; legacy backfill uses the same shape.
    await assertSucceeds(setDoc(reference(uid), payload(), { merge: true }))
    await assertSucceeds(updateDoc(reference(uid), { contact: { ...contact, phone: '' }, updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(reference(uid), { currentRejection: rejection, updatedAt: serverTimestamp() }))
    assert.equal((await getDoc(reference(uid))).data().contact.phone, '')
  })
}
test('unrelated, unauthenticated and admin-claim clients cannot create or gain private contact access', async () => {
  for (const uid of ['unrelated', null, 'admin']) {
    await assertFails(setDoc(reference(uid, { admin: uid === 'admin' }), payload()))
  }
  await assertSucceeds(setDoc(reference('owner'), payload()))
  for (const uid of ['unrelated', null]) await assertFails(getDoc(reference(uid)))
  // Admin reads are intentionally permitted, but a claim is not Admin SDK bypass.
})
test('creation retains ownership and private-contact validation', async () => {
  for (const extra of [{ ownerId: 'unrelated' }, { managerIds: ['owner'] }, { contact: { email: 'invalid-shape' } }, { currentRejection: 'forged' }]) {
    await assertFails(setDoc(reference('owner'), payload(extra)))
  }
})
test('trusted bypass can write and clear feedback; owner cannot alter or clear it independently', async () => {
  // Rules-disabled context models the Admin SDK boundary, not callable authorization.
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'businessPrivate', 'business'), payload({ currentRejection: rejection }))
  })
  assert.equal((await getDoc(reference('owner'))).data().currentRejection.guidance, rejection.guidance)
  for (const value of [null, { ...rejection, guidance: 'Changed' }]) {
    await assertFails(updateDoc(reference('owner'), { currentRejection: value, updatedAt: serverTimestamp() }))
  }
  await assertSucceeds(updateDoc(reference('manager'), { contact, updatedAt: serverTimestamp() }))
  await environment.withSecurityRulesDisabled(async context => {
    await updateDoc(doc(context.firestore(), 'businessPrivate', 'business'), { currentRejection: null, updatedAt: serverTimestamp() })
  })
  assert.equal((await getDoc(reference('owner'))).data().currentRejection, null)
})
