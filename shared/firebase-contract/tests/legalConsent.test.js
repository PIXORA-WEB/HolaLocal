import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  hasCurrentLegalConsent,
  hasValidLegalConsent,
} from '../index.js'

const timestamp = {
  seconds: 1_700_000_000,
  nanoseconds: 123_000_000,
  toMillis: () => 1_700_000_000_123,
}

function currentConsent(overrides = {}) {
  return {
    termsAccepted: true,
    termsAcceptedAt: timestamp,
    termsVersion: CURRENT_TERMS_VERSION,
    privacyAccepted: true,
    privacyAcceptedAt: timestamp,
    privacyVersion: CURRENT_PRIVACY_VERSION,
    ...overrides,
  }
}

test('current policy versions are independently addressable', () => {
  assert.equal(CURRENT_TERMS_VERSION, '1.2')
  assert.equal(CURRENT_PRIVACY_VERSION, '1.2')
})

test('hasCurrentLegalConsent accepts only exact current consent', () => {
  assert.equal(hasCurrentLegalConsent(currentConsent()), true)
})

test('hasCurrentLegalConsent rejects missing false and malformed flags', () => {
  for (const overrides of [
    { termsAccepted: undefined },
    { privacyAccepted: undefined },
    { termsAccepted: false },
    { privacyAccepted: false },
    { termsAccepted: 'true' },
    { privacyAccepted: 1 },
  ]) assert.equal(hasCurrentLegalConsent(currentConsent(overrides)), false)
})

test('hasCurrentLegalConsent rejects missing and malformed timestamps', () => {
  for (const overrides of [
    { termsAcceptedAt: null },
    { termsAcceptedAt: undefined },
    { privacyAcceptedAt: null },
    { termsAcceptedAt: new Date() },
    { termsAcceptedAt: 1_700_000_000_000 },
    { privacyAcceptedAt: '2026-07-04' },
    { termsAcceptedAt: {} },
    { termsAcceptedAt: { toMillis: () => 1_700_000_000_000 } },
    { termsAcceptedAt: { ...timestamp, seconds: '1700000000' } },
    { termsAcceptedAt: { ...timestamp, seconds: 1.5 } },
    { termsAcceptedAt: { ...timestamp, seconds: Number.NaN } },
    { termsAcceptedAt: { ...timestamp, nanoseconds: '0' } },
    { termsAcceptedAt: { ...timestamp, nanoseconds: -1 } },
    { termsAcceptedAt: { ...timestamp, nanoseconds: 1_000_000_000 } },
    { termsAcceptedAt: { ...timestamp, nanoseconds: 1.5 } },
    { termsAcceptedAt: { toMillis: () => Number.NaN } },
    { termsAcceptedAt: { ...timestamp, toMillis: () => Number.NaN } },
    { termsAcceptedAt: { ...timestamp, toMillis: () => Number.POSITIVE_INFINITY } },
    { termsAcceptedAt: { ...timestamp, toMillis: () => 1_700_000_000_124 } },
    { privacyAcceptedAt: { toMillis: () => { throw new Error('bad timestamp') } } },
    { privacyAcceptedAt: { ...timestamp, toMillis: () => { throw new Error('bad timestamp') } } },
  ]) assert.equal(hasCurrentLegalConsent(currentConsent(overrides)), false)
})

test('hasCurrentLegalConsent evaluates Terms and Privacy versions independently', () => {
  for (const overrides of [
    { termsVersion: undefined },
    { privacyVersion: null },
    { termsVersion: 1 },
    { privacyVersion: {} },
    { termsVersion: '0.9' },
    { privacyVersion: '0.9' },
  ]) assert.equal(hasCurrentLegalConsent(currentConsent(overrides)), false)
})

test('historical evidence permits access without asserting current agreement or mutation', () => {
 const profile = currentConsent({termsVersion:'1.0', privacyVersion:'1.0'})
 const before = {...profile}
 assert.equal(hasValidLegalConsent(profile),true)
 assert.equal(hasCurrentLegalConsent(profile),false)
 assert.deepEqual(profile,before)
 for(const patch of [{termsVersion:'0.9'},{termsVersion:'99'},{privacyVersion:'1.3'},{termsAccepted:false},{privacyAcceptedAt:null}]) assert.equal(hasValidLegalConsent({...profile,...patch}),false)
 assert.equal(hasValidLegalConsent(currentConsent()),true)
})

// Evidence recognition and access policy must not implicitly follow publication.
const {
  SUPPORTED_TERMS_VERSIONS, SUPPORTED_PRIVACY_VERSIONS,
  LEGAL_ACCESS_VERSION_REQUIREMENTS, hasHistoricalLegalEvidence,
  hasValidTermsAcceptance, hasValidPrivacyAcknowledgment, isSupportedLegalVersionPair,
  CURRENT_TERMS_EFFECTIVE_DATE, CURRENT_PRIVACY_EFFECTIVE_DATE,
} = await import('../index.js')
const { readFile } = await import('node:fs/promises')

test('current dates and bounded evidence/access lists remain unchanged', () => {
  assert.equal(CURRENT_TERMS_EFFECTIVE_DATE, '2026-09-27')
  assert.equal(CURRENT_PRIVACY_EFFECTIVE_DATE, '2026-09-27')
  for (const versions of [SUPPORTED_TERMS_VERSIONS, SUPPORTED_PRIVACY_VERSIONS,
    LEGAL_ACCESS_VERSION_REQUIREMENTS.terms, LEGAL_ACCESS_VERSION_REQUIREMENTS.privacy]) {
    assert.deepEqual(versions, ['1.0', '1.1', '1.2'])
    assert.equal(Object.isFrozen(versions), true)
  }
})

test('all recognized mixed pairs retain independent valid evidence and today access', () => {
  for (const termsVersion of SUPPORTED_TERMS_VERSIONS) for (const privacyVersion of SUPPORTED_PRIVACY_VERSIONS) {
    const p = Object.freeze(currentConsent({ termsVersion, privacyVersion }))
    assert.equal(isSupportedLegalVersionPair(termsVersion, privacyVersion), true)
    assert.equal(hasHistoricalLegalEvidence(p), true)
    assert.equal(hasValidLegalConsent(p), true)
    assert.equal(hasCurrentLegalConsent(p), termsVersion === CURRENT_TERMS_VERSION && privacyVersion === CURRENT_PRIVACY_VERSION)
    assert.equal(p.termsAcceptedAt, timestamp)
    assert.equal(p.privacyAcceptedAt, timestamp)
  }
})

test('missing evidence is distinct from recognized historical evidence', () => {
  assert.equal(hasHistoricalLegalEvidence(null), false)
  const p = currentConsent({ termsVersion: '1.0', privacyAcceptedAt: null })
  assert.equal(hasValidTermsAcceptance(p), true)
  assert.equal(hasValidPrivacyAcknowledgment(p), false)
  assert.equal(hasHistoricalLegalEvidence(p), false)
})

test('unsupported and malformed pairs fail closed independently', () => {
  for (const version of ['0.9', '99', '', null, 1.1, {}, []]) {
    assert.equal(isSupportedLegalVersionPair(version, CURRENT_PRIVACY_VERSION), false)
    assert.equal(isSupportedLegalVersionPair(CURRENT_TERMS_VERSION, version), false)
    assert.equal(hasHistoricalLegalEvidence(currentConsent({ termsVersion: version })), false)
    assert.equal(hasHistoricalLegalEvidence(currentConsent({ privacyVersion: version })), false)
  }
})

test('publication edits alone cannot erase evidence or choose a new access requirement', async () => {
  const source = await readFile(new URL('../legalConsent.js', import.meta.url), 'utf8')
  // Hypothetical publication only, in memory: no future version added to runtime.
  const changed = source.replace("CURRENT_TERMS_VERSION = '1.2'", "CURRENT_TERMS_VERSION = 'unpublished-test'")
  const contract = await import('data:text/javascript,' + encodeURIComponent(changed))
  const p = Object.freeze(currentConsent())
  assert.equal(contract.hasHistoricalLegalEvidence(p), true)
  assert.equal(contract.hasValidLegalConsent(p), true)
  assert.equal(contract.hasCurrentLegalConsent(p), false)
  assert.equal(contract.isSupportedLegalVersionPair('unpublished-test', CURRENT_PRIVACY_VERSION), false)
})

test('a separate hypothetical access policy cannot make recovery overwrite historical evidence', async () => {
  const source = await readFile(new URL('../legalConsent.js', import.meta.url), 'utf8')
  const changed = source.replace("terms: Object.freeze(['1.0', '1.1', '1.2'])", "terms: Object.freeze(['1.1'])")
  const contract = await import('data:text/javascript,' + encodeURIComponent(changed))
  const p = currentConsent({ termsVersion: '1.0' })
  assert.equal(contract.hasHistoricalLegalEvidence(p), true)
  assert.equal(contract.hasValidLegalConsent(p), false)
  assert.equal(contract.hasValidTermsAcceptance(p), true)
})

test('Rules bounded version helpers mirror canonical evidence lists', async () => {
  const rules = await readFile(new URL('../../../firestore.rules', import.meta.url), 'utf8')
  for (const [name, versions] of [['Terms', SUPPORTED_TERMS_VERSIONS], ['Privacy', SUPPORTED_PRIVACY_VERSIONS]]) {
    const match = rules.match(new RegExp(`function supported${name}Version\\(version\\) \\{\\s*return version in (\\[[^;]+\\]);`))
    assert.ok(match, name)
    assert.deepEqual(JSON.parse(match[1].replaceAll("'", '"')), versions)
    assert.equal(rules.split(`supported${name}Version(request.resource.data.${name.toLowerCase()}Version)`).length - 1, 2)
  }
})
