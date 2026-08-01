import test from 'node:test'
import assert from 'node:assert/strict'
import { bootstrapFirstAdmin } from '../scripts/bootstrapFirstAdmin.mjs'

function fakeAuth(user) {
  let writes = 0
  return {
    get writes() { return writes },
    async getUserByEmail() { return structuredClone(user) },
    async setCustomUserClaims(uid, claims) {
      writes += 1
      user.customClaims = claims
      assert.equal(uid, user.uid)
    },
    async getUser() { return structuredClone(user) },
  }
}

test('bootstrap defaults to dry-run and preserves existing claims when applied', async () => {
  const user = {
    uid: 'admin-uid',
    email: 'hello@holalocal.es',
    emailVerified: true,
    customClaims: { billing: true },
  }
  const auth = fakeAuth(user)
  assert.equal((await bootstrapFirstAdmin({ projectId: 'demo-project', auth })).dryRun, true)
  assert.equal(auth.writes, 0)
  const applied = await bootstrapFirstAdmin({
    apply: true, expectedUid: 'admin-uid', projectId: 'demo-project', auth,
  })
  assert.equal(applied.claims.billing, true)
  assert.equal(applied.claims.admin, true)
  assert.equal(auth.writes, 1)
})

test('bootstrap rejects unverified accounts and mismatched expected UIDs', async () => {
  await assert.rejects(() => bootstrapFirstAdmin({
    projectId: 'demo-project',
    auth: fakeAuth({ uid: 'uid', email: 'hello@holalocal.es', emailVerified: false }),
  }), /not verified/)
  await assert.rejects(() => bootstrapFirstAdmin({
    apply: true, expectedUid: 'wrong', projectId: 'demo-project',
    auth: fakeAuth({ uid: 'uid', email: 'hello@holalocal.es', emailVerified: true }),
  }), /exactly match/)
})
