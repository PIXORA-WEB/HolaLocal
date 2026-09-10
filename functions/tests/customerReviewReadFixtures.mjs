import { compareReviewTime } from '../src/customerReviewTime.js'
import * as contracts from '../../shared/firebase-contract/customerReviewContracts.js'
import * as lifecycle from '../../shared/firebase-contract/customerReviewLifecycle.js'
import { isPublicBusinessEligible } from '../../shared/firebase-contract/publication.js'
import { customerReviewPairKey } from '../src/customerReviewCommands.js'
import { createCustomerReviewReadServices } from '../src/customerReviewReads.js'
export const helpers = { ...contracts, ...lifecycle }
export { isPublicBusinessEligible }
export function fixtureData(prefix = 'read') {
  const businessId = `${prefix}-business`; const uid = `${prefix}-author`
  const business = { businessId, ownerId: 'owner', managerIds: ['owner'], name: 'Fictional business', description: 'Synthetic service',
    primaryCategoryId: 'home', categoryIds: ['home'], serviceAreas: ['Madrid'], languages: ['en'], primaryLanguage: 'en',
    location: { locality: 'Madrid', region: 'Madrid', countryCode: 'ES' }, status: 'active', publishedAt: 1, privateName: 'DO NOT EXPOSE' }
  const data = new Map([[`businesses/${businessId}`, business]])
  function review(suffix, status = 'published', authorUid = uid) {
    const publicReviewId = `${prefix}-opaque-review-${suffix}`; const pair = customerReviewPairKey(businessId, authorUid)
    let slot = contracts.createCustomerReviewSlot({ businessId, authorUid, publicReviewId })
    const context = { authorIdentity: { uid: authorUid, emailVerified: true },
      authorAccount: { uid: authorUid, accountStatus: 'active', roles: ['customer'] }, business }
    const act = action => {
      slot = lifecycle.transitionCustomerReview(slot, { ...context, action, expectedVersion: slot.version,
        actor: ['approve','reject','remove'].includes(action) ? { uid: 'admin', admin: true } : { uid: authorUid },
        submission: { rating: 4, originalText: 'Fictional review with helpful and thoughtful service.', declaredSourceLanguage: 'en' } })
    }
    act('submit')
    if (status !== 'pending' && status !== 'rejected') act('approve')
    if (status === 'edit') act('submit')
    if (status === 'rejected') act('reject')
    if (status === 'withdrawn') act('withdraw')
    if (status === 'removed') act('remove')
    const { revisions, ...state } = slot
    const time = seconds => ({ seconds, nanoseconds: 1000 })
    const hasEverPublished = !['pending', 'rejected'].includes(status)
    const dates = { firstSubmittedAt: time(100), firstPublishedAt: hasEverPublished ? time(200) : null,
      publishedVersionAt: slot.publishedRevision === null ? null : time(200),
      pendingSubmittedAt: slot.pendingRevision === null ? null : time(slot.pendingRevision === 1 ? 100 : 250), updatedAt: time(300) }
    data.set(`customerReviewSlots/${pair}`, { ...state, ...dates, revisionCount: revisions.length, moderationNote: 'SECRET NOTE' })
    for (const revision of revisions) data.set(`customerReviewSlots/${pair}/revisions/${revision.revision}`, { ...revision, submittedAt: time(revision.revision === 1 ? 100 : 250) })
    data.set(`customerReviewIds/${publicReviewId}`, { businessId, authorUid })
    const projection = contracts.projectPublishedCustomerReview(slot)
    if (projection) data.set(`customerReviewsPublic/${publicReviewId}`, { ...projection, publishedAt: time(200), updatedAt: time(200), reviewerAlias: 'Fictional alias',
      authorUid, email: 'private@example.invalid', moderationNote: 'SECRET NOTE' }) // allowlist stress
    return { publicReviewId, pair, slot }
  }
  return { data, businessId, uid, business, review }
}
export const syntheticAuth = uid => ({ resolveActor: async token => {
  if (token === 'author') return { uid, emailVerified: false }
  if (token === 'admin') return { uid: 'admin', admin: true }
  throw new Error('authentication-required')
} })
export function fakeReads(fixture) {
  const reads = []
  const database = { readSnapshot: async callback => {
    const snapshot = structuredClone(fixture.data)
    return callback({ get: async path => { reads.push(path); return snapshot.get(path) ?? null },
      query: async ({ collection, filters, order, after, limit }) => {
        reads.push(collection)
        const compare = (a,b) => (typeof a === 'object' ? compareReviewTime(a,b) : a < b ? -1 : a > b ? 1 : 0)
        const cmp = (a,b) => compare(a[0],b[0]) * (order[0][1] === 'desc' ? -1 : 1) || compare(a[1],b[1])
        const values = row => order.map(([field]) => row.data[field])
        return [...snapshot].filter(([path, value]) => path.split('/').length === 2 && path.startsWith(`${collection}/`)
          && filters.every(([field,target]) => value[field] === target) && order.every(([field]) => value[field] !== undefined))
          .map(([path,data]) => ({ id: path.split('/')[1], data }))
          .sort((a,b) => cmp(values(a),values(b)))
          .filter(row => !after || cmp(values(row),after) > 0).slice(0,limit)
      } })
  } }
  return { reads, services: createCustomerReviewReadServices({ helpers, database, auth: syntheticAuth(fixture.uid), isPublicBusinessEligible }) }
}
