import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions'
import { getFirebaseApp } from './config.js'
import {
  connectFirebaseEmulatorOnce,
  FIREBASE_EMULATOR_ENDPOINTS,
  shouldUseFirebaseEmulators,
} from './emulatorMode.js'

const functions = getFunctions(getFirebaseApp(), 'europe-west1')
if (shouldUseFirebaseEmulators()) {
  const { host, port } = FIREBASE_EMULATOR_ENDPOINTS.functions
  connectFirebaseEmulatorOnce(functions, () => connectFunctionsEmulator(functions, host, port))
}

export const ensureOwnerBusinessCallable = httpsCallable(functions, 'ensureOwnerBusiness')
export const listPublicBusinessesCallable = httpsCallable(functions, 'listPublicBusinesses')
export const sendMessageCallable = httpsCallable(functions, 'sendMessage')
export const openBusinessConversationCallable = httpsCallable(functions, 'openBusinessConversation')
export const getConversationBusinessContextCallable = httpsCallable(functions, 'getConversationBusinessContext')
export const acceptLegalConsentCallable = httpsCallable(functions, 'acceptLegalConsent')
export const manageBusinessMediaCallable = httpsCallable(functions, 'manageBusinessMedia')
export const prepareProfileMediaUploadCallable = httpsCallable(functions, 'prepareProfileMediaUpload')
export const finalizeProfileMediaCallable = httpsCallable(functions, 'finalizeProfileMedia')
export const requestAccountDeletionCallable = httpsCallable(functions, 'requestAccountDeletion')
export const cancelAccountDeletionCallable = httpsCallable(functions, 'cancelAccountDeletion')
export const finalizeAccountDeletionCallable = httpsCallable(functions, 'finalizeAccountDeletion')
export const listAdminAccountDeletionRequestsCallable = httpsCallable(functions, 'listAdminAccountDeletionRequests')
export const moderateBusinessCallable = httpsCallable(functions, 'moderateBusiness')
export const getAdminBusinessReviewCallable = httpsCallable(functions, 'getAdminBusinessReview')
export const assignBusinessSubscriptionPlanCallable = httpsCallable(functions, 'assignBusinessSubscriptionPlan')
export const getPublicBusinessCallable = httpsCallable(functions, 'getPublicBusiness')
export const getOwnerSubscriptionStatusCallable = httpsCallable(functions, 'getOwnerSubscriptionStatus')
export const updateAccountRoleCallable = httpsCallable(functions, 'updateAccountRole')
export const recordBusinessInsightCallable = httpsCallable(functions, 'recordBusinessInsight')
export const getOwnerBusinessInsightsCallable = httpsCallable(functions, 'getOwnerBusinessInsights')
