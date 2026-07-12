import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

export function createContactPrivacyExecutionSource({ projectId }) {
  const name = `contact-privacy-execution-${projectId}`
  const app = getApps().find((candidate) => candidate.name === name) ?? initializeApp({
    credential: applicationDefault(),
    projectId,
  }, name)
  const db = getFirestore(app)

  return Object.freeze({
    async getDocument(path) {
      const snapshot = await db.doc(path).get()
      return Object.freeze({
        path,
        exists: snapshot.exists,
        data: snapshot.exists ? snapshot.data() : null,
      })
    },
    async clearHiddenPublicWebsite(path) {
      await db.doc(path).update({
        'contact.website': '',
        'contact.websiteVisible': false,
      })
      return Object.freeze({ status: 'updated', fields: ['contact.website', 'contact.websiteVisible'] })
    },
  })
}
