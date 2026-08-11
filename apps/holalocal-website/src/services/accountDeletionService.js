import { doc, getDoc } from 'firebase/firestore'
import { cancelAccountDeletionCallable, requestAccountDeletionCallable } from '../firebase/functionsClient.js'
import { db } from '../firebase/firestoreClient.js'

export async function requestAccountDeletion() {
  const response = await requestAccountDeletionCallable({})
  return response.data
}

export async function cancelAccountDeletion() {
  const response = await cancelAccountDeletionCallable({})
  return response.data
}

export async function getAccountDeletionRequest(uid) {
  if (!uid) return null
  const snapshot = await getDoc(doc(db, 'accountDeletionRequests', uid))
  return snapshot.exists() ? snapshot.data() : null
}

export function accountDeletionErrorReason(error) {
  const message = String(error?.message ?? '')
  const details = String(error?.details ?? '')
  return [details, message].find((value) => value.includes('recent-authentication-required'))
    ? 'recent-authentication-required'
    : [details, message].find((value) => value.includes('business-ownership-integrity-conflict'))
      ? 'business-ownership-integrity-conflict'
      : 'request-failed'
}
