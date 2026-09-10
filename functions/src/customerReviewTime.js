// Serializable, lossless Firestore timestamp parts. No clock or SDK dependency.
export function reviewTime(value) {
  if (!value || !Number.isInteger(value.seconds) || value.seconds < -62135596800 || value.seconds > 253402300799
    || !Number.isInteger(value.nanoseconds) || value.nanoseconds < 0 || value.nanoseconds > 999999999) {
    const error = new Error('invalid-review-timestamp'); error.code = error.message; throw error
  }
  return { seconds: value.seconds, nanoseconds: value.nanoseconds }
}
export function compareReviewTime(a, b) {
  a = reviewTime(a); b = reviewTime(b)
  return Math.sign(a.seconds - b.seconds) || Math.sign(a.nanoseconds - b.nanoseconds)
}
export function assertReviewDates(state, revisions) {
  const fail = () => { throw new Error('inconsistent-review-dates') }
  if (compareReviewTime(state.firstSubmittedAt, state.updatedAt) > 0) fail()
  for (const revision of revisions) {
    if (compareReviewTime(revision.submittedAt, state.firstSubmittedAt) < 0
      || compareReviewTime(revision.submittedAt, state.updatedAt) > 0) fail()
  }
  if (state.firstPublishedAt !== null && (compareReviewTime(state.firstSubmittedAt, state.firstPublishedAt) > 0
    || compareReviewTime(state.firstPublishedAt, state.updatedAt) > 0)) fail()
  if (state.publishedRevision !== null) {
    if (state.firstPublishedAt === null || compareReviewTime(state.firstPublishedAt, state.publishedVersionAt) > 0
      || compareReviewTime(state.publishedVersionAt, state.updatedAt) > 0
      || compareReviewTime(revisions.find(r => r.revision === state.publishedRevision)?.submittedAt, state.publishedVersionAt) > 0) fail()
  } else if (state.publishedVersionAt !== null) fail()
  if (state.pendingRevision !== null) {
    if (compareReviewTime(state.pendingSubmittedAt, revisions.find(r => r.revision === state.pendingRevision)?.submittedAt) !== 0) fail()
  } else if (state.pendingSubmittedAt !== null) fail()
}
