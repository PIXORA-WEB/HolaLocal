// Centralizes Firebase Authentication and user-profile persistence operations.
// UI components should consume these functions through AuthenticationContext.
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { createUserProfile, ensureUserProfile, updateLastActive } from '../services/userService.js'
import { auth } from './config.js'

let persistencePromise

function configurePersistence() {
  persistencePromise ??= setPersistence(auth, browserLocalPersistence)
  return persistencePromise
}

export async function registerUser(email, password) {
  await configurePersistence()
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  const { user } = credential

  try {
    await createUserProfile(user.uid, {
      email: user.email,
      displayName: user.displayName ?? '',
      photoURL: user.photoURL ?? null,
    })
  } catch (error) {
    await deleteUser(user).catch(() => undefined)
    throw error
  }

  return user
}

export async function loginUser(email, password) {
  await configurePersistence()
  const credential = await signInWithEmailAndPassword(auth, email, password)
  await ensureUserProfile(credential.user)
  await updateLastActive(credential.user.uid)

  return credential.user
}

export async function logoutUser() {
  await signOut(auth)
}

export async function sendPasswordReset(email) {
  await sendPasswordResetEmail(auth, email)
}

export function observeAuthentication(callback, errorCallback) {
  return onAuthStateChanged(auth, callback, errorCallback)
}

export function getAuthenticationErrorMessage(error) {
  const messages = {
    'auth/email-already-in-use': 'An account already exists for this email address.',
    'auth/invalid-credential': 'The email address or password is incorrect.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/network-request-failed': 'Unable to connect. Check your internet connection and try again.',
    'auth/too-many-requests': 'Too many attempts. Please wait before trying again.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/weak-password': 'Choose a stronger password with at least six characters.',
  }

  return messages[error?.code] ?? error?.message ?? 'Something went wrong. Please try again.'
}
