import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { SERVICE_TAXONOMY_SERVICE_IDS } from '../../../shared/firebase-contract/index.js'

const rulesUrl = new URL('../../../firestore.rules', import.meta.url)

test('Firestore Rules canonical service allowlist exactly matches the shared taxonomy', async () => {
  const rules = await readFile(rulesUrl, 'utf8')
  const functionMatch = rules.match(
    /function canonicalServiceIds\(\) \{\s*return \[([\s\S]*?)\];\s*\}/,
  )
  assert.ok(functionMatch, 'canonicalServiceIds() must remain deliberately parseable')

  const rulesIds = [...functionMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1])
  assert.equal(rulesIds.length, 35)
  assert.equal(new Set(rulesIds).size, 35)
  assert.equal(SERVICE_TAXONOMY_SERVICE_IDS.length, 35)
  assert.deepEqual([...rulesIds].sort(), [...SERVICE_TAXONOMY_SERVICE_IDS].sort())
})
