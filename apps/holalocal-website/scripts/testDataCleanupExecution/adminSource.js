import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldPath, getFirestore } from 'firebase-admin/firestore'
import { createAdminCleanupAuditSource } from '../testDataCleanupAudit/adminSource.js'

export function createAdminCleanupExecutionSource(options) {
  const readSource = createAdminCleanupAuditSource(options)
  const app = getApps().find((candidate) => candidate.options.projectId === options.projectId)
    ?? initializeApp(options.emulator
      ? { projectId: options.projectId }
      : { credential: applicationDefault(), projectId: options.projectId })
  const database = getFirestore(app)
  const auth = getAuth(app)

  return {
    ...readSource,

    async deleteDocument(path) {
      const [collectionName, documentId] = String(path).split('/')
      if (!collectionName || !documentId || String(path).split('/').length !== 2) throw new Error('Invalid document path.')
      await database.collection(collectionName).doc(documentId).delete()
      return { path, status: 'deleted' }
    },

    async deleteUserSavedBusinesses(uid) {
      if (!uid || String(uid).includes('/')) throw new Error('Invalid user ID.')
      const collection = database.collection('users').doc(uid).collection('savedBusinesses')
      let deleted = 0
      while (true) {
        const snapshot = await collection.orderBy(FieldPath.documentId()).limit(200).get()
        if (snapshot.empty) break
        const batch = database.batch()
        for (const document of snapshot.docs) batch.delete(document.ref)
        await batch.commit()
        deleted += snapshot.size
      }
      return { deleted, status: 'deleted', uid }
    },

    async deleteAuthAccount(uid) {
      try {
        await auth.deleteUser(uid)
        return { uid, status: 'deleted' }
      } catch (error) {
        if (error?.code === 'auth/user-not-found') return { uid, status: 'already-absent' }
        throw error
      }
    },
  }
}
