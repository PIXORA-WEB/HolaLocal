import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  hasCurrentLegalConsent,
} from '@holalocal/firebase-contract'

function requireUid(uid) {
  if (typeof uid !== 'string' || !uid.trim() || uid !== uid.trim() || uid.includes('/')) {
    throw new HttpsError('unauthenticated', 'Authentication is required.')
  }
  return uid
}

function requireAcknowledgements(acceptTerms, acceptPrivacy) {
  if (acceptTerms !== true || acceptPrivacy !== true) {
    throw new HttpsError('invalid-argument', 'legal-consent-required')
  }
}

function minimalUserProfile({ uid, email, timestamp }) {
  return {
    uid,
    email: typeof email === 'string' ? email : '',
    displayName: '',
    displayNameNormalized: '',
    firstName: '',
    lastName: '',
    photoURL: null,
    profilePhoto: null,
    accountType: 'customer',
    roles: ['customer'],
    accountStatus: 'active',
    profileCompleted: false,
    onboardingCompleted: false,
    businessProfileRequired: false,
    businessProfileCompleted: false,
    businessId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastActiveAt: timestamp,
    deletionRequestedAt: null,
    deletionScheduledFor: null,
    anonymizedAt: null,
  }
}

function consentUpdate(timestamp) {
  return {
    termsAccepted: true,
    termsAcceptedAt: timestamp,
    termsVersion: CURRENT_TERMS_VERSION,
    privacyAccepted: true,
    privacyAcceptedAt: timestamp,
    privacyVersion: CURRENT_PRIVACY_VERSION,
  }
}

function result() {
  return {
    current: true,
    termsVersion: CURRENT_TERMS_VERSION,
    privacyVersion: CURRENT_PRIVACY_VERSION,
  }
}

export async function acceptLegalConsent({
  uid,
  email,
  emailVerified,
  acceptTerms,
  acceptPrivacy,
  db,
  timestampFactory = () => FieldValue.serverTimestamp(),
}) {
  const safeUid = requireUid(uid)
  if (emailVerified !== true) {
    throw new HttpsError('failed-precondition', 'email-verification-required')
  }
  requireAcknowledgements(acceptTerms, acceptPrivacy)
  const userRef = db.doc(`users/${safeUid}`)

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef)
    const profile = snapshot.exists ? snapshot.data() : null

    if (profile && (profile.accountStatus !== 'active' || profile.deletionRequestedAt != null)) {
      throw new HttpsError('failed-precondition', 'account-not-active')
    }
    if (hasCurrentLegalConsent(profile)) return

    const timestamp = timestampFactory()
    const consent = consentUpdate(timestamp)
    if (profile) {
      transaction.update(userRef, consent)
      return
    }

    transaction.set(userRef, {
      ...minimalUserProfile({ uid: safeUid, email, timestamp }),
      ...consent,
    })
  })

  return result()
}
