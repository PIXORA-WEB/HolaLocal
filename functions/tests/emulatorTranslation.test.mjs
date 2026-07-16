import test from 'node:test'
import assert from 'node:assert/strict'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const hasFirestoreEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)

test('emulator trigger writes safe backend translation failure without touching original text', {
  skip: hasFirestoreEmulator ? false : 'Firestore emulator is required.',
}, async () => {
  if (getApps().length === 0) initializeApp({ projectId: process.env.GCLOUD_PROJECT })
  const db = getFirestore()
  const suffix = Date.now().toString(36)
  const conversationId = `customer-${suffix}__business-${suffix}`
  const messageRef = db.doc(`conversations/${conversationId}/messages/message-${suffix}`)

  await Promise.all([
    db.doc(`users/customer-${suffix}`).set({
      uid: `customer-${suffix}`,
      roles: ['customer'],
      accountStatus: 'active',
      preferredLocale: 'en',
    }),
    db.doc(`users/owner-${suffix}`).set({
      uid: `owner-${suffix}`,
      roles: ['business'],
      accountStatus: 'active',
      preferredLocale: 'es',
    }),
    db.doc(`businesses/business-${suffix}`).set({
      ownerId: `owner-${suffix}`,
      managerIds: [`owner-${suffix}`],
      status: 'active',
    }),
  ])

  await db.doc(`conversations/${conversationId}`).set({
    businessId: `business-${suffix}`,
    customerId: `customer-${suffix}`,
    participantIds: [`customer-${suffix}`, `owner-${suffix}`],
    participantState: {
      [`customer-${suffix}`]: { lastReadAt: null, archivedAt: null, mutedUntil: null, deletedAt: null },
      [`owner-${suffix}`]: { lastReadAt: null, archivedAt: null, mutedUntil: null, deletedAt: null },
    },
    lastMessage: null,
    lastMessageAt: null,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  await messageRef.set({
    senderId: `customer-${suffix}`,
    type: 'text',
    text: 'Original message',
    attachment: null,
    moderationStatus: 'visible',
    editedAt: null,
    deletedAt: null,
    createdAt: new Date(),
  })

  const translated = await waitForTranslation(messageRef)
  assert.equal(translated.text, 'Original message')
  assert.equal(translated.translation.status, 'failed')
  assert.equal(translated.translation.reason, 'provider_unavailable')
  assert.equal(translated.translation.translatedText, null)
  assert.equal(JSON.stringify(translated.translation).includes('Translation provider is not configured'), false)
})

async function waitForTranslation(reference) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const snapshot = await reference.get()
    const data = snapshot.data()
    if (data?.translation?.status) return data
    await new Promise((resolve) => { setTimeout(resolve, 200) })
  }
  throw new Error('Timed out waiting for emulated translation trigger.')
}
