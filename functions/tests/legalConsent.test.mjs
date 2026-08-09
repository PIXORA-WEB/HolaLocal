import test from 'node:test'
import assert from 'node:assert/strict'
import { FakeFirestore } from './fakeFirestore.mjs'
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from '@holalocal/firebase-contract'
import { acceptLegalConsent } from '../src/legalConsent.js'

const timestamp = { seconds: 1_700_000_000, nanoseconds: 0, toMillis: () => 1_700_000_000_000 }

function existingProfile(overrides = {}) {
  return {
    uid: 'user-1',
    email: 'private@example.test',
    roles: ['customer', 'business'],
    accountType: 'both',
    accountStatus: 'active',
    profileCompleted: true,
    onboardingCompleted: true,
    city: 'Marbella',
    privateField: 'preserve-me',
    updatedAt: { toMillis: () => 1_600_000_000_000 },
    deletionRequestedAt: null,
    ...overrides,
  }
}

function database(profile) {
  const db = new FakeFirestore()
  if (profile) db.store.set('users/user-1', profile)
  return db
}

async function accept(db, overrides = {}) {
  return acceptLegalConsent({
    uid: 'user-1',
    email: 'auth@example.test',
    emailVerified: true,
    acceptTerms: true,
    acceptPrivacy: true,
    db,
    timestampFactory: () => timestamp,
    ...overrides,
  })
}

test('acceptLegalConsent requires authentication and both exact acknowledgements', async () => {
  await assert.rejects(
    () => accept(database(), { uid: '' }),
    (error) => error.code === 'unauthenticated',
  )
  for (const acknowledgements of [
    { acceptTerms: false },
    { acceptPrivacy: false },
    { acceptTerms: 'true' },
    { acceptPrivacy: 1 },
  ]) {
    await assert.rejects(
      () => accept(database(), acknowledgements),
      (error) => error.code === 'invalid-argument' && error.message === 'legal-consent-required',
    )
  }
})

test('acceptLegalConsent requires an authoritative verified-email claim before any Firestore access', async () => {
  for (const emailVerified of [false, undefined, null, 1, 'true']) {
    await assert.rejects(
      () => acceptLegalConsent({
        uid: 'user-1', email: 'auth@example.test', emailVerified,
        acceptTerms: true, acceptPrivacy: true, db: {
          doc() { throw new Error('must not access Firestore') },
        },
      }),
      (error) => error.code === 'failed-precondition' && error.message === 'email-verification-required',
    )
  }
})

test('acceptLegalConsent writes server-owned versions and preserves every unrelated field', async () => {
  const original = existingProfile({
    termsAccepted: true,
    termsAcceptedAt: timestamp,
    termsVersion: '0.9',
    privacyAccepted: true,
    privacyAcceptedAt: timestamp,
    privacyVersion: CURRENT_PRIVACY_VERSION,
  })
  const db = database(original)
  const result = await accept(db)
  const stored = db.data('users/user-1')

  assert.deepEqual(result, {
    current: true,
    termsVersion: CURRENT_TERMS_VERSION,
    privacyVersion: CURRENT_PRIVACY_VERSION,
  })
  assert.equal(stored.termsVersion, CURRENT_TERMS_VERSION)
  assert.equal(stored.privacyVersion, CURRENT_PRIVACY_VERSION)
  assert.equal(stored.termsAcceptedAt, timestamp)
  assert.equal(stored.privacyAcceptedAt, timestamp)
  for (const field of ['roles', 'accountType', 'accountStatus', 'profileCompleted', 'onboardingCompleted', 'city', 'privateField', 'updatedAt']) {
    assert.deepEqual(stored[field], original[field])
  }
})

test('acceptLegalConsent upgrades either independently outdated document after explicit acceptance', async () => {
  for (const versions of [
    { termsVersion: '0.9', privacyVersion: CURRENT_PRIVACY_VERSION },
    { termsVersion: CURRENT_TERMS_VERSION, privacyVersion: '0.9' },
  ]) {
    const db = database(existingProfile({
      termsAccepted: true,
      termsAcceptedAt: timestamp,
      privacyAccepted: true,
      privacyAcceptedAt: timestamp,
      ...versions,
    }))
    await accept(db)
    assert.equal(db.data('users/user-1').termsVersion, CURRENT_TERMS_VERSION)
    assert.equal(db.data('users/user-1').privacyVersion, CURRENT_PRIVACY_VERSION)
  }
})

test('acceptLegalConsent is idempotent for exact current consent', async () => {
  const profile = existingProfile({
    termsAccepted: true,
    termsAcceptedAt: timestamp,
    termsVersion: CURRENT_TERMS_VERSION,
    privacyAccepted: true,
    privacyAcceptedAt: timestamp,
    privacyVersion: CURRENT_PRIVACY_VERSION,
  })
  const db = database(profile)
  await accept(db)
  assert.equal(db.writePaths.length, 0)
  assert.equal(db.data('users/user-1'), profile)
})

test('acceptLegalConsent creates a minimal incomplete profile for an Auth-only account', async () => {
  const db = database()
  await accept(db)
  const stored = db.data('users/user-1')

  assert.equal(stored.uid, 'user-1')
  assert.equal(stored.email, 'auth@example.test')
  assert.deepEqual(stored.roles, ['customer'])
  assert.equal(stored.accountStatus, 'active')
  assert.equal(stored.profileCompleted, false)
  assert.equal(stored.onboardingCompleted, false)
  assert.equal(stored.businessProfileRequired, false)
  assert.equal(stored.businessProfileCompleted, false)
  assert.equal(stored.businessId, null)
  assert.equal(stored.displayName, '')
  assert.equal('city' in stored, false)
  assert.equal('country' in stored, false)
  assert.equal('preferredLocale' in stored, false)
  assert.equal(stored.termsVersion, CURRENT_TERMS_VERSION)
  assert.equal(stored.privacyVersion, CURRENT_PRIVACY_VERSION)
})

test('acceptLegalConsent returns a strict minimal allowlist and rejects inactive accounts', async () => {
  const db = database(existingProfile())
  const result = await accept(db)
  assert.deepEqual(Object.keys(result).sort(), ['current', 'privacyVersion', 'termsVersion'])
  assert.equal(JSON.stringify(result).includes('user-1'), false)

  for (const profile of [
    existingProfile({ accountStatus: 'suspended' }),
    existingProfile({ accountStatus: 'deletion_pending' }),
    existingProfile({ accountStatus: 'deleted' }),
    existingProfile({ deletionRequestedAt: timestamp }),
  ]) {
    const inactive = database(profile)
    await assert.rejects(
      () => accept(inactive),
      (error) => error.code === 'failed-precondition' && error.message === 'account-not-active',
    )
    assert.equal(inactive.writePaths.length, 0)
    assert.deepEqual(inactive.data('users/user-1'), profile)
  }
})

test('concurrent acceptance preserves a complete consent pair and unrelated state', async () => {
  const original = existingProfile({ termsVersion: '0.9', privacyVersion: '0.9' })
  const db = database(original)
  const results = await Promise.all([accept(db), accept(db)])
  const stored = db.data('users/user-1')
  assert.deepEqual(results[0], results[1])
  assert.equal(stored.termsAccepted, true)
  assert.equal(stored.privacyAccepted, true)
  assert.equal(stored.termsVersion, CURRENT_TERMS_VERSION)
  assert.equal(stored.privacyVersion, CURRENT_PRIVACY_VERSION)
  assert.equal(stored.privateField, original.privateField)
  assert.deepEqual(stored.roles, original.roles)
  assert.equal([...db.store.keys()].filter((path) => path === 'users/user-1').length, 1)
})
