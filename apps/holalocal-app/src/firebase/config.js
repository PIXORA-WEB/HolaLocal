// Creates the shared Firebase service instances from Vite environment variables.
// Keep credentials in a local .env file and never hard-code them in source files.
import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

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
  ['VITE_FIREBASE_MEASUREMENT_ID', firebaseConfig.measurementId],
]

const missingEnvironmentVariables = requiredEnvironmentVariables
  .filter(([, value]) => typeof value !== 'string' || value.trim() === '')
  .map(([name]) => name)

if (missingEnvironmentVariables.length > 0) {
  throw new Error(
    `Firebase configuration is incomplete. Missing required Vite environment variables: ${missingEnvironmentVariables.join(', ')}. Add them to the appropriate .env file or deployment environment.`,
  )
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)
const storage = getStorage(app)

// Analytics is unavailable during server/build contexts and in some browsers.
// The live export remains null unless Firebase confirms browser support.
let analytics = null

if (typeof window !== 'undefined') {
  void isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app)
      }
    })
    .catch(() => {
      analytics = null
    })
}

export { analytics, app, auth, db, storage }
