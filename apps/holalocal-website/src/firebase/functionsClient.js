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
export const moderateBusinessCallable = httpsCallable(functions, 'moderateBusiness')
export const getAdminBusinessReviewCallable = httpsCallable(functions, 'getAdminBusinessReview')
export const updateAccountRoleCallable = httpsCallable(functions, 'updateAccountRole')
export const recordBusinessInsightCallable = httpsCallable(functions, 'recordBusinessInsight')
export const getOwnerBusinessInsightsCallable = httpsCallable(functions, 'getOwnerBusinessInsights')
