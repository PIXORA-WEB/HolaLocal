// Owns all reads and writes for Firestore user profile documents.
// Authentication credentials remain the responsibility of Firebase Auth.
import { doc, getDoc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../firebase/config.js'
import { toMobileUserProfile } from './userCompatibility.js'
import { buildProfileUpdates, buildRegistrationProfile } from './userPayloads.js'

function userDocument(uid) {
  if (!uid) throw new Error('A user ID is required.')
  return doc(db, 'users', uid)
}

async function getRawUserProfile(uid) {
  const snapshot = await getDoc(userDocument(uid))
  return snapshot.exists() ? snapshot.data() : null
}

export async function getUserProfile(uid) {
  const raw = await getRawUserProfile(uid)
  return raw ? toMobileUserProfile(uid, raw) : null
}

export async function createUserProfile(uid, profileData = {}) {
  const reference = userDocument(uid)
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference)
    if (!snapshot.exists()) transaction.set(reference, buildRegistrationProfile(uid, profileData, serverTimestamp))
  })
  return getUserProfile(uid)
}

export async function updateUserProfile(uid, updates) {
  const safeUpdates = buildProfileUpdates(updates)
  await updateDoc(userDocument(uid), { ...safeUpdates, updatedAt: serverTimestamp() })
  return getUserProfile(uid)
}

export async function configureAccountType(uid, accountType) {
  const updateAccountRole = httpsCallable(functions, 'updateAccountRole')
  await updateAccountRole({ accountType })
  return getUserProfile(uid)
}

export async function ensureUserProfile(firebaseUser) {
  if (!firebaseUser?.uid) throw new Error('An authenticated Firebase user is required.')
  const existing = await getRawUserProfile(firebaseUser.uid)
  return existing ? toMobileUserProfile(firebaseUser.uid, existing) : null
}

export async function updateLastActive(uid) {
  await updateDoc(userDocument(uid), { lastActiveAt: serverTimestamp(), updatedAt: serverTimestamp() })
}
