import {
  collection, doc, getDoc, getDocs, limit as firestoreLimit,
  query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { resolveMobileBusinessLookup, toMobileManagedBusiness } from './businessCompatibility.js'
import { buildCanonicalBusinessUpdate } from './businessPayloads.js'

const MAX_OWNER_CANDIDATES = 21

function businessDocument(businessId) {
  if (!businessId) throw new Error('A business ID is required.')
  return doc(db, 'businesses', businessId)
}

function privateBusinessDocument(businessId) {
  return doc(db, 'businessPrivate', businessId)
}

async function getManagedBusinessById(businessId) {
  const [businessSnapshot, privateSnapshot] = await Promise.all([
    getDoc(businessDocument(businessId)),
    getDoc(privateBusinessDocument(businessId)),
  ])
  if (!businessSnapshot.exists()) return null
  return toMobileManagedBusiness(
    businessSnapshot.id,
    businessSnapshot.data(),
    privateSnapshot.exists() ? privateSnapshot.data() : null,
  )
}

export async function getBusinessById(businessId) {
  return getManagedBusinessById(businessId)
}

async function candidateById(businessId, source, missingIsInvalid = false) {
  if (!businessId) return { candidate: null, invalid: false }
  try {
    const snapshot = await getDoc(businessDocument(businessId))
    if (!snapshot.exists()) return { candidate: null, invalid: missingIsInvalid }
    return {
      candidate: {
        businessId: snapshot.id,
        ownerId: snapshot.data().ownerId,
        source,
        document: snapshot.data(),
      },
      invalid: false,
    }
  } catch (error) {
    if (error?.code === 'permission-denied') return { candidate: null, invalid: true }
    throw error
  }
}

export async function getManagedBusinessLookup(ownerId, userBusinessId = null) {
  if (!ownerId) return { lookup: resolveMobileBusinessLookup({ ownerId }).lookup, business: null }
  const pointer = userBusinessId
    ? await candidateById(userBusinessId, 'user_business_id', true)
    : { candidate: null, invalid: false }
  const uid = userBusinessId === ownerId
    ? pointer
    : await candidateById(ownerId, 'owner_uid_document')
  const ownerSnapshot = await getDocs(query(
    collection(db, 'businesses'),
    where('ownerId', '==', ownerId),
    firestoreLimit(MAX_OWNER_CANDIDATES),
  ))
  const resolved = resolveMobileBusinessLookup({
    ownerId,
    pointerCandidate: pointer.candidate,
    uidCandidate: uid.candidate,
    ownerCandidates: ownerSnapshot.docs.map((snapshot) => ({
      businessId: snapshot.id,
      ownerId: snapshot.data().ownerId,
      document: snapshot.data(),
    })),
    pointerInvalid: pointer.invalid,
    uidInvalid: uid.invalid,
  })
  if (resolved.lookup.status !== 'found') return { lookup: resolved.lookup, business: null }
  return {
    lookup: resolved.lookup,
    business: await getManagedBusinessById(resolved.lookup.businessId),
  }
}

export async function getBusinessByOwnerId(ownerId, userBusinessId = null) {
  const result = await getManagedBusinessLookup(ownerId, userBusinessId)
  if (result.lookup.status === 'found') return result.business
  if (result.lookup.status === 'not_found') return null
  const error = new Error('Business ownership could not be resolved safely.')
  error.code = result.lookup.status === 'ambiguous'
    ? 'business/ambiguous-ownership'
    : 'business/invalid-ownership'
  throw error
}

export async function updateBusinessProfile(businessId, form) {
  const current = await getManagedBusinessById(businessId)
  if (!current) throw Object.assign(new Error('Business profile not found.'), { code: 'business/not-found' })
  if (!current.editSupport.supported) {
    throw Object.assign(new Error('This legacy business is read-only on mobile.'), {
      code: 'business/unsupported-legacy',
    })
  }
  const built = buildCanonicalBusinessUpdate(form)
  if (!built.valid) {
    throw Object.assign(new Error('Business edit contains unsupported values.'), {
      code: 'business/invalid-edit', issues: built.issues,
    })
  }
  await updateDoc(businessDocument(businessId), {
    ...built.payload,
    updatedAt: serverTimestamp(),
  })
  return getManagedBusinessById(businessId)
}
