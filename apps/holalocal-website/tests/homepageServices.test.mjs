import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildHomepageSearchHref,
  getHomepageServiceHref,
} from '../src/utils/homepageServices.js'

test('homepage service links use exact canonical service IDs', () => {
  for (const serviceId of ['plumber', 'cleaner', 'lawyer', 'personal-trainer', 'dog-walker']) {
    assert.equal(getHomepageServiceHref(serviceId), `/services?service=${serviceId}`)
  }
})

test('homepage service links do not create legacy category or group URLs', () => {
  assert.equal(getHomepageServiceHref('Plumbing'), '/services')
  assert.equal(getHomepageServiceHref('pets'), '/services')
  assert.doesNotMatch(getHomepageServiceHref('plumber'), /category=|group=/)
})

test('homepage search links omit absent, empty and whitespace-only filters', () => {
  assert.equal(buildHomepageSearchHref(), '/services')
  assert.equal(buildHomepageSearchHref({}), '/services')
  assert.equal(buildHomepageSearchHref({ searchTerm: '', area: '' }), '/services')
  assert.equal(buildHomepageSearchHref({ searchTerm: '  ', area: '\n\t' }), '/services')
})

test('homepage search links include only the supported nonblank filters', () => {
  assert.equal(buildHomepageSearchHref({ searchTerm: 'plumber' }), '/services?q=plumber')
  assert.equal(buildHomepageSearchHref({ area: 'Marbella' }), '/services?area=Marbella')
  assert.equal(
    buildHomepageSearchHref({ searchTerm: 'plumber', area: 'Marbella' }),
    '/services?q=plumber&area=Marbella',
  )
})

test('homepage search links trim outer whitespace and retain internal spaces', () => {
  const href = buildHomepageSearchHref({
    searchTerm: '  air conditioning  ',
    area: '  Nueva Andalucia  ',
  })
  const url = new URL(href, 'https://www.holalocal.example')

  assert.equal(url.pathname, '/services')
  assert.equal(url.searchParams.get('q'), 'air conditioning')
  assert.equal(url.searchParams.get('area'), 'Nueva Andalucia')
})

test('homepage search links round-trip meaningful Unicode and punctuation', () => {
  const searchTerm = "plumber & décor d'intérieur"
  const area = 'Málaga 東京 Київ'
  const href = buildHomepageSearchHref({ searchTerm, area })
  const url = new URL(href, 'https://www.holalocal.example')

  assert.equal(url.pathname, '/services')
  assert.equal(url.searchParams.get('q'), searchTerm)
  assert.equal(url.searchParams.get('area'), area)
})

test('homepage search links do not mutate input or introduce unsupported parameters', () => {
  const filters = Object.freeze({
    searchTerm: '  cleaner  ',
    area: '  Estepona  ',
    service: 'cleaner',
    category: 'Cleaning',
    language: 'en',
    group: 'home-property',
    latitude: 36.427,
    autocomplete: true,
  })
  const href = buildHomepageSearchHref(filters)
  const url = new URL(href, 'https://www.holalocal.example')

  assert.ok(href.startsWith('/services'))
  assert.deepEqual(filters, {
    searchTerm: '  cleaner  ',
    area: '  Estepona  ',
    service: 'cleaner',
    category: 'Cleaning',
    language: 'en',
    group: 'home-property',
    latitude: 36.427,
    autocomplete: true,
  })
  assert.deepEqual([...url.searchParams.keys()], ['q', 'area'])
  assert.equal(url.searchParams.get('q'), 'cleaner')
  assert.equal(url.searchParams.get('area'), 'Estepona')
})
