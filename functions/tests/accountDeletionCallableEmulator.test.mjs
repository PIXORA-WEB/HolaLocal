import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { deleteApp, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import {
  ACCOUNT_DELETION_FINALIZATION_CHECKPOINTS,
  ACCOUNT_DELETION_REQUEST_STATES,
  hasOnlyAccountDeletionWorkflowFields,
  isSanitizedAccountDeletionCleanupCounts,
  isTerminalTranslationStatus,
} from '@holalocal/firebase-contract'
import {
  canStartNewAccountDeletionRequestCycle,
  canTransitionAccountDeletionState,
  isFreshAccountDeletionRequestCycle,
  projectAccountDeletionRequest,
} from '../../shared/firebase-contract/index.js'

const enabled = process.env.HOLALOCAL_CALLABLE_BOUNDARY === '1'
const projectId = 'demo-holalocal-functions'
const storageBucket = `${projectId}.appspot.com`
const authHost = '127.0.0.1:9099'
const firestoreHost = '127.0.0.1:8080'
const functionsHost = '127.0.0.1:5001'
const storageHost = 'http://127.0.0.1:9199'
const functionsOrigin = `http://${functionsHost}/${projectId}/europe-west1`
const password = 'emulator-only-deletion-password-123'
const requestTimeoutMs = 60_000
const translationPollIntervalMs = 200
const translationDeadlineMs = 10_000

const actors = Object.freeze({
  target: Object.freeze({
    uid: 'deletion-e2e-target-customer',
    email: 'deletion-e2e-target@example.invalid',
    roles: ['customer'],
  }),
  admin: Object.freeze({
    uid: 'deletion-e2e-administrator',
    email: 'deletion-e2e-admin@example.invalid',
    roles: ['customer'],
    claims: Object.freeze({ admin: true }),
  }),
  control: Object.freeze({
    uid: 'deletion-e2e-control-user',
    email: 'deletion-e2e-control@example.invalid',
    roles: ['customer'],
  }),
})

const cancellationCycleActor = Object.freeze({
  uid: 'deletion-e2e-cancellation-cycle-customer',
  email: 'deletion-e2e-cancellation-cycle@example.invalid',
  roles: ['customer'],
})

const freshRequestFieldNames = Object.freeze([
  'cancelledAt', 'requestVersion', 'requestedAt', 'requestedBy', 'state', 'uid', 'updatedAt',
])

const staleCycleFieldNames = Object.freeze([
  'finalizationStartedAt', 'finalizedBy', 'completedAt', 'lastCompletedStep', 'failureCode',
  'retryCount', 'leaseId', 'leaseExpiresAt', 'cleanupCounts', 'retainedConsentEvidence',
])

const paths = Object.freeze({
  business: 'businesses/deletion-e2e-managed-business',
  businessPrivate: 'businessPrivate/deletion-e2e-managed-business',
  conversation: 'conversations/deletion-e2e-conversation',
  message: 'conversations/deletion-e2e-conversation/messages/deletion-e2e-message',
  controlSaved: `users/${actors.control.uid}/savedBusinesses/deletion-e2e-control-saved`,
  targetSaved: `users/${actors.target.uid}/savedBusinesses/deletion-e2e-target-saved`,
  targetMediaSession: `mediaUploadSessions/profile_${actors.target.uid}`,
  report: 'reports/deletion-e2e-report-sentinel',
  subscription: 'businessSubscriptions/deletion-e2e-managed-business',
})

const storagePaths = Object.freeze({
  target: `users/${actors.target.uid}/profile/avatar`,
  control: `users/${actors.control.uid}/profile/avatar`,
  business: 'businesses/deletion-e2e-managed-business/logos/logo',
})

let app
let auth
let db
let bucket
let tokens

function profile(actor, overrides = {}) {
  const acceptedAt = Timestamp.fromMillis(1_800_000_000_000)
  return {
    uid: actor.uid,
    email: actor.email,
    emailVerified: true,
    displayName: `Synthetic ${actor.uid}`,
    roles: actor.roles,
    businessId: null,
    accountStatus: 'active',
    deletionRequestedAt: null,
    deletionScheduledFor: null,
    termsAccepted: true,
    termsAcceptedAt: acceptedAt,
    termsVersion: '1.0',
    privacyAccepted: true,
    privacyAcceptedAt: acceptedAt,
    privacyVersion: '1.0',
    marker: `${actor.uid}-unchanged`,
    ...overrides,
  }
}

async function createActor(actor) {
  await auth.createUser({
    uid: actor.uid,
    email: actor.email,
    emailVerified: true,
    password,
  })
  if (actor.claims) await auth.setCustomUserClaims(actor.uid, actor.claims)
  const response = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-only`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: actor.email, password, returnSecureToken: true }),
      signal: AbortSignal.timeout(requestTimeoutMs),
    },
  )
  const body = await response.json()
  assert.equal(response.ok, true, `Auth emulator rejected ${actor.uid}.`)
  assert.equal(typeof body.idToken, 'string')
  return body.idToken
}

async function invokeCallable(name, data, token = null) {
  const response = await fetch(`${functionsOrigin}/${name}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ data }),
    signal: AbortSignal.timeout(requestTimeoutMs),
  })
  return { status: response.status, body: await response.json() }
}

function assertCallableError(response, status) {
  assert.notEqual(response.status, 200)
  assert.equal(response.body?.error?.status, status)
  assert.equal(typeof response.body?.error?.message, 'string')
}

async function storageObjectExists(path) {
  const [exists] = await bucket.file(path).exists()
  return exists
}

async function waitForTerminalMessageTranslation(reference) {
  const deadline = Date.now() + translationDeadlineMs
  let lastObserved = { status: null, reason: null }

  while (Date.now() < deadline) {
    const snapshot = await reference.get()
    if (!snapshot.exists) throw new Error('Message disappeared while waiting for its translation trigger.')

    const data = snapshot.data()
    lastObserved = {
      status: data?.translation?.status ?? null,
      reason: data?.translation?.reason ?? null,
    }
    if (lastObserved.status === 'not_required' && lastObserved.reason === 'malformed_message') {
      return data
    }
    if (isTerminalTranslationStatus(lastObserved.status)) {
      throw new Error(`Message translation reached an unexpected terminal state: ${JSON.stringify(lastObserved)}`)
    }

    await new Promise((resolve) => { setTimeout(resolve, translationPollIntervalMs) })
  }

  throw new Error(`Timed out waiting for message translation: ${JSON.stringify(lastObserved)}`)
}

async function seedFixture() {
  tokens = Object.fromEntries(await Promise.all(
    Object.entries(actors).map(async ([name, actor]) => [name, await createActor(actor)]),
  ))

  const targetProfile = profile(actors.target, { privateContact: 'must-not-survive' })
  const controlProfile = profile(actors.control)
  const business = {
    ownerId: actors.control.uid,
    managerIds: [actors.control.uid, actors.target.uid],
    name: 'Deletion E2E managed business',
    status: 'active',
    marker: 'public-business-preserved',
  }
  const businessPrivate = {
    ownerId: actors.control.uid,
    managerIds: [actors.control.uid, actors.target.uid],
    privateMarker: 'private-business-preserved',
  }
  const conversation = {
    businessId: 'deletion-e2e-managed-business',
    customerId: actors.target.uid,
    participantIds: [actors.target.uid, actors.control.uid],
    status: 'active',
    participantTombstones: {},
    marker: 'conversation-preserved',
  }
  const message = {
    senderId: actors.target.uid,
    text: 'Synthetic message retained for deletion E2E.',
    marker: 'message-preserved',
  }
  const report = {
    reporterId: actors.target.uid,
    status: 'open',
    marker: 'report-preserved',
  }
  const subscription = {
    businessId: 'deletion-e2e-managed-business',
    planId: 'free',
    marker: 'subscription-preserved',
  }

  await Promise.all([
    db.doc(`users/${actors.target.uid}`).set(targetProfile),
    db.doc(`users/${actors.control.uid}`).set(controlProfile),
    db.doc(paths.business).set(business),
    db.doc(paths.businessPrivate).set(businessPrivate),
    db.doc(paths.conversation).set(conversation),
    db.doc(paths.message).set(message),
    db.doc(paths.targetSaved).set({
      businessId: 'deletion-e2e-target-saved',
      createdAt: Timestamp.fromMillis(2_000),
    }),
    db.doc(paths.controlSaved).set({
      businessId: 'deletion-e2e-control-saved',
      createdAt: Timestamp.fromMillis(1_000),
    }),
    db.doc(paths.targetMediaSession).set({ uid: actors.target.uid, marker: 'session-delete' }),
    db.doc(paths.report).set(report),
    db.doc(paths.subscription).set(subscription),
    ...Object.values(storagePaths).map((path) => bucket.file(path).save(
      Buffer.from(`synthetic:${path}`),
      { contentType: 'application/octet-stream' },
    )),
  ])

  return {
    business,
    businessPrivate,
    controlProfile,
    conversation,
    message,
    report,
    subscription,
    targetProfile,
  }
}

if (enabled) {
  before(async () => {
    assert.equal(process.env.GCLOUD_PROJECT, projectId)
    assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, authHost)
    assert.equal(process.env.FIRESTORE_EMULATOR_HOST, firestoreHost)
    assert.equal(process.env.FIREBASE_STORAGE_EMULATOR_HOST, '127.0.0.1:9199')
    assert.equal(process.env.STORAGE_EMULATOR_HOST, storageHost)
    assert.deepEqual(JSON.parse(process.env.FIREBASE_CONFIG), { projectId, storageBucket })
    app = getApps().find((candidate) => candidate.name === 'account-deletion-callable-emulator')
      ?? initializeApp({ projectId, storageBucket }, 'account-deletion-callable-emulator')
    auth = getAuth(app)
    db = getFirestore(app)
    bucket = getStorage(app).bucket(storageBucket)
  })

  after(async () => {
    await deleteApp(app)
  })
}

test('real callable completes customer account deletion across Firestore Storage and Auth', { skip: !enabled }, async (t) => {
  const fixture = await seedFixture()
  let preDeletionMessageSnapshot
  let requestedVersion
  let completedVersion

  await t.test('fixture exists before the deletion request', async () => {
    for (const path of [
      `users/${actors.target.uid}`, `users/${actors.control.uid}`, paths.business,
      paths.businessPrivate, paths.conversation, paths.message, paths.targetSaved,
      paths.controlSaved, paths.targetMediaSession, paths.report, paths.subscription,
    ]) {
      assert.equal((await db.doc(path).get()).exists, true, `Missing fixture document ${path}.`)
    }
    for (const path of Object.values(storagePaths)) {
      assert.equal(await storageObjectExists(path), true, `Missing fixture object ${path}.`)
    }
    await assert.doesNotReject(() => auth.getUser(actors.target.uid))
    await assert.doesNotReject(() => auth.getUser(actors.admin.uid))
    await assert.doesNotReject(() => auth.getUser(actors.control.uid))

    preDeletionMessageSnapshot = await waitForTerminalMessageTranslation(db.doc(paths.message))
    assert.equal(preDeletionMessageSnapshot.senderId, fixture.message.senderId)
    assert.equal(preDeletionMessageSnapshot.text, fixture.message.text)
    assert.equal(preDeletionMessageSnapshot.marker, fixture.message.marker)
    assert.deepEqual(Object.keys(preDeletionMessageSnapshot.translation).sort(), [
      'attemptId', 'processingLeaseUntil', 'processingStartedAt', 'reason', 'sourceLanguage',
      'status', 'targetLanguage', 'translatedText', 'updatedAt',
    ])
    assert.equal(preDeletionMessageSnapshot.translation.status, 'not_required')
    assert.equal(preDeletionMessageSnapshot.translation.reason, 'malformed_message')
    assert.equal(preDeletionMessageSnapshot.translation.sourceLanguage, null)
    assert.equal(preDeletionMessageSnapshot.translation.targetLanguage, null)
    assert.equal(preDeletionMessageSnapshot.translation.translatedText, null)
    assert.equal(preDeletionMessageSnapshot.translation.processingStartedAt, null)
    assert.equal(preDeletionMessageSnapshot.translation.processingLeaseUntil, null)
    assert.equal(preDeletionMessageSnapshot.translation.attemptId, null)
    assert.equal(preDeletionMessageSnapshot.translation.updatedAt instanceof Timestamp, true)
  })

  await t.test('verified recently authenticated customer requests deletion idempotently', async () => {
    const response = await invokeCallable('requestAccountDeletion', {}, tokens.target)
    assert.equal(response.status, 200)
    assert.deepEqual(Object.keys(response.body.result).sort(), ['blocked', 'idempotent', 'ok', 'request'])
    assert.equal(response.body.result.ok, true)
    assert.equal(response.body.result.blocked, false)
    assert.equal(response.body.result.idempotent, false)
    assert.equal(response.body.result.request.state, 'requested')
    assert.equal(ACCOUNT_DELETION_REQUEST_STATES.includes(response.body.result.request.state), true)
    requestedVersion = response.body.result.request.requestVersion
    assert.equal(Number.isSafeInteger(requestedVersion), true)

    const [requestSnapshot, userSnapshot] = await Promise.all([
      db.doc(`accountDeletionRequests/${actors.target.uid}`).get(),
      db.doc(`users/${actors.target.uid}`).get(),
    ])
    assert.equal(requestSnapshot.data().state, 'requested')
    assert.equal(requestSnapshot.data().requestVersion, requestedVersion)
    assert.equal(userSnapshot.data().deletionRequestedAt instanceof Timestamp, true)
    assert.equal(userSnapshot.data().termsAccepted, true)
    assert.equal(userSnapshot.data().privacyAccepted, true)

    const duplicate = await invokeCallable('requestAccountDeletion', {}, tokens.target)
    assert.equal(duplicate.status, 200)
    assert.equal(duplicate.body.result.idempotent, true)
    assert.equal(duplicate.body.result.request.requestVersion, requestedVersion)
    const afterDuplicate = (await db.doc(`accountDeletionRequests/${actors.target.uid}`).get()).data()
    assert.equal(afterDuplicate.state, 'requested')
    assert.equal(afterDuplicate.requestVersion, requestedVersion)
  })

  await t.test('admin queue rejects customers and returns a safe admin projection', async () => {
    assertCallableError(
      await invokeCallable('listAdminAccountDeletionRequests', {}, tokens.control),
      'PERMISSION_DENIED',
    )
    const response = await invokeCallable('listAdminAccountDeletionRequests', {}, tokens.admin)
    assert.equal(response.status, 200)
    const result = response.body.result
    assert.deepEqual(
      Object.keys(result).sort(),
      ['hasMore', 'historyHasMore', 'operationalHasMore', 'requests'],
    )
    const request = result.requests.find(({ uid }) => uid === actors.target.uid)
    assert.ok(request)
    assert.deepEqual(Object.keys(request), [
      'uid', 'state', 'requestedAt', 'updatedAt', 'requestVersion', 'lastCompletedStep',
      'failureCode', 'cleanupCounts', 'canFinalize', 'actionReason',
    ])
    assert.equal(request.state, 'requested')
    assert.equal(request.requestVersion, requestedVersion)
    assert.equal(request.canFinalize, true)
    assert.equal(request.actionReason, 'requested')
    for (const privateValue of [actors.target.email, fixture.targetProfile.displayName, 'must-not-survive']) {
      assert.equal(JSON.stringify(request).includes(privateValue), false)
    }
  })

  await t.test('non-admin finalization is rejected before cleanup', async () => {
    assertCallableError(await invokeCallable('finalizeAccountDeletion', {
      uid: actors.target.uid,
      expectedRequestVersion: requestedVersion,
    }, tokens.control), 'PERMISSION_DENIED')
    assert.equal((await db.doc(`users/${actors.target.uid}`).get()).exists, true)
    assert.equal((await db.doc(paths.targetSaved).get()).exists, true)
    assert.equal(await storageObjectExists(storagePaths.target), true)
    assert.equal((await db.doc(`accountDeletionRequests/${actors.target.uid}`).get()).data().state, 'requested')
  })

  await t.test('administrator finalizes through the real callable endpoint', async () => {
    const response = await invokeCallable('finalizeAccountDeletion', {
      uid: actors.target.uid,
      expectedRequestVersion: requestedVersion,
    }, tokens.admin)
    assert.equal(response.status, 200)
    const result = response.body.result
    assert.equal(result.state, 'completed')
    assert.equal(result.lastCompletedStep, 'completed')
    assert.equal(result.failureCode, null)
    assert.equal(result.blockerCode, null)
    assert.equal(result.idempotent, false)
    assert.equal(isSanitizedAccountDeletionCleanupCounts(result.cleanupCounts), true)
    assert.deepEqual(result.cleanupCounts, {
      attempted: 1,
      deleted: 1,
      alreadyMissing: 0,
      failed: 0,
      savedBusinessesDeleted: 1,
    })
    completedVersion = result.requestVersion
    assert.equal(Number.isSafeInteger(completedVersion), true)
    assert.ok(completedVersion > requestedVersion)
  })

  await t.test('completed state retains only workflow and minimal consent evidence', async () => {
    const request = (await db.doc(`accountDeletionRequests/${actors.target.uid}`).get()).data()
    assert.equal(request.state, 'completed')
    assert.equal(request.lastCompletedStep, ACCOUNT_DELETION_FINALIZATION_CHECKPOINTS.at(-1))
    assert.equal(request.requestVersion, completedVersion)
    assert.equal(request.leaseId, null)
    assert.equal(request.leaseExpiresAt, null)
    assert.deepEqual(request.cleanupCounts, {
      attempted: 1,
      deleted: 1,
      alreadyMissing: 0,
      failed: 0,
      savedBusinessesDeleted: 1,
    })
    assert.deepEqual(Object.keys(request.retainedConsentEvidence).sort(), [
      'privacyAcceptedAt', 'privacyVersion', 'termsAcceptedAt', 'termsVersion',
    ])
    assert.equal(hasOnlyAccountDeletionWorkflowFields(request), true)
    for (const privateValue of [actors.target.email, fixture.targetProfile.displayName, 'must-not-survive']) {
      assert.equal(JSON.stringify(request).includes(privateValue), false)
    }
  })

  await t.test('Firestore cleanup and preservation match the production contract', async () => {
    assert.equal((await db.doc(`users/${actors.target.uid}`).get()).exists, false)
    assert.equal((await db.doc(paths.targetSaved).get()).exists, false)
    assert.equal((await db.doc(paths.targetMediaSession).get()).exists, false)

    const business = (await db.doc(paths.business).get()).data()
    assert.deepEqual(business.managerIds, [actors.control.uid])
    assert.equal(business.ownerId, fixture.business.ownerId)
    assert.equal(business.name, fixture.business.name)
    assert.equal(business.status, fixture.business.status)
    assert.equal(business.marker, fixture.business.marker)
    const businessPrivate = (await db.doc(paths.businessPrivate).get()).data()
    assert.deepEqual(businessPrivate.managerIds, [actors.control.uid])
    assert.equal(businessPrivate.ownerId, fixture.businessPrivate.ownerId)
    assert.equal(businessPrivate.privateMarker, fixture.businessPrivate.privateMarker)

    const conversation = (await db.doc(paths.conversation).get()).data()
    assert.equal(conversation.status, 'participant_deleted')
    assert.deepEqual(conversation.participantIds, fixture.conversation.participantIds)
    assert.equal(conversation.marker, fixture.conversation.marker)
    assert.deepEqual(Object.keys(conversation.participantTombstones), [actors.target.uid])
    assert.equal(conversation.participantTombstones[actors.target.uid].type, 'deleted_user')
    assert.equal(conversation.participantTombstones[actors.target.uid].deletedAt instanceof Timestamp, true)
    const messageSnapshot = await db.doc(paths.message).get()
    assert.equal(messageSnapshot.exists, true)
    assert.deepEqual(messageSnapshot.data(), preDeletionMessageSnapshot)

    assert.deepEqual((await db.doc(`users/${actors.control.uid}`).get()).data(), fixture.controlProfile)
    assert.equal((await db.doc(paths.controlSaved).get()).exists, true)
    assert.deepEqual((await db.doc(paths.report).get()).data(), fixture.report)
    assert.deepEqual((await db.doc(paths.subscription).get()).data(), fixture.subscription)
  })

  await t.test('Storage and Auth cleanup are target-scoped', async () => {
    assert.equal(await storageObjectExists(storagePaths.target), false)
    assert.equal(await storageObjectExists(storagePaths.control), true)
    assert.equal(await storageObjectExists(storagePaths.business), true)
    await assert.rejects(() => auth.getUser(actors.target.uid), (error) => error.code === 'auth/user-not-found')
    await assert.doesNotReject(() => auth.getUser(actors.admin.uid))
    await assert.doesNotReject(() => auth.getUser(actors.control.uid))

    const signIn = await fetch(
      `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-only`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: actors.target.email, password, returnSecureToken: true }),
        signal: AbortSignal.timeout(requestTimeoutMs),
      },
    )
    const body = await signIn.json()
    assert.equal(signIn.ok, false)
    assert.equal(body.error?.message, 'EMAIL_NOT_FOUND')
  })

  await t.test('completed finalization is externally idempotent', async () => {
    const response = await invokeCallable('finalizeAccountDeletion', {
      uid: actors.target.uid,
      expectedRequestVersion: completedVersion,
    }, tokens.admin)
    assert.equal(response.status, 200)
    assert.equal(response.body.result.state, 'completed')
    assert.equal(response.body.result.requestVersion, completedVersion)
    assert.equal(response.body.result.lastCompletedStep, 'completed')
    assert.equal(response.body.result.idempotent, true)
    const request = (await db.doc(`accountDeletionRequests/${actors.target.uid}`).get()).data()
    assert.equal(request.requestVersion, completedVersion)
    assert.deepEqual(request.cleanupCounts, response.body.result.cleanupCounts)
    assert.deepEqual((await db.doc(`users/${actors.control.uid}`).get()).data(), fixture.controlProfile)
    assert.equal(await storageObjectExists(storagePaths.control), true)
    await assert.doesNotReject(() => auth.getUser(actors.admin.uid))
    await assert.doesNotReject(() => auth.getUser(actors.control.uid))
  })
})

test('real callables start a fresh deletion-request cycle after customer cancellation', { skip: !enabled }, async () => {
  const token = await createActor(cancellationCycleActor)
  const userRef = db.doc(`users/${cancellationCycleActor.uid}`)
  const requestRef = db.doc(`accountDeletionRequests/${cancellationCycleActor.uid}`)
  const initialProfile = profile(cancellationCycleActor)
  await userRef.set(initialProfile)

  const firstResponse = await invokeCallable('requestAccountDeletion', {}, token)
  assert.equal(firstResponse.status, 200)
  assert.deepEqual(Object.keys(firstResponse.body.result).sort(), ['blocked', 'idempotent', 'ok', 'request'])
  assert.equal(firstResponse.body.result.ok, true)
  assert.equal(firstResponse.body.result.blocked, false)
  assert.equal(firstResponse.body.result.idempotent, false)
  assert.deepEqual(
    projectAccountDeletionRequest(firstResponse.body.result.request),
    firstResponse.body.result.request,
  )

  const firstSnapshot = await requestRef.get()
  assert.equal(firstSnapshot.exists, true)
  const firstRequest = firstSnapshot.data()
  const initialVersion = firstRequest.requestVersion
  assert.deepEqual(Object.keys(firstRequest).sort(), freshRequestFieldNames)
  assert.equal(firstRequest.state, 'requested')
  assert.equal(firstRequest.requestVersion, 1)
  assert.equal(firstRequest.uid, cancellationCycleActor.uid)
  assert.equal(firstRequest.requestedBy, cancellationCycleActor.uid)
  assert.equal(firstRequest.requestedAt instanceof Timestamp, true)
  assert.equal(firstRequest.updatedAt instanceof Timestamp, true)
  assert.equal(firstRequest.cancelledAt, null)
  assert.equal(isFreshAccountDeletionRequestCycle(null, firstRequest), true)
  const firstProfile = (await userRef.get()).data()
  assert.equal(firstProfile.deletionRequestedAt instanceof Timestamp, true)
  assert.equal(firstProfile.deletionScheduledFor, null)
  assert.equal(firstProfile.termsAccepted, true)
  assert.equal(firstProfile.privacyAccepted, true)
  assert.equal(
    (await db.collection('accountDeletionRequests').where('uid', '==', cancellationCycleActor.uid).get()).size,
    1,
  )

  const cancellationResponse = await invokeCallable('cancelAccountDeletion', {}, token)
  assert.equal(cancellationResponse.status, 200)
  assert.equal(cancellationResponse.body.result.ok, true)
  assert.equal(cancellationResponse.body.result.idempotent, false)
  assert.deepEqual(
    projectAccountDeletionRequest(cancellationResponse.body.result.request),
    cancellationResponse.body.result.request,
  )
  const cancelledRequest = (await requestRef.get()).data()
  const cancelledVersion = cancelledRequest.requestVersion
  assert.equal(cancelledRequest.state, 'cancelled')
  assert.equal(cancelledVersion, 2)
  assert.equal(cancelledVersion, initialVersion + 1)
  assert.equal(cancelledRequest.cancelledAt instanceof Timestamp, true)
  assert.equal(cancelledRequest.requestedAt.isEqual(firstRequest.requestedAt), true)
  assert.equal(cancelledRequest.updatedAt.isEqual(firstRequest.updatedAt), false)
  assert.equal(canTransitionAccountDeletionState('requested', 'cancelled'), true)
  assert.equal(canTransitionAccountDeletionState('cancelled', 'requested'), false)
  assert.equal(canStartNewAccountDeletionRequestCycle(cancelledRequest), true)
  const cancelledProfile = (await userRef.get()).data()
  assert.equal(cancelledProfile.deletionRequestedAt, null)
  assert.equal(cancelledProfile.deletionScheduledFor, null)
  await assert.doesNotReject(() => auth.getUser(cancellationCycleActor.uid))

  const repeatedCancellation = await invokeCallable('cancelAccountDeletion', {}, token)
  assert.equal(repeatedCancellation.status, 200)
  assert.equal(repeatedCancellation.body.result.idempotent, true)
  assert.equal(repeatedCancellation.body.result.request.state, 'cancelled')
  assert.equal(repeatedCancellation.body.result.request.requestVersion, 2)
  assert.deepEqual((await requestRef.get()).data(), cancelledRequest)
  const repeatedCancellationProfile = (await userRef.get()).data()
  assert.equal(repeatedCancellationProfile.deletionRequestedAt, null)
  assert.equal(repeatedCancellationProfile.deletionScheduledFor, null)

  const secondResponse = await invokeCallable('requestAccountDeletion', {}, token)
  assert.equal(secondResponse.status, 200)
  assert.equal(secondResponse.body.result.ok, true)
  assert.equal(secondResponse.body.result.blocked, false)
  assert.equal(secondResponse.body.result.idempotent, false)
  assert.deepEqual(
    projectAccountDeletionRequest(secondResponse.body.result.request),
    secondResponse.body.result.request,
  )
  const secondRequest = (await requestRef.get()).data()
  const freshCycleVersion = secondRequest.requestVersion
  assert.deepEqual(Object.keys(secondRequest).sort(), freshRequestFieldNames)
  assert.equal(secondRequest.state, 'requested')
  assert.equal(freshCycleVersion, 3)
  assert.equal(freshCycleVersion, cancelledVersion + 1)
  assert.equal(secondRequest.uid, cancellationCycleActor.uid)
  assert.equal(secondRequest.requestedBy, cancellationCycleActor.uid)
  assert.equal(secondRequest.requestedAt instanceof Timestamp, true)
  assert.equal(secondRequest.updatedAt instanceof Timestamp, true)
  assert.equal(secondRequest.cancelledAt, null)
  assert.equal(secondRequest.requestedAt.isEqual(firstRequest.requestedAt), false)
  assert.equal(isFreshAccountDeletionRequestCycle(cancelledRequest, secondRequest), true)
  for (const field of staleCycleFieldNames) assert.equal(Object.hasOwn(secondRequest, field), false, field)

  const secondProfile = (await userRef.get()).data()
  assert.equal(secondProfile.deletionRequestedAt instanceof Timestamp, true)
  assert.equal(secondProfile.deletionScheduledFor, null)
  assert.equal(secondProfile.termsAccepted, true)
  assert.equal(secondProfile.privacyAccepted, true)
  assert.equal(secondProfile.termsVersion, initialProfile.termsVersion)
  assert.equal(secondProfile.privacyVersion, initialProfile.privacyVersion)
  assert.equal(
    (await db.collection('accountDeletionRequests').where('uid', '==', cancellationCycleActor.uid).get()).size,
    1,
  )

  const duplicateResponse = await invokeCallable('requestAccountDeletion', {}, token)
  assert.equal(duplicateResponse.status, 200)
  assert.equal(duplicateResponse.body.result.idempotent, true)
  assert.equal(duplicateResponse.body.result.request.state, 'requested')
  assert.equal(duplicateResponse.body.result.request.requestVersion, 3)
  const duplicateRequest = (await requestRef.get()).data()
  assert.deepEqual(duplicateRequest, secondRequest)
  for (const field of staleCycleFieldNames) assert.equal(Object.hasOwn(duplicateRequest, field), false, field)

  assert.equal((await userRef.get()).exists, true)
  await assert.doesNotReject(() => auth.getUser(cancellationCycleActor.uid))
  assert.equal(
    (await db.collection('accountDeletionRequests').where('uid', '==', cancellationCycleActor.uid).get()).size,
    1,
  )
})
