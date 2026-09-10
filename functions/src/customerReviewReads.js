import {authorCustomerReviewRejection} from './customerReviewModeration.js'
import { reviewTime, compareReviewTime, assertReviewDates } from './customerReviewTime.js'
import { createHash } from 'node:crypto'
import { customerReviewPairKey } from './customerReviewCommands.js'
import { createBoundedCustomerReviewHelpers } from './customerReviewBounded.js'

const fail = code => { const error = new Error(code); error.code = code; throw error }
const check = (value, code) => { if (!value) fail(code) }
const scopeKey = scope => createHash('sha256').update(JSON.stringify(scope)).digest('hex')

// No SDK/package initialization. All dependencies are explicit and server-owned.
export function createCustomerReviewReadServices({ helpers, database, auth, isPublicBusinessEligible }) {
  check(typeof database?.readSnapshot === 'function' && typeof auth?.resolveActor === 'function'
    && typeof isPublicBusinessEligible === 'function', 'missing-read-dependency')
  const h = createBoundedCustomerReviewHelpers(helpers)
  const exact = (input, keys) => {
    check(h.isCustomerReviewRecord(input) && Reflect.ownKeys(input).every(key => keys.includes(key)), 'invalid-payload')
  }
  const id = value => { check(h.isCustomerReviewId(value), 'invalid-id'); return value }
  const actor = async (context, admin = false) => {
    const identity = await auth.resolveActor(context)
    check(h.isCustomerReviewId(identity?.uid), 'authentication-required')
    check(!admin || identity.admin === true, 'admin-required')
    return identity
  }
  function page(input, scope) {
    const limit = input.pageSize === undefined ? 10 : input.pageSize
    check(Number.isInteger(limit) && limit >= 1 && limit <= 20, 'invalid-page-size')
    let position = null
    if (input.cursor !== undefined && input.cursor !== null) {
      check(typeof input.cursor === 'string' && input.cursor.length <= 4096
        && /^[A-Za-z0-9_-]+$/.test(input.cursor), 'invalid-cursor')
      let decoded
      try { decoded = JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8')) } catch { fail('invalid-cursor') }
      if (decoded?.v !== 2) fail('restart-pagination')
      check(h.isCustomerReviewRecord(decoded) && Object.keys(decoded).sort().join() === 'position,scope,v'
        && decoded.v === 2 && decoded.scope === scopeKey(scope) && Array.isArray(decoded.position)
        && decoded.position.length === 2 && h.isCustomerReviewRecord(decoded.position[0]) && Object.keys(decoded.position[0]).sort().join() === 'nanoseconds,seconds'
        && h.isCustomerReviewId(decoded.position[1]), 'invalid-cursor')
      try { reviewTime(decoded.position[0]) } catch { fail('invalid-cursor') }
      position = decoded.position
    }
    return { limit, position, scope }
  }
  const original = revision => revision && ({ revision: revision.revision, rating: revision.rating,
    ...(revision.displayName === undefined ? {} : { displayName: revision.displayName }),
    originalText: revision.originalText, declaredSourceLanguage: revision.declaredSourceLanguage })
  function publicProjection(row, businessId) {
    const value = row.data
    check(value.businessId === businessId && value.publicReviewId === row.id
      && h.isCustomerReviewId(row.id) && row.id.length >= 16
      && Number.isSafeInteger(value.publishedRevision) && value.publishedRevision >= 1, 'invalid-public-review')
    const validated = h.validateCustomerReviewSubmission({ rating: value.rating, originalText: value.originalText,
      declaredSourceLanguage: value.declaredSourceLanguage }, { min: 1, max: Number.MAX_SAFE_INTEGER }, { allowLegacyDisplayName: true })
    check(validated.valid && validated.value.originalText === value.originalText, 'invalid-public-review')
    check(value.reviewerAlias == null || (typeof value.reviewerAlias === 'string' && value.reviewerAlias.trim()
      && [...value.reviewerAlias].length <= 80), 'invalid-public-alias')
    check(compareReviewTime(value.publishedAt, value.updatedAt) <= 0, 'inconsistent-public-dates')
    return { publicReviewId: row.id, publishedRevision: value.publishedRevision,
      reviewerAlias: value.reviewerAlias ?? null, ...validated.value,
      publishedAt: reviewTime(value.publishedAt), updatedAt: reviewTime(value.updatedAt) }
  }
  async function caseProjection(tx, row, ownerUid, admin = false) {
    const state = row.data
    check(h.isCustomerReviewId(state?.authorUid) && h.isCustomerReviewId(state?.businessId)
      && row.id === customerReviewPairKey(state.businessId, state.authorUid), 'invalid-review-identity')
    check(ownerUid === undefined || state.authorUid === ownerUid, 'author-required')
    const numbers = h.customerReviewRevisionNumbers(state)
    const revisions = await Promise.all(numbers.map(number => tx.get(`customerReviewSlots/${row.id}/revisions/${number}`)))
    h.assertCustomerReviewSlot({ ...state, revisions })
    // Missing legacy dates stay unavailable on reads; malformed/inconsistent present dates still fail closed.
    const requiredDates = [state.firstSubmittedAt, state.updatedAt, ...revisions.map(value=>value.submittedAt),
      ...(state.publishedRevision !== null ? [state.firstPublishedAt,state.publishedVersionAt] : []),
      ...(state.pendingRevision !== null ? [state.pendingSubmittedAt] : [])]
    if (requiredDates.every(value=>value!=null)) assertReviewDates(state, revisions)
    else requiredDates.filter(value=>value!=null).forEach(reviewTime)
    const pending = revisions.find(value=>value.revision===state.pendingRevision)
    let pendingSubmittedAt = null
    if (pending?.submittedAt!=null && state.pendingSubmittedAt!=null) {
      check(compareReviewTime(pending.submittedAt,state.pendingSubmittedAt)===0,'inconsistent-review-dates')
      pendingSubmittedAt=reviewTime(pending.submittedAt)
    }
    const publicationDates=state.publishedRevision===null?null:{
      publishedAt:state.firstPublishedAt==null?null:reviewTime(state.firstPublishedAt),
      updatedAt:state.publishedVersionAt==null?null:reviewTime(state.publishedVersionAt) }

    const business = await tx.get(`businesses/${state.businessId}`)
    const find = number => original(revisions.find(revision => revision.revision === number) ?? null)
    return { publicReviewId: state.publicReviewId, businessId: state.businessId, version: state.version, status: state.status,
      businessAvailable: isPublicBusinessEligible(business), rejection: authorCustomerReviewRejection(state),
      ...(admin ? {pendingSubmittedAt, publicationDates} : {}), pending: find(state.pendingRevision),
      published: find(state.publishedRevision), lastSubmitted: find(state.revisionCount),
      guidance: state.status === 'rejected' ? 'customer-review-rejected-may-resubmit'
        : state.status === 'removed' ? 'customer-review-removed-no-resubmission' : null }
  }
  async function paginated(tx, collection, filters, orderField, direction, options, project) {
    const rows = await tx.query({ collection, filters, order: [[orderField, direction], ['publicReviewId', 'asc']],
      after: options.position, limit: options.limit + 1 })
    const selected = rows.slice(0, options.limit)
    const items = await Promise.all(selected.map(project))
    const last = selected.at(-1)?.data
    return { items, nextCursor: rows.length > options.limit ? Buffer.from(JSON.stringify({ v: 2,
      scope: scopeKey(options.scope), position: [reviewTime(last[orderField]), last.publicReviewId] })).toString('base64url') : null }
  }
  return Object.freeze({
    listPublic: async input => {
      exact(input, ['businessId', 'pageSize', 'cursor']); const businessId = id(input.businessId)
      const options = page(input, ['public', businessId])
      return database.readSnapshot(async tx => {
        check(isPublicBusinessEligible(await tx.get(`businesses/${businessId}`)), 'business-unavailable')
        return paginated(tx, 'customerReviewsPublic', [['businessId', businessId]], 'publishedAt', 'desc', options,
          row => publicProjection(row, businessId))
      })
    },
    getOwn: async (context, input) => {
      exact(input, ['businessId']); const businessId = id(input.businessId); const identity = await actor(context)
      return database.readSnapshot(async tx => {
        const pair = customerReviewPairKey(businessId, identity.uid); const data = await tx.get(`customerReviewSlots/${pair}`)
        return data ? caseProjection(tx, { id: pair, data }, identity.uid) : null
      })
    },
    listOwn: async (context, input = {}) => {
      exact(input, ['pageSize', 'cursor']); const identity = await actor(context)
      const options = page(input, ['own', identity.uid])
      return database.readSnapshot(tx => paginated(tx, 'customerReviewSlots', [['authorUid', identity.uid]], 'updatedAt', 'desc', options,
        row => caseProjection(tx, row, identity.uid)))
    },
    listAdminQueue: async (context, input = {}) => {
      exact(input, ['pageSize', 'cursor']); await actor(context, true); const options = page(input, ['admin-pending'])
      return database.readSnapshot(tx => paginated(tx, 'customerReviewSlots', [['status', 'pending']], 'pendingSubmittedAt', 'asc', options,
        row => { check(row.data.status === 'pending', 'invalid-queue-state'); return caseProjection(tx, row, undefined, true) }))
    },
    getAdminCase: async (context, input) => {
      exact(input, ['publicReviewId']); const publicId = id(input.publicReviewId); await actor(context, true)
      return database.readSnapshot(async tx => {
        const locator = await tx.get(`customerReviewIds/${publicId}`)
        if (!locator) return null
        const pair = customerReviewPairKey(id(locator.businessId), id(locator.authorUid))
        const data = await tx.get(`customerReviewSlots/${pair}`)
        check(data?.publicReviewId === publicId, 'invalid-review-identity')
        return caseProjection(tx, { id: pair, data }, undefined, true)
      })
    },
    readRatingSummaries: async input => {
      exact(input, ['businessIds']); check(Array.isArray(input.businessIds) && input.businessIds.length <= 20, 'invalid-batch-size')
      const ids = [...new Set(Array.from(input.businessIds, id))]
      return database.readSnapshot(async tx => Promise.all(ids.map(async businessId => {
        if (!isPublicBusinessEligible(await tx.get(`businesses/${businessId}`))) return { businessId, available: false, average: null, count: null }
        const stats = await tx.get(`customerReviewStats/${businessId}`)
        if (stats === null) return { businessId, available: true, average: null, count: 0 }
        try {
          const valid = h.assertCustomerReviewAggregate(stats)
          return { businessId, available: true, average: valid.count ? valid.sum / valid.count : null, count: valid.count }
        } catch { return { businessId, available: false, average: null, count: null } }
      })))
    },
  })
}
