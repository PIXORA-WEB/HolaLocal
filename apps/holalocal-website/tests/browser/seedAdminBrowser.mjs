import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import {
  TEST_BUSINESS_ID,
  TEST_PASSWORD,
  TEST_PROJECT_ID,
  TEST_USERS,
} from './fixtures.js'

if (process.env.GCLOUD_PROJECT !== TEST_PROJECT_ID) {
  throw new Error(`Refusing to seed unexpected project ${process.env.GCLOUD_PROJECT ?? '(missing)'}.`)
}
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST || !process.env.STORAGE_EMULATOR_HOST) {
  throw new Error('All Firebase emulator hosts are required before browser fixture seeding.')
}
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error('Browser fixture seeding refuses application credentials.')
}

const storageBucket = `${TEST_PROJECT_ID}.appspot.com`
const app = getApps()[0] ?? initializeApp({ projectId: TEST_PROJECT_ID, storageBucket })
const auth = getAuth(app)
const db = getFirestore(app)
const bucket = getStorage(app).bucket(storageBucket)

await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${TEST_PROJECT_ID}/accounts`, {
  method: 'DELETE',
})
await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${TEST_PROJECT_ID}/databases/(default)/documents`, {
  method: 'DELETE',
})
await fetch(`http://${process.env.STORAGE_EMULATOR_HOST}/emulator/v1/projects/${TEST_PROJECT_ID}/buckets/${storageBucket}`, {
  method: 'DELETE',
}).catch(() => undefined)

for (const user of Object.values(TEST_USERS)) {
  await auth.createUser({
    uid: user.uid,
    email: user.email,
    emailVerified: true,
    password: TEST_PASSWORD,
    displayName: user.displayName,
  })
  if (Object.keys(user.claims).length > 0) await auth.setCustomUserClaims(user.uid, user.claims)
  await db.doc(`users/${user.uid}`).set({
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    displayNameNormalized: user.displayName.toLowerCase(),
    firstName: user.displayName.split(' ')[0],
    lastName: user.displayName.split(' ').slice(1).join(' ') || 'User',
    photoURL: null,
    profilePhoto: null,
    preferredLocale: user.preferredLocale,
    city: 'Marbella',
    country: 'Spain',
    accountType: user.uid === TEST_USERS.owner.uid ? 'business' : 'customer',
    roles: user.uid === TEST_USERS.owner.uid ? ['business'] : ['customer'],
    accountStatus: 'active',
    profileCompleted: true,
    onboardingCompleted: true,
    businessProfileRequired: false,
    businessProfileCompleted: user.uid === TEST_USERS.owner.uid,
    businessId: user.uid === TEST_USERS.owner.uid ? TEST_BUSINESS_ID : null,
    termsAccepted: true,
    termsVersion: '1.0',
    privacyAccepted: true,
    privacyVersion: '1.0',
    deletionRequestedAt: null,
    deletionScheduledFor: null,
    anonymizedAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastActiveAt: FieldValue.serverTimestamp(),
    termsAcceptedAt: FieldValue.serverTimestamp(),
    privacyAcceptedAt: FieldValue.serverTimestamp(),
  })
}

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)
const token = 'browser-smoke-download-token'
const logoPath = `businesses/${TEST_BUSINESS_ID}/logos/logo.png`
const galleryPath = `businesses/${TEST_BUSINESS_ID}/gallery/gallery.png`
for (const path of [logoPath, galleryPath]) {
  await bucket.file(path).save(onePixelPng, {
    contentType: 'image/png',
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  })
}
const mediaUrl = (path) => (
  `http://127.0.0.1:9199/v0/b/${storageBucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}`
)
const submittedAt = Timestamp.fromDate(new Date('2026-07-01T12:00:00.000Z'))
await db.doc(`businesses/${TEST_BUSINESS_ID}`).set({
  ownerId: TEST_USERS.owner.uid,
  managerIds: [TEST_USERS.owner.uid],
  name: 'Browser Smoke Cleaning',
  nameNormalized: 'browser smoke cleaning',
  slug: 'browser-smoke-cleaning',
  tagline: 'Reliable local cleaning',
  description: 'Complete and reliable cleaning services for local homes and businesses.',
  primaryCategoryId: 'cleaning',
  categoryIds: ['cleaning'],
  serviceAreas: ['marbella'],
  serviceRadiusKm: 20,
  location: { locality: 'Marbella', region: 'Málaga', countryCode: 'ES' },
  contact: {
    phone: '', phoneVisible: false, email: '', emailVisible: false,
    whatsappNumber: '', whatsappVisible: false, website: '', websiteVisible: false,
    preferredContactMethod: 'holalocal', allowCallbackRequests: false,
  },
  languages: ['en', 'es'],
  primaryLanguage: 'en',
  profilePhoto: {
    storagePath: logoPath, downloadUrl: mediaUrl(logoPath), contentType: 'image/png',
    originalName: 'logo.png', size: onePixelPng.length,
  },
  galleryImages: [{
    storagePath: galleryPath, downloadUrl: mediaUrl(galleryPath), contentType: 'image/png',
    originalName: 'gallery.png', size: onePixelPng.length,
  }],
  galleryImageURLs: [mediaUrl(galleryPath)],
  galleryCount: 1,
  ratingAverage: 0,
  ratingCount: 0,
  status: 'pending_review',
  verificationStatus: 'unverified',
  verifiedAt: null,
  subscription: { tier: 'free', status: 'none', provider: null, currentPeriodEnd: null },
  profileCompleted: true,
  publishedAt: null,
  deletionRequestedAt: null,
  deletedAt: null,
  createdAt: submittedAt,
  submittedAt,
  updatedAt: submittedAt,
})
await db.doc(`businessPrivate/${TEST_BUSINESS_ID}`).set({
  ownerId: TEST_USERS.owner.uid,
  managerIds: [TEST_USERS.owner.uid],
  contact: { email: 'private.owner@example.invalid', phone: '+34950000000' },
  currentRejection: null,
  createdAt: submittedAt,
  updatedAt: submittedAt,
})

console.log(`Seeded isolated browser fixtures for ${TEST_PROJECT_ID}.`)
