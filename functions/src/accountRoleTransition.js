import { HttpsError } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { hasCompleteUserProfile } from '@holalocal/firebase-contract'

const ACCOUNT_ROLE_MAP = Object.freeze({
  customer: Object.freeze(['customer']),
  business: Object.freeze(['business']),
  both: Object.freeze(['customer', 'business']),
})

function requireValidUid(uid) {
  if (typeof uid !== 'string' || !uid.trim() || uid.includes('/')) {
    throw new HttpsError('unauthenticated', 'auth-required')
  }
  return uid.trim()
}

export function buildAccountRoleTransition({
  uid,
  emailVerified,
  profile,
  accountType,
  hasManagedBusiness = false,
}) {
  const safeUid = requireValidUid(uid)
  if (emailVerified !== true) throw new HttpsError('failed-precondition', 'email-verification-required')
  if (!ACCOUNT_ROLE_MAP[accountType]) throw new HttpsError('invalid-argument', 'invalid-account-type')
  if (!profile) throw new HttpsError('failed-precondition', 'profile-not-found')
  if (profile.uid !== safeUid) throw new HttpsError('permission-denied', 'uid-mismatch')
  if (profile.accountStatus !== 'active' || profile.deletionRequestedAt != null) {
    throw new HttpsError('failed-precondition', 'account-not-active')
  }
  if (!hasCompleteUserProfile(profile)) {
    throw new HttpsError('failed-precondition', 'profile-incomplete')
  }
  if (accountType === 'customer' && hasManagedBusiness) {
    throw new HttpsError('failed-precondition', 'business-account-active')
  }

  const roles = ACCOUNT_ROLE_MAP[accountType]
  return {
    accountType,
    roles: [...roles],
    onboardingCompleted: true,
    businessProfileRequired: roles.includes('business'),
    businessProfileCompleted: profile.businessProfileCompleted === true,
    updatedAt: FieldValue.serverTimestamp(),
  }
}

async function hasManagedBusinessForUser(db, uid) {
  const [ownedSnapshot, managedSnapshot] = await Promise.all([
    db.collection('businesses').where('ownerId', '==', uid).limit(1).get(),
    db.collection('businesses').where('managerIds', 'array-contains', uid).limit(1).get(),
  ])
  return !ownedSnapshot.empty || !managedSnapshot.empty
}

export async function transitionAccountRole({ uid, emailVerified, accountType, db }) {
  const safeUid = requireValidUid(uid)
  if (emailVerified !== true) throw new HttpsError('failed-precondition', 'email-verification-required')
  if (!ACCOUNT_ROLE_MAP[accountType]) throw new HttpsError('invalid-argument', 'invalid-account-type')

  const userRef = db.doc(`users/${safeUid}`)
  const hasManagedBusiness = accountType === 'customer'
    ? await hasManagedBusinessForUser(db, safeUid)
    : false
  let update
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef)
    update = buildAccountRoleTransition({
      uid: safeUid,
      emailVerified,
      profile: snapshot.exists ? snapshot.data() : null,
      accountType,
      hasManagedBusiness,
    })
    transaction.update(userRef, update)
  })

  return {
    ok: true,
    accountType: update.accountType,
    roles: update.roles,
    businessProfileRequired: update.businessProfileRequired,
  }
}
