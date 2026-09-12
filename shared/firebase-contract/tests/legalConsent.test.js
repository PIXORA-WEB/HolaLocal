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
  assert.equal(CURRENT_TERMS_VERSION, '1.1')
  assert.equal(CURRENT_PRIVACY_VERSION, '1.1')
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
 for(const patch of [{termsVersion:'0.9'},{termsVersion:'99'},{privacyVersion:'1.2'},{termsAccepted:false},{privacyAcceptedAt:null}]) assert.equal(hasValidLegalConsent({...profile,...patch}),false)
 assert.equal(hasValidLegalConsent(currentConsent()),true)
})
