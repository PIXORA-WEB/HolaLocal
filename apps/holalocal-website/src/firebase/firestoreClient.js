import { getFirestore } from 'firebase/firestore'
import { getFirebaseApp } from './config.js'

export const db = getFirestore(getFirebaseApp())
