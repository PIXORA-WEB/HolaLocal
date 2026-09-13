import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  hasCurrentLegalConsent,
  hasValidLegalConsent,
  isSupportedLegalVersionPair,
  hasValidTermsAcceptance,
  hasValidPrivacyAcknowledgment,
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

function consentUpdate(timestamp, profile, termsVersion, privacyVersion) {
  return {
    termsAccepted: true,
    termsAcceptedAt: hasValidTermsAcceptance(profile) ? profile.termsAcceptedAt : timestamp,
    termsVersion: hasValidTermsAcceptance(profile) ? profile.termsVersion : termsVersion,
    privacyAccepted: true,
    privacyAcceptedAt: hasValidPrivacyAcknowledgment(profile) ? profile.privacyAcceptedAt : timestamp,
    privacyVersion: hasValidPrivacyAcknowledgment(profile) ? profile.privacyVersion : privacyVersion,
  }
}

function result(profile, newlyRecorded = false) {
  return {
    current: (newlyRecorded && profile.termsVersion === CURRENT_TERMS_VERSION && profile.privacyVersion === CURRENT_PRIVACY_VERSION) || hasCurrentLegalConsent(profile),
    termsVersion: profile.termsVersion,
    privacyVersion: profile.privacyVersion,
  }
}

export async function acceptLegalConsent({
  uid,
  email,
  emailVerified,
  acceptTerms,
  acceptPrivacy,
  // Older released clients displayed version1.0 and did not send version fields.
  termsVersion = '1.0',
  privacyVersion = '1.0',
  db,
  timestampFactory = () => FieldValue.serverTimestamp(),
}) {
  const safeUid = requireUid(uid)
  if (emailVerified !== true) {
    throw new HttpsError('failed-precondition', 'email-verification-required')
  }
  requireAcknowledgements(acceptTerms, acceptPrivacy)
  if (!isSupportedLegalVersionPair(termsVersion, privacyVersion)) throw new HttpsError('invalid-argument', 'unsupported-legal-version')
  const userRef = db.doc(`users/${safeUid}`)

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef)
    const profile = snapshot.exists ? snapshot.data() : null

    if (profile && (profile.accountStatus !== 'active' || profile.deletionRequestedAt != null)) {
      throw new HttpsError('failed-precondition', 'account-not-active')
    }
    if (hasValidLegalConsent(profile)) return result(profile)

    const timestamp = timestampFactory()
    const consent = consentUpdate(timestamp, profile, termsVersion, privacyVersion)
    if (profile) {
      transaction.update(userRef, consent)
      return result(consent, true)
    }

    transaction.set(userRef, {
      ...minimalUserProfile({ uid: safeUid, email, timestamp }),
      ...consent,
    })
    return result(consent, true)
  })
}
