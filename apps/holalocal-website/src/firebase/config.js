// Owns the website's single Firebase App instance. Feature clients depend on this
// module; this module deliberately has no dependency on Auth, Firestore or Storage.
import { getApp, getApps, initializeApp } from 'firebase/app'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const requiredEnvironmentVariables = [
  ['VITE_FIREBASE_API_KEY', firebaseConfig.apiKey],
  ['VITE_FIREBASE_AUTH_DOMAIN', firebaseConfig.authDomain],
  ['VITE_FIREBASE_PROJECT_ID', firebaseConfig.projectId],
  ['VITE_FIREBASE_STORAGE_BUCKET', firebaseConfig.storageBucket],
  ['VITE_FIREBASE_MESSAGING_SENDER_ID', firebaseConfig.messagingSenderId],
  ['VITE_FIREBASE_APP_ID', firebaseConfig.appId],
]

let firebaseApp

export function validateFirebaseConfiguration() {
  const missingEnvironmentVariables = requiredEnvironmentVariables
    .filter(([, value]) => typeof value !== 'string' || value.trim() === '')
    .map(([name]) => name)

  if (missingEnvironmentVariables.length > 0) {
    throw new Error(
      `Firebase configuration is incomplete. Missing required environment variable${missingEnvironmentVariables.length === 1 ? '' : 's'}: ${missingEnvironmentVariables.join(', ')}.`,
    )
  }
}

export function getFirebaseApp() {
  if (firebaseApp) return firebaseApp

  validateFirebaseConfiguration()
  firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
  return firebaseApp
}
