import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { getFirebaseApp } from './config.js'
import {
  connectFirebaseEmulatorOnce,
  FIREBASE_EMULATOR_ENDPOINTS,
  shouldUseFirebaseEmulators,
} from './emulatorMode.js'

export const db = getFirestore(getFirebaseApp())
if (shouldUseFirebaseEmulators()) {
  const { host, port } = FIREBASE_EMULATOR_ENDPOINTS.firestore
  connectFirebaseEmulatorOnce(db, () => connectFirestoreEmulator(db, host, port))
}
