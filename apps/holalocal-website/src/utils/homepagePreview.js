export const HOMEPAGE_PREVIEW_LIMIT = 3

export function buildHomepagePreviewBusinesses(
  liveBusinesses,
  exampleBusinesses,
  directoryStatus,
  limit = HOMEPAGE_PREVIEW_LIMIT,
) {
  const live = directoryStatus === 'success' ? liveBusinesses.slice(0, limit) : []
  return [
    ...live,
    ...exampleBusinesses.slice(0, Math.max(0, limit - live.length)),
  ].slice(0, limit)
}

export function boundCarouselIndex(index, itemCount) {
  return Math.min(Math.max(0, index), Math.max(0, itemCount - 1))
}
