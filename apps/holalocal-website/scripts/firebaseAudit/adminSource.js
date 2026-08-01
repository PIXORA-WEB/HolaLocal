import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { FieldPath, getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

const COLLECTION_FIELDS = Object.freeze({
  users: [
    'uid', 'displayName', 'preferredLocale', 'preferredLanguage', 'roles', 'accountType',
    'accountStatus', 'businessId', 'profileCompleted', 'onboardingCompleted',
    'businessProfileCompleted', 'businessProfileRequired', 'email', 'emailVerified',
    'termsAccepted', 'termsAcceptedAt', 'termsVersion', 'privacyAccepted',
    'privacyAcceptedAt', 'privacyVersion', 'deletionRequestedAt', 'deletedAt',
    'isVerified', 'isPremium', 'createdAt', 'updatedAt', 'profilePhoto', 'photoURL',
  ],
  businesses: [
    'ownerId', 'managerIds', 'name', 'businessName', 'primaryCategoryId', 'mainCategory',
    'categoryIds', 'subcategories', 'serviceAreas', 'customServiceAreas',
    'serviceRadiusKm', 'languages', 'languageLabels', 'primaryLanguage', 'location',
    'city', 'province', 'country', 'contact', 'phone', 'email', 'whatsapp',
    'whatsappNumber', 'website', 'profilePhoto', 'coverPhoto', 'galleryImages',
    'galleryImageURLs', 'logoURL', 'coverImageURL', 'status', 'verificationStatus',
    'subscription', 'subscriptionTier', 'isActive', 'isVerified', 'isPremium',
    'profileCompleted', 'galleryCount', 'nameNormalized', 'slug', 'ratingAverage',
    'ratingCount', 'publishedAt', 'verifiedAt', 'createdAt', 'updatedAt',
  ],
  businessPrivate: ['ownerId', 'managerIds', 'contact', 'visibility', 'preferredContactMethod', 'createdAt', 'updatedAt'],
  conversations: ['businessId', 'customerId', 'participantIds', 'participantState', 'status', 'createdAt', 'updatedAt'],
  reports: ['reporterId', 'targetType', 'targetId', 'parentId', 'status', 'priority', 'createdAt', 'updatedAt'],
})

export function createAdminAuditSource(options) {
  const app = getApps().find((candidate) => candidate.options.projectId === options.projectId)
    ?? initializeApp(options.emulator
      ? { projectId: options.projectId }
      : { credential: applicationDefault(), projectId: options.projectId })
  const database = getFirestore(app)
  const storage = options.checkStorage ? getStorage(app) : null
  const bucketName = options.storageBucket || `${options.projectId}.appspot.com`

  return {
    async listCollection(collectionName, { pageSize, cursor } = {}) {
      let query = database.collection(collectionName).orderBy(FieldPath.documentId()).limit(pageSize)
      if (COLLECTION_FIELDS[collectionName]) query = query.select(...COLLECTION_FIELDS[collectionName])
      if (cursor) query = query.startAfter(cursor)
      const snapshot = await query.get()
      const docs = snapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        path: `${collectionName}/${docSnapshot.id}`,
        data: docSnapshot.data(),
      }))
      return { docs, cursor: docs.at(-1)?.id ?? null, done: snapshot.empty || snapshot.size < pageSize }
    },

    async storageObjectExists(path) {
      if (!storage) throw new Error('Storage checks are disabled.')
      const [exists] = await storage.bucket(bucketName).file(path).exists()
      return exists
    },
  }
}
