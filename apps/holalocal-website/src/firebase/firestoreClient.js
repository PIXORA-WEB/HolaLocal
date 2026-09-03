import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { getFirebaseApp } from './config.js'
import {
  connectFirebaseEmulatorOnce,
  getFirebaseEmulatorEndpoint,
  shouldUseFirebaseEmulators,
} from './emulatorMode.js'

export const db = getFirestore(getFirebaseApp())
if (shouldUseFirebaseEmulators()) {
  const { host, port } = getFirebaseEmulatorEndpoint('firestore')
  connectFirebaseEmulatorOnce(db, () => connectFirestoreEmulator(db, host, port))
}
