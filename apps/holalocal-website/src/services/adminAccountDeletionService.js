import {
  finalizeAccountDeletionCallable,
  listAdminAccountDeletionRequestsCallable,
} from '../firebase/functionsClient.js'

export async function listAccountDeletionRequests({ includeHistory = false } = {}) {
  const result = await listAdminAccountDeletionRequestsCallable({ includeHistory: includeHistory === true })
  return result.data
}

export async function finalizeAccountDeletion(uid, expectedRequestVersion) {
  const result = await finalizeAccountDeletionCallable({ uid, expectedRequestVersion })
  return result.data
}
