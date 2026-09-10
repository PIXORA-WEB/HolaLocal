import {requireCustomerReviewRejectionReason} from './customerReviewModeration.js'
// Shared helpers are injected through deployable-package callable wiring, never monorepo imports.
import { createHash, randomBytes } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { reviewTime, compareReviewTime, assertReviewDates } from './customerReviewTime.js'
import { createBoundedCustomerReviewHelpers } from './customerReviewBounded.js'

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const customerReviewPairKey = (businessId, authorUid) => digest(['customerReviewPair', 1, businessId, authorUid])
export const customerReviewQuotaKey = uid => digest(['customerReviewQuota', 1, uid])
const requestKey = (uid, id) => digest(['customerReviewRequest', 1, uid, id])
const fail = code => { const error = new Error(code); error.code = code; throw error }
const requireValue = (ok, code) => { if (!ok) fail(code) }
const submissionCommands = ['submit', 'edit']
const moderationCommands = ['approve', 'reject', 'remove']
const same = isDeepStrictEqual

/** Adapter/policy contracts and trust requirements: ../CUSTOMER_REVIEWS_BATCH2A.md. */
export function createCustomerReviewCommands({ helpers: h, database, auth, readEligibility,
  quotaPolicy, clock = Date.now, allocatePublicId = () => randomBytes(24).toString('hex'), textBounds } = {}) {
  for (const name of ['isCustomerReviewRecord', 'isCustomerReviewId', 'validateCustomerReviewSubmission',
    'customerReviewAssert', 'createCustomerReviewSlot', 'assertCustomerReviewSlot', 'transitionCustomerReview',
    'evaluateCustomerReviewEligibility', 'projectPublishedCustomerReview', 'customerReviewRatingContribution',
    'customerReviewRatingDelta', 'assertCustomerReviewAggregate', 'applyCustomerReviewRatingDelta']) {
    requireValue(typeof h?.[name] === 'function', 'missing-helper')
  }
  requireValue(typeof database?.timestampFromMillis === 'function' && typeof database?.get === 'function' && typeof database?.runTransaction === 'function'
    && typeof auth?.resolveActor === 'function' && typeof auth?.loadAuthorIdentity === 'function'
    && typeof readEligibility === 'function'
    && typeof quotaPolicy?.reserve === 'function', 'missing-dependency')

  h = createBoundedCustomerReviewHelpers(h)

  function validate(command, input) {
    requireValue(h.isCustomerReviewRecord(input), 'invalid-payload')
    const isSubmission = submissionCommands.includes(command)
    const keys = ['requestId', 'expectedVersion', isSubmission ? 'businessId' : 'publicReviewId',
      ...(isSubmission ? ['rating', 'originalText', 'declaredSourceLanguage', 'displayName'] : []),
      ...(moderationCommands.includes(command) ? ['moderationNote'] : []),
      ...(command === 'reject' ? ['rejectionReasonCode'] : [])]
    requireValue(Reflect.ownKeys(input).every(key => keys.includes(key)), 'unsupported-field')
    requireValue(h.isCustomerReviewId(input.requestId), 'invalid-request-id')
    requireValue(Number.isSafeInteger(input.expectedVersion) && input.expectedVersion >= 0, 'invalid-expected-version')
    const target = isSubmission ? 'businessId' : 'publicReviewId'
    requireValue(h.isCustomerReviewId(input[target]), 'invalid-target')
    const value = { requestId: input.requestId, expectedVersion: input.expectedVersion, [target]: input[target] }
    if (isSubmission) {
      const result = h.validateCustomerReviewSubmission({ rating: input.rating, originalText: input.originalText,
        declaredSourceLanguage: input.declaredSourceLanguage, displayName: input.displayName }, textBounds)
      requireValue(result.valid, result.issues[0])
      Object.assign(value, result.value)
    }
    if (moderationCommands.includes(command)) {
      requireValue(input.moderationNote === undefined || (typeof input.moderationNote === 'string'
        && [...input.moderationNote].length <= 2000 && !/[\uD800-\uDFFF]/u.test(input.moderationNote)), 'invalid-moderation-note')
      value.moderationNote = input.moderationNote ?? null
    }
    if (command === 'reject') value.rejectionReasonCode = requireCustomerReviewRejectionReason(input.rejectionReasonCode)
    return Object.freeze(value)
  }

  async function execute(command, context, input) {
    const payload = validate(command, input)
    // Auth SDK work, time and entropy are outside the retryable callback.
    const actor = await auth.resolveActor(context)
    requireValue(h.isCustomerReviewId(actor?.uid), 'authentication-required')
    const moderating = moderationCommands.includes(command)
    requireValue(!moderating || actor.admin === true, 'admin-required')
    const submitting = submissionCommands.includes(command)
    const locator = submitting ? { businessId: payload.businessId, authorUid: actor.uid }
      : await database.get(`customerReviewIds/${payload.publicReviewId}`)
    requireValue(locator && h.isCustomerReviewId(locator.authorUid) && h.isCustomerReviewId(locator.businessId), 'review-not-found')
    requireValue(moderating || locator.authorUid === actor.uid, 'author-required')
    const pair = customerReviewPairKey(locator.businessId, locator.authorUid)
    const identity = command === 'approve' ? await auth.loadAuthorIdentity(locator.authorUid) : actor
    const candidateId = submitting ? allocatePublicId() : null
    const now = clock()
    requireValue(Number.isSafeInteger(now) && now >= 0, 'invalid-clock')
    const commandTime = database.timestampFromMillis(now)
    reviewTime(commandTime)
    const receiptId = requestKey(actor.uid, payload.requestId)
    const fingerprint = digest(['customerReviewCommand', 1, command, payload])

    return database.runTransaction(async tx => {
      const read = path => tx.get(path)
      // Adapter methods below must only perform transaction reads, never external I/O.
      const receipt = await read(`customerReviewRequests/${receiptId}`)
      const record = await read(`customerReviewSlots/${pair}`)
      requireValue(record?.customerReviewCleanup !== true, 'review-not-found')
      if (moderating) {
        const actorDeletion = await read(`accountDeletionRequests/${actor.uid}`)
        requireValue(!['finalizing', 'failed_retryable', 'completed'].includes(actorDeletion?.state), 'active-account-required')
      }
      const currentLocator = !submitting ? await read(`customerReviewIds/${payload.publicReviewId}`) : null
      requireValue(submitting || same(currentLocator, locator), 'review-identity-conflict')
      if (record) requireValue(record.authorUid === locator.authorUid && record.businessId === locator.businessId
        && (submitting || record.publicReviewId === payload.publicReviewId), 'review-identity-conflict')
      else requireValue(submitting, 'review-not-found')
      // Replays require current authorization too. Withdrawal intentionally bypasses submission eligibility.
      const eligibility = (submitting || command === 'approve')
        ? await readEligibility(tx, { authorUid: locator.authorUid, businessId: locator.businessId }) : null
      if (eligibility) {
        requireValue(eligibility.account?.uid === locator.authorUid && eligibility.business?.businessId === locator.businessId
          && identity?.uid === locator.authorUid, 'review-context-mismatch')
        const decision = h.evaluateCustomerReviewEligibility({ identity, account: eligibility.account, business: eligibility.business })
        requireValue(decision.eligible, decision.reason)
      } else requireValue(!submitting && command !== 'approve', 'missing-eligibility')
      if (receipt) {
        requireValue(receipt.actorUid === actor.uid && receipt.command === command && receipt.fingerprint === fingerprint,
          'request-id-conflict')
        // Explicit allowlist, even for stored receipts. This is a historical receipt, not current status.
        return safeOutcome(receipt.outcome)
      }
      let before
      if (record) {
        requireValue(Number.isSafeInteger(record.revisionCount) && record.revisionCount >= 1, 'invalid-revision-count')
        const numbers = h.customerReviewRevisionNumbers(record)
        const revisions = await Promise.all(numbers.map(number => read(`customerReviewSlots/${pair}/revisions/${number}`)))
        before = { ...record, revisions }
      } else before = h.createCustomerReviewSlot({ ...locator, publicReviewId: candidateId })
      h.assertCustomerReviewSlot(before)
      if (record) {
        assertReviewDates(record, before.revisions)
        requireValue(compareReviewTime(commandTime, record.updatedAt) >= 0, 'server-clock-regression')
      }
      requireValue(command !== 'edit' || before.publishedRevision !== null, 'published-review-required')
      // submit also permits Batch 1 resubmission after rejection/withdrawal. edit requires an approved version.
      const after = h.transitionCustomerReview(before, { action: submitting ? 'submit' : command,
        expectedVersion: payload.expectedVersion, submission: submitting ? {
          rating: payload.rating, originalText: payload.originalText, declaredSourceLanguage: payload.declaredSourceLanguage, displayName: payload.displayName,
        } : undefined, actor, authorIdentity: identity, authorAccount: eligibility?.account, business: eligibility?.business }, textBounds)
      const publicPath = `customerReviewsPublic/${before.publicReviewId}`
      const existingPublic = await read(publicPath)
      const oldProjection = h.projectPublishedCustomerReview(before)
      requireValue(oldProjection ? existingPublic && Object.keys(oldProjection).every(key => same(existingPublic[key], oldProjection[key]))
        : existingPublic == null, 'inconsistent-public-projection')
      if (oldProjection) requireValue(compareReviewTime(existingPublic.publishedAt, record.firstPublishedAt) === 0
        && compareReviewTime(existingPublic.updatedAt, record.publishedVersionAt) === 0, 'inconsistent-public-dates')
      const statsPath = `customerReviewStats/${locator.businessId}`
      let stats = await read(statsPath)
      if (!stats) {
        // Query is needed even for a new slot: another review may already contribute.
        const anyPublished = await tx.hasPublishedReview(locator.businessId)
        requireValue(!record && !oldProjection && !anyPublished, 'missing-review-statistics')
        stats = { sum: 0, count: 0 }
      }
      h.assertCustomerReviewAggregate(stats)
      const contribution = h.customerReviewRatingContribution(before)
      // Removing this known contribution must itself leave valid counters.
      h.assertCustomerReviewAggregate({ sum: stats.sum - contribution.sum, count: stats.count - contribution.count })
      const nextStats = h.applyCustomerReviewRatingDelta(stats, h.customerReviewRatingDelta(before, after))
      const mappingPath = `customerReviewIds/${before.publicReviewId}`
      const mapping = await read(mappingPath)
      requireValue(record ? same(mapping, locator) : mapping == null, 'public-id-conflict')
      const quotaPath = `customerReviewQuotas/${customerReviewQuotaKey(actor.uid)}`
      const quota = submitting ? await read(quotaPath) : null
      const nextQuota = submitting ? quotaPolicy.reserve({ current: quota, actorUid: actor.uid, businessId: locator.businessId, now }) : null
      requireValue(!submitting || h.isCustomerReviewRecord(nextQuota), 'invalid-quota-policy-result')
      const projection = h.projectPublishedCustomerReview(after)
      // Name travels with the moderated revision. Pending edits retain the approved name.
      const alias = projection ? (projection.reviewerAlias ?? (oldProjection ? existingPublic.reviewerAlias : null)) : null
      requireValue(!projection || (typeof alias === 'string' && alias.trim().length > 0
        && [...alias].length <= 80 && !/[\uD800-\uDFFF]/u.test(alias)), 'invalid-public-alias')
      // All reads are complete. Policies above are synchronous, pure and must be retry-safe.
      const { revisions, ...state } = after
      const dates = { firstSubmittedAt: record?.firstSubmittedAt ?? commandTime,
        firstPublishedAt: record?.firstPublishedAt ?? (command === 'approve' ? commandTime : null),
        publishedVersionAt: command === 'approve' ? commandTime : after.publishedRevision === null ? null : record.publishedVersionAt,
        pendingSubmittedAt: submitting ? commandTime : null, updatedAt: commandTime }
      tx.set(`customerReviewSlots/${pair}`, { ...state, ...dates,
        rejection: command === 'reject' ? { revision: before.pendingRevision, reasonCode: payload.rejectionReasonCode } : null })
      if (!record) tx.create(mappingPath, locator)
      if (submitting) tx.create(`customerReviewSlots/${pair}/revisions/${after.pendingRevision}`, { ...revisions.at(-1), submittedAt: commandTime })
      if (projection) tx.set(publicPath, { ...projection, reviewerAlias: alias, publishedAt: dates.firstPublishedAt, updatedAt: dates.publishedVersionAt })
      else tx.delete(publicPath)
      tx.set(statsPath, nextStats)
      if (submitting) tx.set(quotaPath, nextQuota)
      const outcome = safeOutcome(after)
      tx.create(`customerReviewAudits/${receiptId}`, { actorUid: actor.uid, command, pair, beforeVersion: before.version,
        afterVersion: after.version, at: now, moderationNote: payload.moderationNote ?? null })
      tx.create(`customerReviewRequests/${receiptId}`, { actorUid: actor.uid, command, fingerprint, outcome })
      return outcome
    })
  }
  return Object.freeze(Object.fromEntries(['submit', 'edit', 'approve', 'reject', 'withdraw', 'remove']
    .map(command => [command, (context, payload) => execute(command, context, payload)])))
}

function safeOutcome(value) {
  return Object.freeze({ publicReviewId: value.publicReviewId, version: value.version, status: value.status,
    pendingRevision: value.pendingRevision, publishedRevision: value.publishedRevision })
}
