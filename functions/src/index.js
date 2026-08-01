import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { transitionAccountRole } from './accountRoleTransition.js'
import { getAdminBusinessReview as runGetAdminBusinessReview } from './adminBusinessReview.js'
import { moderateBusiness as runBusinessModeration } from './businessModeration.js'
import { createFirestoreTranslationSource } from './firestoreTranslationSource.js'
import { processMessageTranslation } from './messageTranslation.js'
import { sendConversationMessage } from './messageSending.js'
import { ensureOwnerBusiness as runEnsureOwnerBusiness } from './ownerBusinessCreation.js'
import { listPublicBusinesses as runListPublicBusinesses } from './publicBusinessDirectory.js'
import {
  countCreatedConversation,
  getOwnerBusinessInsights as runGetOwnerBusinessInsights,
  recordBusinessInsight as runRecordBusinessInsight,
} from './businessInsights.js'
import {
  TRANSLATION_PROVIDER_CONFIG,
  createTranslationProvider,
  resolveRuntimeProjectId,
} from './providers/providerFactory.js'

initializeApp()

export const MESSAGE_TRANSLATION_REGION = 'europe-west1'
export const PUBLIC_CALLABLE_OPTIONS = {
  region: MESSAGE_TRANSLATION_REGION,
  invoker: 'public',
}

function requireCallableUid(request) {
  const uid = request.auth?.uid
  if (typeof uid !== 'string' || !uid.trim() || uid.includes('/')) {
    throw new HttpsError('unauthenticated', 'Authentication is required.')
  }
  return uid.trim()
}

export async function handleUpdateAccountRole(request, db) {
  const uid = requireCallableUid(request)
  return transitionAccountRole({
    uid,
    emailVerified: request.auth?.token?.email_verified === true,
    accountType: request.data?.accountType,
    db: db ?? getFirestore(),
  })
}

export async function handleEnsureOwnerBusiness(request, db) {
  const uid = requireCallableUid(request)
  return runEnsureOwnerBusiness({
    uid,
    emailVerified: request.auth?.token?.email_verified === true,
    db: db ?? getFirestore(),
  })
}

export async function handleSendMessage(request, db) {
  const uid = requireCallableUid(request)
  return sendConversationMessage({
    uid,
    conversationId: request.data?.conversationId,
    requestId: request.data?.requestId,
    text: request.data?.text,
    db: db ?? getFirestore(),
  })
}

export async function handleModerateBusiness(request, db) {
  const uid = requireCallableUid(request)
  return runBusinessModeration({
    uid,
    claims: request.auth?.token,
    businessId: request.data?.businessId,
    operation: request.data?.operation,
    reasonCode: request.data?.reasonCode,
    guidance: request.data?.guidance,
    requestId: request.data?.requestId,
    db: db ?? getFirestore(),
  })
}

export async function handleGetAdminBusinessReview(request, db) {
  const uid = requireCallableUid(request)
  return runGetAdminBusinessReview({
    uid,
    claims: request.auth?.token,
    businessId: request.data?.businessId,
    db: db ?? getFirestore(),
  })
}

export async function handleListPublicBusinesses(request, db) {
  return runListPublicBusinesses({
    maxResults: request.data?.maxResults,
    db: db ?? getFirestore(),
  })
}

export async function handleRecordBusinessInsight(request, db) {
  return runRecordBusinessInsight({ data: request.data, db: db ?? getFirestore() })
}

export async function handleGetOwnerBusinessInsights(request, db) {
  const uid = requireCallableUid(request)
  return runGetOwnerBusinessInsights({ uid, data: request.data, db: db ?? getFirestore() })
}

export const countBusinessEnquiry = onDocumentCreated(
  {
    document: 'conversations/{conversationId}',
    region: MESSAGE_TRANSLATION_REGION,
  },
  async (event) => countCreatedConversation({
    conversationId: event.params.conversationId,
    conversation: event.data?.data(),
    db: getFirestore(),
  }),
)

export const translateCreatedMessage = onDocumentCreated(
  {
    document: 'conversations/{conversationId}/messages/{messageId}',
    region: MESSAGE_TRANSLATION_REGION,
  },
  async (event) => {
    const { conversationId, messageId } = event.params
    await processMessageTranslation({
      conversationId,
      messageId,
      source: createFirestoreTranslationSource(getFirestore()),
      translator: createTranslationProvider({
        providerName: process.env[TRANSLATION_PROVIDER_CONFIG],
        projectId: resolveRuntimeProjectId(),
      }),
    })
  },
)

export const updateAccountRole = onCall(
  PUBLIC_CALLABLE_OPTIONS,
  async (request) => handleUpdateAccountRole(request),
)

export const ensureOwnerBusiness = onCall(
  PUBLIC_CALLABLE_OPTIONS,
  async (request) => handleEnsureOwnerBusiness(request),
)

export const sendMessage = onCall(
  PUBLIC_CALLABLE_OPTIONS,
  async (request) => handleSendMessage(request),
)

export const moderateBusiness = onCall(
  PUBLIC_CALLABLE_OPTIONS,
  async (request) => handleModerateBusiness(request),
)

export const getAdminBusinessReview = onCall(
  PUBLIC_CALLABLE_OPTIONS,
  async (request) => handleGetAdminBusinessReview(request),
)

export const listPublicBusinesses = onCall(
  PUBLIC_CALLABLE_OPTIONS,
  async (request) => handleListPublicBusinesses(request),
)

export const recordBusinessInsight = onCall(
  PUBLIC_CALLABLE_OPTIONS,
  async (request) => handleRecordBusinessInsight(request),
)

export const getOwnerBusinessInsights = onCall(
  PUBLIC_CALLABLE_OPTIONS,
  async (request) => handleGetOwnerBusinessInsights(request),
)
