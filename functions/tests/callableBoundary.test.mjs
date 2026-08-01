import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('callable boundary harness runs only under demo project isolation', () => {
  if (process.env.HOLALOCAL_CALLABLE_BOUNDARY !== '1') return
  const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT
  assert.match(projectId ?? '', /^demo-/)
  assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '', '')
  assert.equal(process.env.MESSAGE_TRANSLATION_PROVIDER, 'disabled')
  assert.equal(JSON.parse(process.env.FIREBASE_CONFIG ?? '{}').projectId, projectId)
})

test('callable exports remain registered in europe-west1', async () => {
  if (process.env.HOLALOCAL_CALLABLE_BOUNDARY !== '1') return
  const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8')
  for (const callableName of [
    'updateAccountRole', 'ensureOwnerBusiness', 'sendMessage', 'moderateBusiness',
    'getAdminBusinessReview', 'listPublicBusinesses',
  ]) {
    assert.match(source, new RegExp(`export const ${callableName} = onCall`))
  }
  assert.match(source, /region: MESSAGE_TRANSLATION_REGION/)
})
