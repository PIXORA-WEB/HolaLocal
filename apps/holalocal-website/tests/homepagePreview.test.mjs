import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  boundCarouselIndex,
  buildHomepagePreviewBusinesses,
} from '../src/utils/homepagePreview.js'

const examples = [
  { businessId: 'example-0', isDemo: true },
  { businessId: 'example-1', isDemo: true },
  { businessId: 'example-2', isDemo: true },
]

const liveBusinesses = [
  { businessId: 'live-0' },
  { businessId: 'live-1' },
  { businessId: 'live-2' },
  { businessId: 'live-3' },
]

test('homepage preview stays populated with examples while loading and after failure', () => {
  for (const status of ['loading', 'error']) {
    const preview = buildHomepagePreviewBusinesses(liveBusinesses, examples, status)
    assert.deepEqual(preview, examples)
    assert.equal(preview.length, 3)
  }
})

test('homepage preview prioritizes live results and supplements only open positions', () => {
  assert.deepEqual(
    buildHomepagePreviewBusinesses(liveBusinesses.slice(0, 2), examples, 'success'),
    [liveBusinesses[0], liveBusinesses[1], examples[0]],
  )
  assert.deepEqual(
    buildHomepagePreviewBusinesses(liveBusinesses, examples, 'success'),
    liveBusinesses.slice(0, 3),
  )
})

test('homepage preview does not retain live results during a new request or failure', () => {
  const successful = buildHomepagePreviewBusinesses(liveBusinesses, examples, 'success')
  assert.equal(successful.some((business) => !business.isDemo), true)
  assert.equal(
    buildHomepagePreviewBusinesses(liveBusinesses, examples, 'loading').some(
      (business) => !business.isDemo,
    ),
    false,
  )
})

test('homepage carousel index is bounded whenever the result count changes', () => {
  assert.equal(boundCarouselIndex(2, 3), 2)
  assert.equal(boundCarouselIndex(4, 3), 2)
  assert.equal(boundCarouselIndex(-1, 3), 0)
  assert.equal(boundCarouselIndex(2, 0), 0)
})
