import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

export function createContactPrivacyRepairSource({ projectId }) {
  const name = `contact-privacy-repair-${projectId}`
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
        updateTime: snapshot.updateTime ?? null,
        updateTimeString: snapshot.updateTime?.toDate().toISOString() ?? null,
      })
    },
  })
}
