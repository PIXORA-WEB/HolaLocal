import {createCustomerReviewTranslationService} from './customerReviewTranslation.js'
import {createTranslationProvider} from './providers/providerFactory.js'
import { customerReviewQuotaPolicy, customerReviewReportQuotaPolicy } from './customerReviewQuotas.js'
import { HttpsError } from 'firebase-functions/v2/https'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import * as contracts from '@holalocal/firebase-contract/customerReviewContracts'
import * as lifecycle from '@holalocal/firebase-contract/customerReviewLifecycle'
import { isPublicBusinessEligible } from '@holalocal/firebase-contract'
import { createCustomerReviewReportServices } from './customerReviewReports.js'
import { createCustomerReviewCommands } from './customerReviewCommands.js'
import { createCustomerReviewReadServices } from './customerReviewReads.js'
import { createCustomerReviewFirestoreDatabase, createCustomerReviewAuthAdapter, readCustomerReviewFirestoreEligibility } from './customerReviewFirestore.js'
import { createCustomerReviewReadFirestore } from './customerReviewReadFirestore.js'

export const CUSTOMER_REVIEW_CALLABLES = Object.freeze({
  translatePublishedCustomerReview: ['translation','translate'],
  getCustomerReviewRatingSummaries: ['read','readRatingSummaries'],
  submitCustomerReviewReport: ['report','submit'], listCustomerReviewReports: ['report','queue'],
  getCustomerReviewReport: ['report','detail'], resolveCustomerReviewReport: ['report','resolve'],
  submitCustomerReview: ['command','submit'], editCustomerReview: ['command','edit'], withdrawCustomerReview: ['command','withdraw'],
  approveCustomerReview: ['command','approve'], rejectCustomerReview: ['command','reject'], removeCustomerReview: ['command','remove'],
  listPublishedCustomerReviews: ['read','listPublic'], getOwnCustomerReview: ['read','getOwn'], listOwnCustomerReviews: ['read','listOwn'],
  listCustomerReviewModerationQueue: ['read','listAdminQueue'], getCustomerReviewModerationCase: ['read','getAdminCase'],
})

export function customerReviewGate(env) {
  if (env.CUSTOMER_REVIEWS_ENABLED !== 'true') throw new HttpsError('failed-precondition','customer-reviews-disabled')
  let config
  try { config = JSON.parse(env.FIREBASE_CONFIG ?? '{}') } catch { config = {} }
  const demo = 'demo-holalocal-functions'
  if (env.GCLOUD_PROJECT !== demo || env.GOOGLE_CLOUD_PROJECT !== demo
    || (env.GCP_PROJECT && env.GCP_PROJECT !== demo) || config.projectId !== demo
    || env.HOLALOCAL_CALLABLE_BOUNDARY !== '1' || env.FUNCTIONS_EMULATOR !== 'true'
    || env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099'
    || env.GOOGLE_APPLICATION_CREDENTIALS || env.FIREBASE_TOKEN || env.GOOGLE_OAUTH_ACCESS_TOKEN) {
    throw new HttpsError('failed-precondition','customer-reviews-production-policies-unavailable')
  }
  // Approved policies; production activation still requires a separately reviewed gate change.
  return {quotaPolicy: customerReviewQuotaPolicy, reportQuotaPolicy: customerReviewReportQuotaPolicy}
}

const publicOperation = name => ['listPublishedCustomerReviews','getCustomerReviewRatingSummaries','translatePublishedCustomerReview'].includes(name)
function servicesForRequest(request, policies) {
  const nativeAuth = createCustomerReviewAuthAdapter(getAuth())
  const auth = {
    ...nativeAuth,
    resolveActor: async token => {
      const identity = await nativeAuth.resolveActor(token)
      if (identity.uid !== request.auth?.uid) throw new Error('authentication-required')
      return identity
    },
  }
  const firestore = getFirestore()
  const helpers = {...contracts,...lifecycle}
  const providerName=process.env.CUSTOMER_REVIEW_TRANSLATION_PROVIDER ?? 'disabled'
  return {
    translation:createCustomerReviewTranslationService({database:createCustomerReviewFirestoreDatabase(firestore),
      provider:createTranslationProvider({providerName,projectId:process.env.GCLOUD_PROJECT,requestTimeoutMs:10000}),
      providerVersion:`${providerName}-v1`,configured:['mock','google_cloud'].includes(providerName)}),
    report: createCustomerReviewReportServices({database:createCustomerReviewFirestoreDatabase(firestore),
      readDatabase:createCustomerReviewReadFirestore(firestore),auth,reportQuotaPolicy:policies.reportQuotaPolicy}),
    command: createCustomerReviewCommands({helpers, database:createCustomerReviewFirestoreDatabase(firestore), auth,
      readEligibility:readCustomerReviewFirestoreEligibility, ...policies}),
    read: createCustomerReviewReadServices({helpers,database:createCustomerReviewReadFirestore(firestore),auth,isPublicBusinessEligible}),
  }
}

// Only explicitly reviewed domain errors cross this boundary. No arbitrary exception message/details.
const errorGroups = {
  'invalid-argument': ['invalid-translation-target','invalid-payload','unsupported-field','invalid-request-id','invalid-expected-version','invalid-target',
    'invalid-report-submitted-at','invalid-display-name','invalid-rejection-reason','invalid-rating','invalid-text','text-length','invalid-source-language','invalid-moderation-note','invalid-id',
    'invalid-report-text','invalid-report-reason','invalid-report-disposition','invalid-page-size','invalid-cursor','restart-pagination','invalid-batch-size'],
  'unauthenticated': ['authentication-required','auth/id-token-expired','auth/id-token-revoked','auth/invalid-id-token',
    'auth/user-disabled','auth/user-not-found','auth/argument-error'],
  'permission-denied': ['admin-required','author-required','self-review-forbidden','customer-role-required'],
  'failed-precondition': ['verified-email-required','active-account-required','public-business-required','business-unavailable',
    'report-request-expired','report-target-unavailable','review-refresh-required','report-not-open','invalid-review-transition','published-review-required'],
  'aborted': ['review-version-conflict','report-version-conflict'],
  'already-exists': ['request-id-conflict','report-already-open'],
  'not-found': ['review-not-found','report-not-found'],
  'resource-exhausted': ['review-quota-exceeded','report-quota-exceeded'],
}
export function safeCustomerReviewError(error) {
  const domain = typeof error?.code === 'string' ? error.code : error?.message
  for (const [code, values] of Object.entries(errorGroups)) {
    if (values.includes(domain)) return new HttpsError(code,domain.startsWith('auth/') ? 'authentication-required' : domain)
  }
  return new HttpsError('internal','customer-review-unavailable')
}

export function createCustomerReviewCallableHandler(name, {env = process.env, createServices = servicesForRequest} = {}) {
  if (!Object.hasOwn(CUSTOMER_REVIEW_CALLABLES,name)) throw new Error('unknown-customer-review-callable')
  return async request => {
    // Gate before authentication SDK, Firestore initialization and ALL review operations.
    const policies = customerReviewGate(env)
    try {
      let token
      if (!publicOperation(name)) {
        const header = request.rawRequest?.headers?.authorization
        token = typeof header === 'string' ? /^Bearer ([^\s]+)$/i.exec(header)?.[1] : null
        if (!request.auth?.uid || !token) throw new Error('authentication-required')
      }
      const [group, operation] = CUSTOMER_REVIEW_CALLABLES[name]
      const service = createServices(request,policies)[group]
      const payload = request.data ?? {}
      return publicOperation(name) ? await service[operation](payload) : await service[operation](token,payload)
    } catch (error) { throw safeCustomerReviewError(error) }
  }
}
