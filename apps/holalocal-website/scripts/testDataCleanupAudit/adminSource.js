import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldPath, getFirestore } from 'firebase-admin/firestore'

const COLLECTION_FIELDS = Object.freeze({
  users: [
    'uid', 'roles', 'accountType', 'accountStatus', 'businessId',
    'createdAt', 'updatedAt', 'profilePhoto', 'photoURL',
  ],
  businesses: [
    'ownerId', 'managerIds', 'name', 'businessName', 'primaryCategoryId', 'mainCategory',
    'categoryIds', 'subcategories', 'serviceAreas', 'customServiceAreas',
    'languages', 'languageLabels', 'primaryLanguage', 'contact',
    'profilePhoto', 'coverPhoto', 'galleryImages', 'galleryImageURLs', 'logoURL',
    'coverImageURL', 'status', 'verificationStatus', 'subscription', 'subscriptionTier',
    'isActive', 'isVerified', 'isPremium', 'createdAt', 'updatedAt',
  ],
  businessPrivate: ['ownerId', 'managerIds', 'businessId', 'createdAt', 'updatedAt'],
  conversations: ['businessId', 'customerId', 'participantIds', 'participantState', 'status', 'createdAt', 'updatedAt'],
  reports: ['reporterId', 'targetType', 'targetId', 'parentId', 'status', 'priority', 'createdAt', 'updatedAt'],
  businessOwners: ['ownerId', 'businessId', 'createdAt', 'updatedAt'],
})

export function createAdminCleanupAuditSource(options) {
  const app = getApps().find((candidate) => candidate.options.projectId === options.projectId)
    ?? initializeApp(options.emulator
      ? { projectId: options.projectId }
      : { credential: applicationDefault(), projectId: options.projectId })
  const database = getFirestore(app)
  const auth = getAuth(app)

  return {
    async getAuthAccount(uid) {
      try {
        const record = await auth.getUser(uid)
        return {
          exists: true,
          uid,
          disabled: Boolean(record.disabled),
          creationTime: record.metadata?.creationTime ?? null,
          lastSignInTime: record.metadata?.lastSignInTime ?? null,
        }
      } catch (error) {
        if (error?.code === 'auth/user-not-found') return { exists: false, uid }
        throw error
      }
    },

    async getDocument(collectionName, documentId) {
      const snapshot = await database.collection(collectionName).doc(documentId).get()
      if (!snapshot.exists) return { exists: false, id: documentId, path: `${collectionName}/${documentId}`, data: null }
      return { exists: true, id: snapshot.id, path: `${collectionName}/${snapshot.id}`, data: snapshot.data() }
    },

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
  }
}
