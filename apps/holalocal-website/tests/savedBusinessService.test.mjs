import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../src/services/savedBusinessService.js', import.meta.url), 'utf8')

test('saved-business service uses the shared deterministic contract', () => {
  assert.match(source, /SAVED_BUSINESSES_SUBCOLLECTION/)
  assert.match(source, /SAVED_BUSINESS_FIELDS/)
  assert.match(source, /validateSavedBusinessRecord/)
  assert.match(source, /'users',[\s\S]*SAVED_BUSINESSES_SUBCOLLECTION/)
  assert.match(source, /requireDocumentId\(uid/)
  assert.match(source, /requireDocumentId\(businessId/)
})

test('state lookup reads only the saved record', () => {
  assert.match(source, /export async function getSavedBusinessState/)
  assert.match(source, /operations\.getDoc\(reference\)/)
  assert.doesNotMatch(source, /getDoc\([^)]*businesses/)
})

test('save is create-only and idempotent with a server timestamp', () => {
  assert.match(source, /operations\.runTransaction/)
  assert.match(source, /if \(snapshot\.exists\(\)\) return Object\.freeze\(\{ saved: true, created: false \}\)/)
  assert.match(source, /operations\.serverTimestamp\(\)/)
  assert.match(source, /transaction\.set\(reference, values\)/)
  assert.doesNotMatch(source, /merge\s*:\s*true|transaction\.update|updateDoc/)
})

test('remove deletes only the deterministic record and failures are normalized', () => {
  assert.match(source, /operations\.deleteDoc\(reference\)/)
  assert.match(source, /normalizedFailure\(error, 'remove'\)/)
  assert.doesNotMatch(source, /collectionGroup|where\(/)
})
