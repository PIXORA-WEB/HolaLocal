// Owns all reads and writes for Firestore user profile documents.
// Authentication credentials remain the responsibility of Firebase Auth.
import { doc, getDoc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config.js'

const editableProfileFields = new Set([
  'email',
  'displayName',
  'firstName',
  'lastName',
  'preferredLanguage',
  'accountType',
  'roles',
  'city',
  'country',
  'isVerified',
  'isPremium',
  'profileCompleted',
  'onboardingCompleted',
  'businessProfileRequired',
  'businessProfileCompleted',
  'businessId',
  'deletedAt',
])

function userDocument(uid) {
  if (!uid) throw new Error('A user ID is required.')
  return doc(db, 'users', uid)
}

function sanitizeProfileData(profileData) {
  return Object.fromEntries(
    Object.entries(profileData).filter(
      ([field, value]) => editableProfileFields.has(field) && value !== undefined,
    ),
  )
}

function buildNewProfile(uid, profileData = {}) {
  return {
    uid,
    email: profileData.email ?? '',
    displayName: profileData.displayName ?? '',
    firstName: profileData.firstName ?? '',
    lastName: profileData.lastName ?? '',
    photoURL: null,
    preferredLanguage: 'English',
    accountType: 'customer',
    roles: ['customer'],
    city: '',
    country: 'Spain',
    isVerified: false,
    isPremium: false,
    profileCompleted: false,
    onboardingCompleted: false,
    businessProfileRequired: false,
    businessProfileCompleted: false,
    businessId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
    deletedAt: null,
    ...sanitizeProfileData(profileData),
  }
}

export async function getUserProfile(uid) {
  const snapshot = await getDoc(userDocument(uid))
  return snapshot.exists() ? snapshot.data() : null
}

export async function createUserProfile(uid, profileData = {}) {
  const reference = userDocument(uid)

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference)

    if (!snapshot.exists()) {
      transaction.set(reference, buildNewProfile(uid, profileData))
    }
  })

  return getUserProfile(uid)
}

export async function updateUserProfile(uid, updates) {
  const safeUpdates = sanitizeProfileData(updates)

  await updateDoc(userDocument(uid), {
    ...safeUpdates,
    updatedAt: serverTimestamp(),
  })

  return getUserProfile(uid)
}

export async function ensureUserProfile(firebaseUser) {
  if (!firebaseUser?.uid) throw new Error('An authenticated Firebase user is required.')

  const existingProfile = await getUserProfile(firebaseUser.uid)

  if (!existingProfile) {
    return createUserProfile(firebaseUser.uid, {
      email: firebaseUser.email ?? '',
      displayName: firebaseUser.displayName ?? '',
      photoURL: null,
    })
  }

  const defaults = {
    ...buildNewProfile(firebaseUser.uid, {
      email: firebaseUser.email ?? '',
      displayName: firebaseUser.displayName ?? '',
    }),
    onboardingCompleted: true,
    businessProfileRequired: false,
    businessProfileCompleted: false,
  }
  const missingFields = Object.fromEntries(
    Object.entries(defaults).filter(([field]) => !Object.hasOwn(existingProfile, field)),
  )

  if (firebaseUser.email && existingProfile.email !== firebaseUser.email) {
    missingFields.email = firebaseUser.email
  }

  if (Object.keys(missingFields).length > 0) {
    await updateDoc(userDocument(firebaseUser.uid), {
      ...missingFields,
      updatedAt: serverTimestamp(),
    })
    return getUserProfile(firebaseUser.uid)
  }

  return existingProfile
}

export async function updateLastActive(uid) {
  await updateDoc(userDocument(uid), {
    lastActiveAt: serverTimestamp(),
  })
}
