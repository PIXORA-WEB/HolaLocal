// Centralizes Firebase Authentication and user-profile persistence operations.
// UI components should consume these functions through AuthenticationContext.
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { createUserProfile, ensureUserProfile, updateLastActive } from '../services/userService.js'
import { auth } from './config.js'
import { completeRegistration } from './registrationFlow.js'

let persistencePromise

function configurePersistence() {
  persistencePromise ??= setPersistence(auth, browserLocalPersistence)
  return persistencePromise
}

function verificationActionSettings() {
  // A native Capacitor webview origin is not a valid email return destination.
  // Verification is completed by Firebase Auth; the app then confirms it via reload().
  return { url: 'https://www.holalocal.es/verify-email' }
}

export async function registerUser(email, password, policyConsent) {
  if (!policyConsent?.termsAccepted || !policyConsent?.privacyAccepted) {
    throw new Error('Current Terms and Privacy consent is required.')
  }
  await configurePersistence()
  return completeRegistration({
    createAuthenticationUser: (address, secret) => createUserWithEmailAndPassword(auth, address, secret),
    createProfile: (user, consent) => createUserProfile(user.uid, {
      email: user.email,
      displayName: user.displayName ?? '',
      photoURL: user.photoURL ?? null,
      ...consent,
    }),
    deleteAuthenticationUser: deleteUser,
    email,
    password,
    policyConsent,
    sendVerification: (user) => sendEmailVerification(user, verificationActionSettings()),
  })
}

export async function loginUser(email, password) {
  await configurePersistence()
  const credential = await signInWithEmailAndPassword(auth, email, password)
  const profile = await ensureUserProfile(credential.user)
  if (profile?.accountStatus === 'active') await updateLastActive(credential.user.uid)

  return credential.user
}

export async function logoutUser() {
  await signOut(auth)
}

export async function sendPasswordReset(email) {
  await sendPasswordResetEmail(auth, email)
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
  return onAuthStateChanged(auth, callback, errorCallback)
}

export function getAuthenticationErrorMessage(error, translate) {
  const keys = {
    'auth/email-already-in-use': 'auth.errors.registration',
    'auth/invalid-credential': 'auth.errors.invalidCredential',
    'auth/invalid-email': 'auth.errors.invalidEmail',
    'auth/network-request-failed': 'auth.errors.network',
    'auth/too-many-requests': 'auth.errors.tooManyRequests',
    'auth/user-disabled': 'auth.errors.disabled',
    'auth/weak-password': 'auth.errors.weakPassword',
    'business/ambiguous-ownership': 'business.errors.ambiguous',
    'business/invalid-ownership': 'business.errors.invalidOwnership',
    'business/unsupported-legacy': 'business.errors.unsupportedLegacy',
    'business/invalid-edit': 'business.errors.invalidEdit',
  }
  const key = keys[error?.code] ?? 'auth.errors.generic'
  if (translate) return translate(key)
  const fallback = {
    'auth.errors.registration': 'We could not create this account. Try signing in or resetting your password.',
    'auth.errors.invalidCredential': 'The email or password is incorrect.',
    'auth.errors.invalidEmail': 'Enter a valid email address.',
    'auth.errors.network': 'Unable to connect. Try again.',
    'auth.errors.tooManyRequests': 'Too many attempts. Please wait and try again.',
    'auth.errors.disabled': 'This account is unavailable.',
    'auth.errors.weakPassword': 'Choose a stronger password.',
    'auth.errors.generic': 'Something went wrong. Please try again.',
    'business.errors.ambiguous': 'More than one business profile was found. No data was changed.',
    'business.errors.invalidOwnership': 'We could not safely identify your business profile.',
    'business.errors.unsupportedLegacy': 'This business is currently read-only on mobile.',
    'business.errors.invalidEdit': 'Review the business fields and try again.',
  }
  return fallback[key]
}
