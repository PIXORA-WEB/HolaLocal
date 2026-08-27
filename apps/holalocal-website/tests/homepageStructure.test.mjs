import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { SERVICE_TAXONOMY_GROUPS } from '../../../shared/firebase-contract/index.js'

const homeUrl = new URL('../src/pages/HomePage.jsx', import.meta.url)
const translationsUrl = new URL('../src/i18n/locales/homepagePlatformTranslations.js', import.meta.url)

test('homepage uses the six central groups and canonical service handoff', async () => {
  const source = await readFile(homeUrl, 'utf8')

  assert.equal(SERVICE_TAXONOMY_GROUPS.length, 6)
  assert.match(source, /SERVICE_TAXONOMY_GROUPS\.map\(\(group\) =>/)
  assert.match(source, /<Link key=\{group\.id\} to="\/services">/)
  assert.match(source, /getHomepageServiceHref\(serviceId\)/)
  assert.doesNotMatch(source, /\?group=|\?category=/)
})

test('homepage presents Services as live and Events and Community as coming soon', async () => {
  const source = await readFile(homeUrl, 'utf8')

  assert.match(source, /\{ key: 'services', live: true \}/)
  assert.match(source, /\{ key: 'events', live: false \}/)
  assert.match(source, /\{ key: 'community', live: false \}/)
  assert.doesNotMatch(source, /to="\/(events|community)"/)
})

test('homepage proposition contains no Places pillar or unsupported social proof', async () => {
  const [source, translations] = await Promise.all([
    readFile(homeUrl, 'utf8'),
    readFile(translationsUrl, 'utf8'),
  ])

  assert.doesNotMatch(`${source}\n${translations}`, /\bPlaces\b|\bplaces\b/)
  assert.doesNotMatch(`${source}\n${translations}`, /testimonial|thousands of|\d+\+ businesses|verified businesses/i)
})
