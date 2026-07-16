// Owns all reads and writes for Firestore user profile documents.
// Authentication credentials remain the responsibility of Firebase Auth.
import { doc, getDoc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/firestoreClient.js'
import { updateAccountRoleCallable } from '../firebase/functionsClient.js'
import { toWebsiteUserProfile } from './firebaseCompatibility.js'

async function uploadImageFile(...args) {
  const storage = await import('../firebase/storageClient.js')
  return storage.uploadImageFile(...args)
}

async function deleteImageFile(...args) {
  const storage = await import('../firebase/storageClient.js')
  return storage.deleteImageFile(...args)
}

const editableProfileFields = new Set([
  'displayName',
  'displayNameNormalized',
  'firstName',
  'lastName',
  'photoURL',
  'profilePhoto',
  'preferredLocale',
  'city',
  'country',
  'profileCompleted',
  'termsAccepted',
  'termsAcceptedAt',
  'termsVersion',
  'privacyAccepted',
  'privacyAcceptedAt',
  'privacyVersion',
  'deletionRequestedAt',
])

const consentFields = new Set([
  'termsAccepted',
  'termsAcceptedAt',
  'termsVersion',
  'privacyAccepted',
  'privacyAcceptedAt',
  'privacyVersion',
])

function normalizeName(value) {
  return String(value ?? '').trim().toLocaleLowerCase()
}

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
  const safeData = sanitizeProfileData(profileData)
  const displayName = safeData.displayName ?? profileData.displayName ?? ''
  const termsAccepted = profileData.termsAccepted === true
  const privacyAccepted = profileData.privacyAccepted === true

  return {
    uid,
    email: profileData.email ?? '',
    firstName: profileData.firstName ?? '',
    lastName: profileData.lastName ?? '',
    photoURL: null,
    profilePhoto: null,
    preferredLocale: 'en',
    accountType: 'customer',
    roles: ['customer'],
    city: '',
    country: 'Spain',
    accountStatus: 'active',
    profileCompleted: false,
    onboardingCompleted: false,
    businessProfileRequired: false,
    businessProfileCompleted: false,
    businessId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
    termsAccepted,
    termsAcceptedAt: termsAccepted ? serverTimestamp() : null,
    termsVersion: termsAccepted ? profileData.termsVersion ?? null : null,
    privacyAccepted,
    privacyAcceptedAt: privacyAccepted ? serverTimestamp() : null,
    privacyVersion: privacyAccepted ? profileData.privacyVersion ?? null : null,
    deletionRequestedAt: null,
    deletionScheduledFor: null,
    anonymizedAt: null,
    ...safeData,
    displayName,
    displayNameNormalized: normalizeName(displayName),
  }
}

async function getRawUserProfile(uid) {
  const snapshot = await getDoc(userDocument(uid))
  return snapshot.exists() ? snapshot.data() : null
}

export async function getUserProfile(uid) {
  const profile = await getRawUserProfile(uid)
  return profile ? toWebsiteUserProfile(uid, profile) : null
}

export async function createUserProfile(uid, profileData = {}) {
  const reference = userDocument(uid)

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference)

    if (!snapshot.exists()) {
      transaction.set(reference, buildNewProfile(uid, profileData))
    } else if (profileData.termsAccepted === true && profileData.privacyAccepted === true) {
      transaction.update(reference, {
        termsAccepted: true,
        termsAcceptedAt: serverTimestamp(),
        termsVersion: profileData.termsVersion,
        privacyAccepted: true,
        privacyAcceptedAt: serverTimestamp(),
        privacyVersion: profileData.privacyVersion,
        updatedAt: serverTimestamp(),
      })
    }
  })

  return getUserProfile(uid)
}

export async function updateUserProfile(uid, updates) {
  const safeUpdates = sanitizeProfileData(updates)

  if (safeUpdates.displayName !== undefined) {
    safeUpdates.displayNameNormalized = normalizeName(safeUpdates.displayName)
  }

  await updateDoc(userDocument(uid), {
    ...safeUpdates,
    updatedAt: serverTimestamp(),
  })

  return getUserProfile(uid)
}

export async function configureAccountType(uid, accountType) {
  await updateAccountRoleCallable({ accountType })
  return getUserProfile(uid)
}

export async function enableBusinessRole(uid) {
  await updateAccountRoleCallable({ accountType: 'both' })
  return getUserProfile(uid)
}

export async function uploadUserProfilePhoto(uid, file) {
  const existingProfile = await getUserProfile(uid)
  const uploadedPhoto = await uploadImageFile(`users/${uid}/profile`, file)

  try {
    const updatedProfile = await updateUserProfile(uid, {
      photoURL: uploadedPhoto.downloadUrl,
      profilePhoto: {
        ...uploadedPhoto,
        uploadedAt: new Date().toISOString(),
      },
    })

    if (
      existingProfile?.profilePhoto?.storagePath &&
      existingProfile.profilePhoto.storagePath !== uploadedPhoto.storagePath
    ) {
      await deleteImageFile(existingProfile.profilePhoto.storagePath).catch(() => undefined)
    }

    return updatedProfile
  } catch (error) {
    await deleteImageFile(uploadedPhoto.storagePath).catch(() => undefined)
    throw error
  }
}

export async function ensureUserProfile(firebaseUser) {
  if (!firebaseUser?.uid) throw new Error('An authenticated Firebase user is required.')

  const existingProfile = await getRawUserProfile(firebaseUser.uid)

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
    Object.entries(defaults).filter(
      ([field]) => !consentFields.has(field) && !Object.hasOwn(existingProfile, field),
    ),
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

  return toWebsiteUserProfile(firebaseUser.uid, existingProfile)
}

export async function updateLastActive(uid) {
  await updateDoc(userDocument(uid), {
    lastActiveAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}
