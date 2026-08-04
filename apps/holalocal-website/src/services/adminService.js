import {
  collection,
  documentId,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore'
import { db } from '../firebase/firestoreClient.js'
import {
  assignBusinessSubscriptionPlanCallable,
  getAdminBusinessReviewCallable,
  moderateBusinessCallable,
} from '../firebase/functionsClient.js'

export const ADMIN_BUSINESS_STATUSES = ['pending_review', 'active', 'rejected', 'suspended']
export const ADMIN_QUEUE_PAGE_SIZE = 24

export async function getBusinessStatusCounts() {
  const entries = await Promise.all(ADMIN_BUSINESS_STATUSES.map(async (status) => {
    const snapshot = await getCountFromServer(query(
      collection(db, 'businesses'),
      where('status', '==', status),
    ))
    return [status, snapshot.data().count]
  }))
  return Object.fromEntries(entries)
}

export async function getAdminBusinessesPage({
  status = 'pending_review',
  cursor = null,
  pageSize = ADMIN_QUEUE_PAGE_SIZE,
} = {}) {
  if (!ADMIN_BUSINESS_STATUSES.includes(status)) throw new Error('Unsupported business status.')
  const constraints = [
    where('status', '==', status),
    orderBy(status === 'pending_review' ? 'submittedAt' : 'updatedAt', 'desc'),
    orderBy(documentId(), 'desc'),
  ]
  if (cursor) constraints.push(startAfter(cursor))
  constraints.push(limit(Math.min(Math.max(pageSize, 1), ADMIN_QUEUE_PAGE_SIZE)))
  const snapshot = await getDocs(query(collection(db, 'businesses'), ...constraints))
  return {
    businesses: snapshot.docs.map((business) => ({
      businessId: business.id,
      ...business.data(),
    })),
    cursor: snapshot.docs.at(-1) ?? null,
    hasMore: snapshot.size === Math.min(Math.max(pageSize, 1), ADMIN_QUEUE_PAGE_SIZE),
  }
}

export async function getAdminBusinessReview(businessId) {
  const result = await getAdminBusinessReviewCallable({ businessId })
  return result.data
}

function createRequestId() {
  return globalThis.crypto?.randomUUID?.().replaceAll('-', '')
    ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export async function moderateBusiness({
  businessId,
  operation,
  reasonCode,
  guidance,
  requestId = createRequestId(),
}) {
  const result = await moderateBusinessCallable({
    businessId,
    operation,
    reasonCode: reasonCode ?? null,
    guidance: guidance ?? null,
    requestId,
  })
  return result.data
}

export async function assignBusinessSubscriptionPlan({
  businessId, planId, reason, requestId, expectedAssignmentVersion,
}) {
  const result = await assignBusinessSubscriptionPlanCallable({
    businessId, planId, reason, requestId, expectedAssignmentVersion,
  })
  return result.data
}
