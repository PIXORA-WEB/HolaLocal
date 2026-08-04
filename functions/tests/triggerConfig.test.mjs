import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const indexUrl = new URL('../src/index.js', import.meta.url)
const packageUrl = new URL('../package.json', import.meta.url)
const harnessUrl = new URL('../scripts/runIsolatedEmulatorTests.mjs', import.meta.url)

test('message translation trigger pins the Firestore region to europe-west1', async () => {
  const source = await readFile(indexUrl, 'utf8')

  assert.match(source, /MESSAGE_TRANSLATION_REGION = 'europe-west1'/)
  assert.match(source, /PUBLIC_CALLABLE_OPTIONS = \{\s*region: MESSAGE_TRANSLATION_REGION,\s*invoker: 'public',\s*\}/s)
  assert.match(source, /region: MESSAGE_TRANSLATION_REGION/)
  assert.match(source, /updateAccountRole = onCall\(\s*PUBLIC_CALLABLE_OPTIONS,/s)
  assert.match(source, /ensureOwnerBusiness = onCall\(\s*PUBLIC_CALLABLE_OPTIONS,/s)
  assert.match(source, /sendMessage = onCall\(\s*PUBLIC_CALLABLE_OPTIONS,/s)
  assert.match(source, /moderateBusiness = onCall\(\s*PUBLIC_CALLABLE_OPTIONS,/s)
  assert.match(source, /listPublicBusinesses = onCall\(\s*PUBLIC_CALLABLE_OPTIONS,/s)
  assert.match(source, /assignBusinessSubscriptionPlan = onCall\(\s*PUBLIC_CALLABLE_OPTIONS,/s)
  assert.match(source, /getPublicBusiness = onCall\(\s*PUBLIC_CALLABLE_OPTIONS,/s)
  assert.match(source, /getOwnerSubscriptionStatus = onCall\(\s*PUBLIC_CALLABLE_OPTIONS,/s)
  assert.match(source, /process\.env\[TRANSLATION_PROVIDER_CONFIG\]/)
  assert.doesNotMatch(source, /FUNCTIONS_REGION/)
  assert.doesNotMatch(source, /process\.env\.[A-Z_]*REGION/)
})

test('only callable functions opt in to public Cloud Run invocation', async () => {
  const source = await readFile(indexUrl, 'utf8')

  assert.equal(source.match(/invoker: 'public'/g)?.length, 1)
  assert.match(source, /translateCreatedMessage = onDocumentCreated\(\s*\{\s*document: 'conversations\/\{conversationId\}\/messages\/\{messageId\}',\s*region: MESSAGE_TRANSLATION_REGION,\s*\}/s)
  assert.doesNotMatch(source, /translateCreatedMessage = onDocumentCreated\(\s*PUBLIC_CALLABLE_OPTIONS/s)

  for (const callableName of ['updateAccountRole', 'ensureOwnerBusiness', 'sendMessage', 'moderateBusiness', 'listPublicBusinesses', 'assignBusinessSubscriptionPlan', 'getPublicBusiness', 'getOwnerSubscriptionStatus']) {
    assert.match(source, new RegExp(`${callableName} = onCall\\(\\s*PUBLIC_CALLABLE_OPTIONS,`, 's'))
  }
})

test('functions package keeps the Node 20 runtime and demo emulator script', async () => {
  const manifest = JSON.parse(await readFile(packageUrl, 'utf8'))
  const harness = await readFile(harnessUrl, 'utf8')

  assert.equal(manifest.engines.node, '20')
  assert.match(manifest.scripts['test:emulator'], /runIsolatedEmulatorTests\.mjs/)
  assert.match(manifest.scripts['test:emulator'], /demo-holalocal-functions/)
  assert.match(manifest.scripts['test:callable-emulator'], /runIsolatedEmulatorTests\.mjs/)
  assert.match(harness, /MESSAGE_TRANSLATION_PROVIDER: 'disabled'/)
  assert.match(harness, /--only',\s*'firestore,functions'/)
})
