import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import {
  LAUNCH_LOCATION_CATALOGUE,
  locationDisplayLabel,
  primaryLocationInputState,
  primaryLocationSelectionState,
  resolveLaunchLocation,
  searchLaunchLocations,
  toggleServiceAreaSelection,
  validateBusinessLocation,
} from '../src/utils/locations.js'
import { getBusinessProfileCompletion } from '../src/utils/businessCompletion.js'

const requiredLaunchLocalities = [
  'Málaga', 'Torremolinos', 'Benalmádena', 'Arroyo de la Miel', 'Fuengirola',
  'Los Boliches', 'Mijas', 'Mijas Pueblo', 'Las Lagunas de Mijas', 'La Cala de Mijas',
  'Calahonda', 'Riviera del Sol', 'El Faro', 'Marbella', 'Elviria', 'Cabopino',
  'Nueva Andalucía', 'Puerto Banús', 'San Pedro de Alcántara', 'Guadalmina',
  'Benahavís', 'Estepona', 'Cancelada', 'El Paraíso', 'Casares', 'Casares Costa',
  'Manilva', 'San Luis de Sabinillas', 'Sabinillas', 'La Duquesa',
  'Puerto de la Duquesa', 'La Línea de la Concepción', 'Santa Margarita',
  'Alcaidesa', 'San Roque', 'Sotogrande', 'Sotogrande Costa', 'Sotogrande Alto',
  'Pueblo Nuevo de Guadiaro', 'Guadiaro', 'Torreguadiaro', 'San Enrique de Guadiaro',
  'Algeciras', 'Los Barrios', 'Palmones', 'Tarifa', 'Jimena de la Frontera',
  'Castellar de la Frontera', 'San Martín del Tesorillo', 'Gibraltar',
]

function completeBusiness(overrides = {}) {
  return {
    name: 'Local business',
    description: 'A complete business description.',
    primaryCategoryId: 'Cleaning',
    categoryIds: ['Cleaning'],
    languages: ['en'],
    primaryLanguage: 'en',
    contact: { preferredContactMethod: 'holalocal' },
    location: { locality: 'Santa Margarita', region: 'cadiz', countryCode: 'ES' },
    serviceAreas: ['sotogrande'],
    profilePhoto: { downloadUrl: 'https://example.invalid/logo.webp' },
    galleryImages: [{ downloadUrl: 'https://example.invalid/work.webp' }],
    ...overrides,
  }
}

test('launch catalogue includes every required Costa del Sol, Campo de Gibraltar, and Gibraltar locality', () => {
  const localities = new Set(LAUNCH_LOCATION_CATALOGUE.map(({ locality }) => locality))
  assert.deepEqual(requiredLaunchLocalities.filter((locality) => !localities.has(locality)), [])
})

test('combined free text remains invalid until the canonical suggestion is selected', () => {
  const typed = 'Santa Margarita, La Linea de la Concepcion'
  const resolved = resolveLaunchLocation(typed)
  assert.equal(resolved.id, 'santa-margarita-la-linea')

  const unselected = validateBusinessLocation(completeBusiness({
    location: { locality: typed, region: 'cadiz', countryCode: 'ES' },
  }), { selectedPrimaryLocationId: '' })
  assert.equal(unselected.primarySelected, false)

  const selectedState = primaryLocationSelectionState(resolved)
  assert.deepEqual(selectedState, {
    city: 'Santa Margarita',
    country: 'ES',
    primaryLocationId: 'santa-margarita-la-linea',
    province: 'cadiz',
  })
  assert.equal(validateBusinessLocation(completeBusiness({
    location: {
      locality: selectedState.city,
      region: selectedState.province,
      countryCode: selectedState.country,
    },
  }), { selectedPrimaryLocationId: selectedState.primaryLocationId }).valid, true)
})

test('location search is accent-insensitive and includes municipality and aliases', () => {
  assert.ok(searchLaunchLocations('Linea').some(({ id }) => id === 'la-linea-de-la-concepcion'))
  assert.ok(searchLaunchLocations('San Pedro').some(({ id }) => id === 'san-pedro-de-alcantara'))
  assert.ok(searchLaunchLocations('Marbella').some(({ id }) => id === 'elviria'))
  assert.ok(searchLaunchLocations('Sabinillas').some(({ id }) => id === 'san-luis-de-sabinillas'))
  assert.ok(searchLaunchLocations('Duquesa').some(({ id }) => id === 'puerto-de-la-duquesa'))
  assert.ok(searchLaunchLocations('Mijas').some(({ id }) => id === 'las-lagunas-de-mijas'))
  assert.equal(resolveLaunchLocation('Sabinillas')?.locality, 'Sabinillas')
})

test('editing selected text invalidates the primary selection', () => {
  assert.deepEqual(primaryLocationInputState('Santa Margarita, La Línea'), {
    city: 'Santa Margarita, La Línea',
    primaryLocationId: '',
  })
})

test('service-area selection is canonical, duplicate-safe, multi-select, and removable', () => {
  let values = toggleServiceAreaSelection([], 'Sotogrande')
  values = toggleServiceAreaSelection(values, 'Sabinillas')
  assert.deepEqual(values, ['sotogrande', 'sabinillas'])
  assert.deepEqual(toggleServiceAreaSelection(values, 'sotogrande'), ['sabinillas'])
  assert.deepEqual(toggleServiceAreaSelection(['sotogrande'], 'Unknown coast'), ['sotogrande'])
})

test('saved canonical and alias values hydrate while unknown values remain unresolved', () => {
  assert.equal(resolveLaunchLocation('Santa Margarita')?.id, 'santa-margarita-la-linea')
  assert.equal(resolveLaunchLocation('Santa Margarita, La Linea de la Concepcion')?.locality, 'Santa Margarita')
  assert.equal(resolveLaunchLocation('Unknown coast'), null)
})

test('completion and submission share canonical location validation', () => {
  const unresolved = completeBusiness({
    location: { locality: 'Unknown coast', region: 'cadiz', countryCode: 'ES' },
  })
  const completion = getBusinessProfileCompletion(unresolved)
  assert.equal(completion.items.find(({ key }) => key === 'serviceArea').complete, false)
  assert.equal(completion.ready, false)
  assert.notEqual(completion.percentage, 100)
  assert.equal(validateBusinessLocation(unresolved).valid, false)
})

test('public labels preserve canonical accents and useful municipality context', () => {
  assert.equal(
    locationDisplayLabel(resolveLaunchLocation('santa-margarita-la-linea')),
    'Santa Margarita — La Línea de la Concepción',
  )
})

test('editor uses the accessible combobox and the submission service uses the shared validator', async () => {
  const [editor, combobox, service] = await Promise.all([
    readFile(new URL('../src/pages/business/EditBusinessPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/business/LocationCombobox.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/businessService.js', import.meta.url), 'utf8'),
  ])
  assert.match(combobox, /role="combobox"/)
  assert.match(combobox, /role="listbox"/)
  assert.match(combobox, /ArrowDown/)
  assert.match(combobox, /ArrowUp/)
  assert.match(combobox, /event\.key === 'Enter'/)
  assert.match(combobox, /event\.key === 'Escape'/)
  assert.match(editor, /selectedPrimaryLocationId: form\.primaryLocationId/)
  assert.match(service, /validateBusinessLocation\(business\)/)
})
