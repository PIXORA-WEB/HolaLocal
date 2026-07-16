import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { onCall } from 'firebase-functions/v2/https'
import { transitionAccountRole } from './accountRoleTransition.js'
import { moderateBusiness as runBusinessModeration } from './businessModeration.js'
import { createFirestoreTranslationSource } from './firestoreTranslationSource.js'
import { processMessageTranslation } from './messageTranslation.js'
import { sendConversationMessage } from './messageSending.js'
import { ensureOwnerBusiness as runEnsureOwnerBusiness } from './ownerBusinessCreation.js'
import {
  TRANSLATION_PROVIDER_CONFIG,
  createTranslationProvider,
  resolveRuntimeProjectId,
} from './providers/providerFactory.js'

initializeApp()

export const MESSAGE_TRANSLATION_REGION = 'europe-west1'

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
  { region: MESSAGE_TRANSLATION_REGION },
  async (request) => transitionAccountRole({
    uid: request.auth?.uid,
    emailVerified: request.auth?.token?.email_verified === true,
    accountType: request.data?.accountType,
    db: getFirestore(),
  }),
)

export const ensureOwnerBusiness = onCall(
  { region: MESSAGE_TRANSLATION_REGION },
  async (request) => runEnsureOwnerBusiness({
    uid: request.auth?.uid,
    emailVerified: request.auth?.token?.email_verified === true,
    db: getFirestore(),
  }),
)

export const sendMessage = onCall(
  { region: MESSAGE_TRANSLATION_REGION },
  async (request) => sendConversationMessage({
    uid: request.auth?.uid,
    conversationId: request.data?.conversationId,
    requestId: request.data?.requestId,
    text: request.data?.text,
    db: getFirestore(),
  }),
)

export const moderateBusiness = onCall(
  { region: MESSAGE_TRANSLATION_REGION },
  async (request) => runBusinessModeration({
    uid: request.auth?.uid,
    claims: request.auth?.token,
    businessId: request.data?.businessId,
    operation: request.data?.operation,
    db: getFirestore(),
  }),
)
