import { getFunctions, httpsCallable } from 'firebase/functions'
import { getFirebaseApp } from './config.js'

const functions = getFunctions(getFirebaseApp(), 'europe-west1')

export const ensureOwnerBusinessCallable = httpsCallable(functions, 'ensureOwnerBusiness')
export const listPublicBusinessesCallable = httpsCallable(functions, 'listPublicBusinesses')
export const sendMessageCallable = httpsCallable(functions, 'sendMessage')
export const moderateBusinessCallable = httpsCallable(functions, 'moderateBusiness')
export const updateAccountRoleCallable = httpsCallable(functions, 'updateAccountRole')
