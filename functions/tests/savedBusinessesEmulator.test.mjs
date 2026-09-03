import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { deleteApp, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { validateSavedBusinessesCursor } from '@holalocal/firebase-contract'

const enabled = process.env.HOLALOCAL_CALLABLE_BOUNDARY === '1'
const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT
const expectedProjectId = 'demo-holalocal-functions'
const authHost = '127.0.0.1:9099'
const firestoreHost = '127.0.0.1:8080'
const functionsHost = '127.0.0.1:5001'
const callableUrl = `http://${functionsHost}/${expectedProjectId}/europe-west1/listSavedBusinesses`
const password = 'emulator-only-password-123'

const users = Object.freeze({
  customerA: Object.freeze({
    uid: 'saved-e2e-customer-a', email: 'saved-e2e-a@example.invalid', roles: ['customer'],
  }),
  customerB: Object.freeze({
    uid: 'saved-e2e-customer-b', email: 'saved-e2e-b@example.invalid', roles: ['customer'],
  }),
  business: Object.freeze({
    uid: 'saved-e2e-business-only', email: 'saved-e2e-business@example.invalid', roles: ['business'],
  }),
})

let app
let db
let tokens

const safeHiddenContact = Object.freeze({
  phone: '', phoneVisible: false,
  email: '', emailVisible: false,
  whatsappNumber: '', whatsappVisible: false,
  website: 'https://public.example', websiteVisible: true,
  preferredContactMethod: 'holalocal', allowCallbackRequests: false,
})

function eligibleBusiness(name, overrides = {}) {
  return {
    ownerId: 'saved-e2e-owner',
    managerIds: ['saved-e2e-owner'],
    name,
    description: `${name} public description`,
    tagline: `${name} public tagline`,
    primaryCategoryId: 'cleaning',
    categoryIds: ['cleaning'],
    serviceAreas: ['marbella'],
    languages: ['en'],
    primaryLanguage: 'en',
    location: { locality: 'Marbella', region: 'Málaga', countryCode: 'ES' },
    contact: {
      phone: '+34950000000', phoneVisible: false,
      email: 'private@example.invalid', emailVisible: false,
      whatsappNumber: '', whatsappVisible: false,
      website: 'https://public.example', websiteVisible: true,
      preferredContactMethod: 'holalocal', allowCallbackRequests: false,
    },
    status: 'active',
    verificationStatus: 'unverified',
    publishedAt: Timestamp.fromMillis(1_800_000_000_000),
    deletionRequestedAt: null,
    deletedAt: null,
    profileCompleted: true,
    ratingAverage: 0,
    ratingCount: 0,
    privateNote: 'must-not-cross-callable-boundary',
    ...overrides,
  }
}

async function createUser(identity) {
  await getAuth(app).createUser({
    uid: identity.uid,
    email: identity.email,
    emailVerified: true,
    password,
  })
  await db.doc(`users/${identity.uid}`).set({
    uid: identity.uid,
    email: identity.email,
    accountStatus: 'active',
    deletionRequestedAt: null,
    roles: identity.roles,
  })
  const response = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-only`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: identity.email, password, returnSecureToken: true }),
    },
  )
  const body = await response.json()
  assert.equal(response.ok, true, `Auth emulator rejected ${identity.uid}.`)
  assert.equal(typeof body.idToken, 'string')
  return body.idToken
}

async function invoke(data, token = null) {
  const response = await fetch(callableUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ data }),
  })
  return { status: response.status, body: await response.json() }
}

function assertCallableError(response, status) {
  assert.notEqual(response.status, 200)
  assert.equal(response.body?.error?.status, status)
  assert.equal(typeof response.body?.error?.message, 'string')
}

function assertSavedPage(result) {
  assert.deepEqual(Object.keys(result).sort(), ['items', 'nextCursor'])
  assert.equal(Array.isArray(result.items), true)
  assert.equal(validateSavedBusinessesCursor(result.nextCursor).valid, true)
  for (const item of result.items) {
    assert.deepEqual(
      Object.keys(item).sort(),
      ['available', 'business', 'businessId', 'savedAtMillis'],
    )
    assert.equal(typeof item.businessId, 'string')
    assert.equal(Number.isSafeInteger(item.savedAtMillis), true)
    assert.equal(typeof item.available, 'boolean')
    if (item.available) assert.equal(item.business?.businessId, item.businessId)
    else assert.equal(item.business, null)
  }
}

async function seedFixture() {
  tokens = Object.fromEntries(await Promise.all(
    Object.entries(users).map(async ([key, identity]) => [key, await createUser(identity)]),
  ))
  await Promise.all([
    db.doc('businesses/saved-e2e-eligible-alpha').set(eligibleBusiness('Alpha', {
      contact: safeHiddenContact,
    })),
    db.doc('businesses/saved-e2e-eligible-beta').set(eligibleBusiness('Beta', {
      contact: safeHiddenContact,
    })),
    db.doc('businesses/saved-e2e-unpublished').set(eligibleBusiness('Private old name', {
      status: 'draft', publishedAt: null,
    })),
    db.doc('businesses/saved-e2e-customer-b-only').set(eligibleBusiness('Customer B only', {
      contact: safeHiddenContact,
    })),
  ])
  const save = (uid, businessId, millis) => db.doc(`users/${uid}/savedBusinesses/${businessId}`).set({
    businessId,
    createdAt: Timestamp.fromMillis(millis),
  })
  await Promise.all([
    save(users.customerA.uid, 'saved-e2e-eligible-alpha', 4_000),
    save(users.customerA.uid, 'saved-e2e-eligible-beta', 3_000),
    save(users.customerA.uid, 'saved-e2e-unpublished', 2_000),
    save(users.customerA.uid, 'saved-e2e-missing', 1_000),
    save(users.customerB.uid, 'saved-e2e-customer-b-only', 5_000),
  ])
}

if (enabled) {
  before(async () => {
    assert.equal(projectId, expectedProjectId)
    assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, authHost)
    assert.equal(process.env.FIRESTORE_EMULATOR_HOST, firestoreHost)
    assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '', '')
    app = getApps().find((candidate) => candidate.name === 'saved-businesses-callable-emulator')
      ?? initializeApp({ projectId }, 'saved-businesses-callable-emulator')
    db = getFirestore(app)
    await seedFixture()
  })

  after(async () => {
    await deleteApp(app)
  })
}

test('real callable lists only the authenticated customer saved businesses', { skip: !enabled }, async (t) => {
  let firstPage

  await t.test('rejects unauthenticated and non-customer-capable actors', async () => {
    assertCallableError(await invoke({ pageSize: 2 }), 'UNAUTHENTICATED')
    assertCallableError(await invoke({ pageSize: 2 }, tokens.business), 'PERMISSION_DENIED')
  })

  await t.test('rejects invalid bounds and UID impersonation payloads', async () => {
    assertCallableError(await invoke({ pageSize: 0 }, tokens.customerA), 'INVALID_ARGUMENT')
    assertCallableError(await invoke({ pageSize: 2, userId: users.customerB.uid }, tokens.customerA), 'INVALID_ARGUMENT')
  })

  await t.test('returns the first stable page with safe public projections', async () => {
    const response = await invoke({ pageSize: 2 }, tokens.customerA)
    assert.equal(response.status, 200)
    firstPage = response.body.result
    assertSavedPage(firstPage)
    assert.deepEqual(
      firstPage.items.map(({ businessId }) => businessId),
      ['saved-e2e-eligible-alpha', 'saved-e2e-eligible-beta'],
    )
    assert.equal(firstPage.items.length, 2)
    assert.notEqual(firstPage.nextCursor, null)
    for (const { business } of firstPage.items) {
      assert.ok(business && typeof business === 'object', 'Expected an eligible business projection.')
      for (const privateField of ['ownerId', 'managerIds', 'privateNote']) {
        assert.equal(Object.hasOwn(business, privateField), false)
      }
      assert.equal(JSON.stringify(business).includes('private@example.invalid'), false)
      assert.equal(JSON.stringify(business).includes('must-not-cross-callable-boundary'), false)
    }
  })

  await t.test('cursor returns unavailable records once without duplicates', async () => {
    const response = await invoke({ pageSize: 2, cursor: firstPage.nextCursor }, tokens.customerA)
    assert.equal(response.status, 200)
    const secondPage = response.body.result
    assertSavedPage(secondPage)
    assert.deepEqual(
      secondPage.items.map(({ businessId }) => businessId),
      ['saved-e2e-unpublished', 'saved-e2e-missing'],
    )
    assert.deepEqual(secondPage.items.map(({ available }) => available), [false, false])
    assert.equal(secondPage.nextCursor, null)
    const ids = [...firstPage.items, ...secondPage.items].map(({ businessId }) => businessId)
    assert.equal(new Set(ids).size, ids.length)
    assert.equal(JSON.stringify(secondPage).includes('Private old name'), false)
  })

  await t.test('isolates Customer B records from Customer A', async () => {
    const response = await invoke({ pageSize: 10 }, tokens.customerB)
    assert.equal(response.status, 200)
    assertSavedPage(response.body.result)
    assert.deepEqual(
      response.body.result.items.map(({ businessId }) => businessId),
      ['saved-e2e-customer-b-only'],
    )
    const customerA = await invoke({ pageSize: 10 }, tokens.customerA)
    assert.equal(customerA.status, 200)
    assert.equal(
      customerA.body.result.items.some(({ businessId }) => businessId === 'saved-e2e-customer-b-only'),
      false,
    )
  })
})
