// Centralizes Firebase Authentication and user-profile persistence operations.
// UI components should consume these functions through AuthenticationContext.
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { getFirebaseApp } from './config.js'

const loadUserService = () => import('../services/userService.js')

let persistencePromise
let firebaseAuth

export function getFirebaseAuth() {
  firebaseAuth ??= getAuth(getFirebaseApp())
  return firebaseAuth
}

function verificationActionSettings() {
  return { url: `${window.location.origin}/verify-email` }
}

function configurePersistence() {
  persistencePromise ??= setPersistence(getFirebaseAuth(), browserLocalPersistence)
  return persistencePromise
}

export async function registerUser(email, password, policyConsent) {
  if (!policyConsent?.termsAccepted || !policyConsent?.privacyAccepted) {
    throw new Error('Accept the Terms and Privacy Policy before creating your account.')
  }

  await configurePersistence()
  const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password)
  const { user } = credential

  try {
    const { createUserProfile } = await loadUserService()
    await createUserProfile(user.uid, {
      email: user.email,
      displayName: user.displayName ?? '',
      photoURL: user.photoURL ?? null,
      termsAccepted: true,
      termsVersion: policyConsent.termsVersion,
      privacyAccepted: true,
      privacyVersion: policyConsent.privacyVersion,
    })
  } catch (error) {
    await deleteUser(user).catch(() => undefined)
    throw error
  }

  let verificationEmailSent = true
  try {
    await sendEmailVerification(user, verificationActionSettings())
  } catch {
    verificationEmailSent = false
  }

  return { user, verificationEmailSent }
}

export async function loginUser(email, password) {
  await configurePersistence()
  const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email, password)
  const { ensureUserProfile, getUserProfile, updateLastActive } = await loadUserService()
  const existingProfile = await getUserProfile(credential.user.uid)
  if (!existingProfile || (existingProfile.accountStatus === 'active' && existingProfile.deletionRequestedAt == null)) {
    await ensureUserProfile(credential.user)
    await updateLastActive(credential.user.uid)
  }

  return credential.user
}

export async function logoutUser() {
  await signOut(getFirebaseAuth())
}

export async function sendPasswordReset(email) {
  await sendPasswordResetEmail(getFirebaseAuth(), email)
}

export async function resendEmailVerification(user) {
  if (!user) throw new Error('Sign in before requesting another verification email.')
  await sendEmailVerification(user, verificationActionSettings())
}

export async function reloadAuthenticationUser(user) {
  if (!user) return false
  await reload(user)
  return user.emailVerified === true
}

export function observeAuthentication(callback, errorCallback) {
  return onAuthStateChanged(getFirebaseAuth(), callback, errorCallback)
}

export function getAuthenticationErrorMessage(error, translate) {
  const keys = {
    'auth/email-already-in-use': 'auth.errors.emailInUse',
    'auth/invalid-credential': 'auth.errors.invalidCredential',
    'auth/invalid-email': 'auth.errors.invalidEmail',
    'auth/network-request-failed': 'auth.errors.network',
    'auth/too-many-requests': 'auth.errors.tooManyRequests',
    'auth/user-disabled': 'auth.errors.userDisabled',
    'auth/weak-password': 'auth.errors.weakPassword',
    'business/ambiguous-ownership': 'business.compatibility.ownershipConflict',
  }
  const key = keys[error?.code] ?? 'auth.errors.generic'
  return translate ? translate(key) : key
}
