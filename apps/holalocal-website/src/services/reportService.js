import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/firestoreClient.js'

export const businessReportReasons = [
  { value: 'misleading_profile', label: 'Misleading profile' },
  { value: 'unqualified_service', label: 'Unqualified service' },
  { value: 'unsafe_behaviour', label: 'Unsafe behaviour' },
  { value: 'poor_conduct', label: 'Poor conduct' },
  { value: 'spam_or_fake_business', label: 'Spam or fake business' },
  { value: 'other', label: 'Other' },
]

const validReasons = new Set(businessReportReasons.map(({ value }) => value))

export async function createBusinessReport({ businessId, details, reason, reporterId }) {
  if (!reporterId) throw new Error('You must be signed in to submit a report.')
  if (!businessId) throw new Error('A business is required for this report.')
  if (!validReasons.has(reason)) throw new Error('Choose a report reason.')

  const safeDetails = String(details ?? '').trim()
  if (safeDetails.length > 2000) throw new Error('Details must be 2,000 characters or fewer.')

  return addDoc(collection(db, 'reports'), {
    reporterId,
    targetType: 'business',
    targetId: businessId,
    parentId: null,
    reason,
    details: safeDetails,
    evidence: [],
    status: 'open',
    priority: 'normal',
    assignedTo: null,
    resolution: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}
