import { getFirestore } from 'firebase/firestore'
import { app } from './config.js'

export const db = getFirestore(app)
