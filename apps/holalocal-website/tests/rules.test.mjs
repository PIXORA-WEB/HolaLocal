import { after, before, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { deleteObject, ref, uploadBytes } from 'firebase/storage'

const projectId = 'demo-holalocal-rules'
const activeContact = {
  phone: '', phoneVisible: false, email: '', emailVisible: false,
  whatsappNumber: '', whatsappVisible: false, website: '',
  preferredContactMethod: 'holalocal', allowCallbackRequests: false,
}
const users = {
  customer: { uid: 'customer', roles: ['customer'], accountStatus: 'active', deletionRequestedAt: null },
  owner: { uid: 'owner', roles: ['business'], accountStatus: 'active', deletionRequestedAt: null },
  manager: { uid: 'manager', roles: ['business'], accountStatus: 'active', deletionRequestedAt: null },
  unrelated: { uid: 'unrelated', roles: ['customer'], accountStatus: 'active', deletionRequestedAt: null },
  suspended: { uid: 'suspended', roles: ['customer'], accountStatus: 'suspended', deletionRequestedAt: null },
  deleted: { uid: 'deleted', roles: ['customer'], accountStatus: 'deleted', deletionRequestedAt: null },
}
let environment

async function seed() {
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore()
    await Promise.all(Object.entries(users).map(([id, user]) => setDoc(doc(database, 'users', id), user)))
    await setDoc(doc(database, 'businesses', 'active-business'), {
      ownerId: 'owner', managerIds: ['owner', 'manager'], status: 'active',
      verificationStatus: 'unverified', name: 'Active business', nameNormalized: 'active business', contact: activeContact,
    })
    await setDoc(doc(database, 'businesses', 'draft-business'), {
      ownerId: 'owner', managerIds: ['owner'], status: 'draft',
      verificationStatus: 'unverified', name: 'Draft business', nameNormalized: 'draft business', contact: activeContact,
    })
    await setDoc(doc(database, 'businesses', 'unsafe-active-business'), {
      ownerId: 'owner', managerIds: ['owner'], status: 'active',
      verificationStatus: 'unverified', name: 'Unsafe legacy business',
      contact: { ...activeContact, email: 'hidden@example.test', emailVisible: false },
    })
    await setDoc(doc(database, 'businessPrivate', 'active-business'), {
      ownerId: 'owner', managerIds: ['owner', 'manager'], contact: { ...activeContact, email: 'private@example.test' },
    })
  })
}

function conversation() {
  return {
    businessId: 'active-business', customerId: 'customer', participantIds: ['customer', 'owner'],
    participantState: {
      customer: { lastReadAt: null, archivedAt: null, mutedUntil: null, deletedAt: null },
      owner: { lastReadAt: null, archivedAt: null, mutedUntil: null, deletedAt: null },
    },
    lastMessage: null, lastMessageAt: null, status: 'active',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }
}

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile('../../firestore.rules', 'utf8') },
    storage: { rules: await readFile('../../storage.rules', 'utf8') },
  })
})
beforeEach(async () => { await environment.clearFirestore(); await seed() })
after(async () => { await environment.cleanup() })

describe('users and account lifecycle', () => {
  test('owner reads own profile and unrelated users cannot', async () => {
    await assertSucceeds(getDoc(doc(environment.authenticatedContext('customer').firestore(), 'users', 'customer')))
    await assertFails(getDoc(doc(environment.authenticatedContext('unrelated').firestore(), 'users', 'customer')))
  })
  test('users cannot grant themselves privileged roles', async () => {
    await assertFails(updateDoc(doc(environment.authenticatedContext('customer').firestore(), 'users', 'customer'), { roles: ['customer', 'admin'] }))
  })
  test('blocked accounts cannot perform protected writes', async () => {
    for (const id of ['suspended', 'deleted']) {
      await assertFails(setDoc(doc(environment.authenticatedContext(id).firestore(), 'reports', `report-${id}`), { reporterId: id }))
    }
  })
})

describe('business documents', () => {
  test('only safe active businesses are public', async () => {
    await assertSucceeds(getDoc(doc(environment.unauthenticatedContext().firestore(), 'businesses', 'active-business')))
    await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), 'businesses', 'draft-business')))
    await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), 'businesses', 'unsafe-active-business')))
  })
  test('owner and manager can edit while unrelated users cannot', async () => {
    await assertSucceeds(updateDoc(doc(environment.authenticatedContext('owner').firestore(), 'businesses', 'active-business'), { tagline: 'Owner edit' }))
    await assertSucceeds(updateDoc(doc(environment.authenticatedContext('manager').firestore(), 'businesses', 'active-business'), { tagline: 'Manager edit' }))
    await assertFails(updateDoc(doc(environment.authenticatedContext('unrelated').firestore(), 'businesses', 'active-business'), { tagline: 'No access' }))
  })
  test('businessPrivate is restricted to managers', async () => {
    await assertSucceeds(getDoc(doc(environment.authenticatedContext('owner').firestore(), 'businessPrivate', 'active-business')))
    await assertFails(getDoc(doc(environment.authenticatedContext('unrelated').firestore(), 'businessPrivate', 'active-business')))
  })
})

describe('conversations and messages', () => {
  test('valid customer-to-business conversation succeeds', async () => {
    const database = environment.authenticatedContext('customer').firestore()
    await assertSucceeds(setDoc(doc(database, 'conversations', 'valid'), conversation()))
    await assertSucceeds(setDoc(doc(database, 'conversations/valid/messages', 'message'), {
      senderId: 'customer', type: 'text', text: 'Hello', attachment: null,
      moderationStatus: 'visible', editedAt: null, deletedAt: null, createdAt: serverTimestamp(),
    }))
  })
  test('arbitrary participant injection is rejected', async () => {
    await assertFails(setDoc(doc(environment.authenticatedContext('customer').firestore(), 'conversations', 'injected'), {
      ...conversation(), participantIds: ['customer', 'owner', 'unrelated'],
    }))
  })
  test('non-members cannot read or write and protected fields cannot change', async () => {
    await assertSucceeds(setDoc(doc(environment.authenticatedContext('customer').firestore(), 'conversations', 'protected'), conversation()))
    const unrelated = environment.authenticatedContext('unrelated').firestore()
    await assertFails(getDoc(doc(unrelated, 'conversations', 'protected')))
    await assertFails(setDoc(doc(unrelated, 'conversations/protected/messages', 'message'), {
      senderId: 'unrelated', type: 'text', text: 'No access', attachment: null,
      moderationStatus: 'visible', editedAt: null, deletedAt: null, createdAt: serverTimestamp(),
    }))
    await assertFails(updateDoc(doc(environment.authenticatedContext('customer').firestore(), 'conversations', 'protected'), { businessId: 'draft-business' }))
  })
})

describe('storage', () => {
  const image = new Uint8Array([137, 80, 78, 71])
  test('manager image upload succeeds and unrelated upload fails', async () => {
    await assertSucceeds(uploadBytes(ref(environment.authenticatedContext('manager').storage(), 'businesses/active-business/photos/valid.png'), image, { contentType: 'image/png' }))
    await assertFails(uploadBytes(ref(environment.authenticatedContext('unrelated').storage(), 'businesses/active-business/photos/invalid.png'), image, { contentType: 'image/png' }))
  })
  test('invalid type and oversized images fail', async () => {
    const storage = environment.authenticatedContext('owner').storage()
    await assertFails(uploadBytes(ref(storage, 'businesses/active-business/photos/file.txt'), image, { contentType: 'text/plain' }))
    await assertFails(uploadBytes(ref(storage, 'businesses/active-business/photos/large.png'), new Uint8Array(5 * 1024 * 1024), { contentType: 'image/png' }))
  })
  test('suspended accounts cannot upload files', async () => {
    await assertFails(uploadBytes(ref(environment.authenticatedContext('suspended').storage(), 'users/suspended/profile/photo.png'), image, { contentType: 'image/png' }))
  })
  test('unrelated users cannot delete business media', async () => {
    const path = 'businesses/active-business/photos/delete.png'
    await assertSucceeds(uploadBytes(ref(environment.authenticatedContext('owner').storage(), path), image, { contentType: 'image/png' }))
    await assertFails(deleteObject(ref(environment.authenticatedContext('unrelated').storage(), path)))
  })
})

test('test environment was initialized', () => assert.ok(environment))
