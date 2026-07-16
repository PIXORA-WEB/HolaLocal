import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { hasCompleteUserProfile } from '@holalocal/firebase-contract'

const CONTACT_METHODS = new Set(['holalocal', 'phone', 'email', 'whatsapp'])

function sanitizeContact(contact = {}) {
  const preferredContactMethod = CONTACT_METHODS.has(contact.preferredContactMethod)
    ? contact.preferredContactMethod
    : 'holalocal'
  return {
    phone: String(contact.phone ?? '').trim(),
    phoneVisible: contact.phoneVisible === true,
    email: String(contact.email ?? '').trim(),
    emailVisible: contact.emailVisible === true,
    whatsappNumber: String(contact.whatsappNumber ?? '').trim(),
    whatsappVisible: contact.whatsappVisible === true,
    website: String(contact.website ?? '').trim(),
    websiteVisible: contact.websiteVisible === true,
    preferredContactMethod,
    allowCallbackRequests: contact.allowCallbackRequests === true,
  }
}

function publicContactFromPrivate(contact) {
  return {
    ...contact,
    phone: contact.phoneVisible ? contact.phone : '',
    email: contact.emailVisible ? contact.email : '',
    whatsappNumber: contact.whatsappVisible ? contact.whatsappNumber : '',
    website: contact.websiteVisible ? contact.website : '',
  }
}

function sanitizeLocation(profile = {}) {
  return {
    locality: String(profile.city ?? '').trim(),
    region: '',
    countryCode: profile.country === 'Spain' ? 'ES' : '',
  }
}

function assertEligibleUser({ uid, emailVerified, profile }) {
  if (!uid) throw new HttpsError('unauthenticated', 'auth-required')
  if (emailVerified !== true) throw new HttpsError('failed-precondition', 'email-verification-required')
  if (!profile) throw new HttpsError('failed-precondition', 'profile-not-found')
  if (profile.uid !== uid) throw new HttpsError('permission-denied', 'uid-mismatch')
  if (profile.accountStatus !== 'active' || profile.deletionRequestedAt != null) {
    throw new HttpsError('failed-precondition', 'account-not-active')
  }
  if (!Array.isArray(profile.roles) || !profile.roles.includes('business')) {
    throw new HttpsError('failed-precondition', 'business-role-required')
  }
  if (!hasCompleteUserProfile(profile)) {
    throw new HttpsError('failed-precondition', 'profile-incomplete')
  }
}

function buildDraftBusiness(uid, profile) {
  const privateContact = sanitizeContact({ email: profile.email ?? '' })
  const languages = [profile.preferredLocale || 'en']
  return {
    business: {
      ownerId: uid,
      managerIds: [uid],
      name: '',
      nameNormalized: '',
      slug: '',
      tagline: '',
      description: '',
      primaryCategoryId: '',
      categoryIds: [],
      serviceAreas: [],
      serviceRadiusKm: 20,
      location: sanitizeLocation(profile),
      contact: publicContactFromPrivate(privateContact),
      languages,
      primaryLanguage: languages[0],
      profilePhoto: null,
      galleryImageURLs: [],
      galleryImages: [],
      galleryCount: 0,
      ratingAverage: 0,
      ratingCount: 0,
      status: 'draft',
      verificationStatus: 'unverified',
      verifiedAt: null,
      subscription: {
        tier: 'free',
        status: 'none',
        provider: null,
        currentPeriodEnd: null,
      },
      profileCompleted: false,
      publishedAt: null,
      submittedAt: null,
      deletionRequestedAt: null,
      deletedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    privateBusiness: {
      ownerId: uid,
      managerIds: [uid],
      contact: privateContact,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
  }
}

async function getSingleOwnedBusiness(db, uid) {
  const snapshot = await db.collection('businesses').where('ownerId', '==', uid).limit(2).get()
  if (snapshot.size > 1) throw new HttpsError('failed-precondition', 'ambiguous-business-ownership')
  return snapshot.empty ? null : snapshot.docs[0]
}

async function hasManagedOnlyBusiness(db, uid) {
  const snapshot = await db.collection('businesses').where('managerIds', 'array-contains', uid).limit(10).get()
  return snapshot.docs.some((document) => document.data().ownerId !== uid)
}

export async function ensureOwnerBusiness({ uid, emailVerified, db }) {
  if (!uid) throw new HttpsError('unauthenticated', 'auth-required')
  const userRef = db.doc(`users/${uid}`)
  const deterministicBusinessRef = db.doc(`businesses/${uid}`)
  const deterministicPrivateRef = db.doc(`businessPrivate/${uid}`)

  const [userSnapshot, ownedBusiness, managesOtherBusiness] = await Promise.all([
    userRef.get(),
    getSingleOwnedBusiness(db, uid),
    hasManagedOnlyBusiness(db, uid),
  ])

  const profile = userSnapshot.exists ? userSnapshot.data() : null
  assertEligibleUser({ uid, emailVerified, profile })

  if (ownedBusiness) {
    return { ok: true, businessId: ownedBusiness.id, created: false }
  }
  if (managesOtherBusiness) {
    throw new HttpsError('failed-precondition', 'manager-only-owner-creation-denied')
  }

  let created = false
  await db.runTransaction(async (transaction) => {
    const [businessSnapshot, privateSnapshot] = await Promise.all([
      transaction.get(deterministicBusinessRef),
      transaction.get(deterministicPrivateRef),
    ])
    if (businessSnapshot.exists) {
      const business = businessSnapshot.data()
      if (business.ownerId !== uid) throw new HttpsError('failed-precondition', 'business-id-conflict')
      return
    }
    const documents = buildDraftBusiness(uid, profile)
    transaction.set(deterministicBusinessRef, documents.business)
    if (!privateSnapshot.exists) transaction.set(deterministicPrivateRef, documents.privateBusiness)
    created = true
  })

  return { ok: true, businessId: uid, created }
}
