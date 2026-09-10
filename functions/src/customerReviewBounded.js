// Compact window over immutable history. Reuse Batch 1 transitions without fabricating history.
export function createBoundedCustomerReviewHelpers(base) {
  const check = base.customerReviewAssert
  function revisionNumbers(state) {
    check(Number.isSafeInteger(state.revisionCount) && state.revisionCount >= 0
      && Number.isSafeInteger(state.version) && state.version >= state.revisionCount, 'invalid-revision-count')
    for (const pointer of [state.pendingRevision, state.publishedRevision]) {
      check(pointer === null || (Number.isSafeInteger(pointer) && pointer >= 1 && pointer <= state.revisionCount), 'invalid-revision-pointer')
    }
    check(state.pendingRevision === null || state.pendingRevision === state.revisionCount, 'invalid-revision-pointer')
    return [...new Set([state.revisionCount || null, state.pendingRevision, state.publishedRevision]
      .filter(value => value !== null))].sort((a, b) => a - b)
  }
  function compact(state) {
    const numbers = revisionNumbers(state)
    check(Array.isArray(state.revisions) && state.revisions.length === numbers.length, 'invalid-revision-count')
    const revisions = numbers.map((number, index) => {
      const revision = state.revisions[index]
      check(revision?.revision === number, 'invalid-revision')
      return { ...revision, revision: index + 1 }
    })
    const pointer = number => number === null ? null : numbers.indexOf(number) + 1
    const value = { ...state, revisions, pendingRevision: pointer(state.pendingRevision), publishedRevision: pointer(state.publishedRevision) }
    base.assertCustomerReviewSlot(value)
    return { value, numbers }
  }
  const contribution = state => base.customerReviewRatingContribution(compact(state).value)
  return {
    ...base,
    customerReviewRevisionNumbers: revisionNumbers,
    createCustomerReviewSlot: input => ({ ...base.createCustomerReviewSlot(input), revisionCount: 0 }),
    assertCustomerReviewSlot: state => { compact(state); return state },
    transitionCustomerReview: (state, command, bounds) => {
      const { value, numbers } = compact(state)
      const next = base.transitionCustomerReview(value, command, bounds)
      const appended = command.action === 'submit'
      const newCount = state.revisionCount + (appended ? 1 : 0)
      check(Number.isSafeInteger(newCount), 'version-overflow')
      const ids = appended ? [...numbers, newCount] : numbers
      const expand = number => number === null ? null : ids[number - 1]
      const expanded = { ...next, revisionCount: newCount,
        pendingRevision: expand(next.pendingRevision), publishedRevision: expand(next.publishedRevision),
        revisions: next.revisions.map(revision => ({ ...revision, revision: expand(revision.revision) })) }
      const relevant = revisionNumbers(expanded)
      expanded.revisions = expanded.revisions.filter(revision => relevant.includes(revision.revision))
      compact(expanded)
      return expanded
    },
    projectPublishedCustomerReview: state => {
      const result = base.projectPublishedCustomerReview(compact(state).value)
      return result && { ...result, publishedRevision: state.publishedRevision }
    },
    customerReviewRatingContribution: contribution,
    customerReviewRatingDelta: (before, after) => {
      check(before.businessId === after.businessId && before.authorUid === after.authorUid
        && before.publicReviewId === after.publicReviewId, 'review-identity-mismatch')
      const old = contribution(before); const next = contribution(after)
      return { sum: next.sum - old.sum, count: next.count - old.count }
    },
  }
}
