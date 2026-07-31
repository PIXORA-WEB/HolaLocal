function normalized(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase()
}

function entry(id, locality, municipality, regionCode, countryCode = 'ES', aliases = []) {
  return Object.freeze({
    id,
    locality,
    municipality,
    regionCode,
    countryCode,
    aliases: Object.freeze([...new Set([locality, municipality, ...aliases].filter(Boolean))]),
  })
}

export const LAUNCH_LOCATION_CATALOGUE = Object.freeze([
  entry('malaga', 'Málaga', 'Málaga', 'malaga'),
  entry('torremolinos', 'Torremolinos', 'Torremolinos', 'malaga'),
  entry('benalmadena', 'Benalmádena', 'Benalmádena', 'malaga'),
  entry('arroyo-de-la-miel', 'Arroyo de la Miel', 'Benalmádena', 'malaga'),
  entry('fuengirola', 'Fuengirola', 'Fuengirola', 'malaga'),
  entry('los-boliches', 'Los Boliches', 'Fuengirola', 'malaga'),
  entry('mijas', 'Mijas', 'Mijas', 'malaga'),
  entry('mijas-pueblo', 'Mijas Pueblo', 'Mijas', 'malaga'),
  entry('las-lagunas-de-mijas', 'Las Lagunas de Mijas', 'Mijas', 'malaga', 'ES', ['Las Lagunas']),
  entry('mijas-costa', 'Mijas Costa', 'Mijas', 'malaga'),
  entry('la-cala-de-mijas', 'La Cala de Mijas', 'Mijas', 'malaga'),
  entry('calahonda', 'Calahonda', 'Mijas', 'malaga'),
  entry('riviera-del-sol', 'Riviera del Sol', 'Mijas', 'malaga'),
  entry('el-faro', 'El Faro', 'Mijas', 'malaga'),
  entry('marbella', 'Marbella', 'Marbella', 'malaga'),
  entry('elviria', 'Elviria', 'Marbella', 'malaga'),
  entry('cabopino', 'Cabopino', 'Marbella', 'malaga'),
  entry('nueva-andalucia', 'Nueva Andalucía', 'Marbella', 'malaga'),
  entry('puerto-banus', 'Puerto Banús', 'Marbella', 'malaga'),
  entry('san-pedro-de-alcantara', 'San Pedro de Alcántara', 'Marbella', 'malaga', 'ES', ['San Pedro']),
  entry('guadalmina', 'Guadalmina', 'Marbella', 'malaga'),
  entry('benahavis', 'Benahavís', 'Benahavís', 'malaga'),
  entry('estepona', 'Estepona', 'Estepona', 'malaga'),
  entry('cancelada', 'Cancelada', 'Estepona', 'malaga'),
  entry('el-paraiso', 'El Paraíso', 'Estepona', 'malaga'),
  entry('casares', 'Casares', 'Casares', 'malaga'),
  entry('casares-costa', 'Casares Costa', 'Casares', 'malaga'),
  entry('manilva', 'Manilva', 'Manilva', 'malaga'),
  entry('san-luis-de-sabinillas', 'San Luis de Sabinillas', 'Manilva', 'malaga', 'ES', ['Sabinillas']),
  entry('sabinillas', 'Sabinillas', 'Manilva', 'malaga'),
  entry('la-duquesa', 'La Duquesa', 'Manilva', 'malaga', 'ES', ['Duquesa']),
  entry('puerto-de-la-duquesa', 'Puerto de la Duquesa', 'Manilva', 'malaga', 'ES', ['Duquesa']),
  entry('nerja', 'Nerja', 'Nerja', 'malaga'),
  entry('torrox', 'Torrox', 'Torrox', 'malaga'),
  entry('rincon-de-la-victoria', 'Rincón de la Victoria', 'Rincón de la Victoria', 'malaga'),
  entry('velez-malaga', 'Vélez-Málaga', 'Vélez-Málaga', 'malaga'),
  entry('alhaurin-de-la-torre', 'Alhaurín de la Torre', 'Alhaurín de la Torre', 'malaga'),
  entry('alhaurin-el-grande', 'Alhaurín el Grande', 'Alhaurín el Grande', 'malaga'),
  entry('cartama', 'Cártama', 'Cártama', 'malaga'),
  entry('coin', 'Coín', 'Coín', 'malaga'),
  entry('ojen', 'Ojén', 'Ojén', 'malaga'),
  entry('la-linea-de-la-concepcion', 'La Línea de la Concepción', 'La Línea de la Concepción', 'cadiz', 'ES', ['La Linea']),
  entry('santa-margarita-la-linea', 'Santa Margarita', 'La Línea de la Concepción', 'cadiz', 'ES', [
    'Santa Margarita, La Linea de la Concepcion',
    'Santa Margarita, La Línea de la Concepción',
  ]),
  entry('alcaidesa', 'Alcaidesa', 'San Roque', 'cadiz', 'ES', ['La Alcaidesa']),
  entry('san-roque', 'San Roque', 'San Roque', 'cadiz'),
  entry('sotogrande', 'Sotogrande', 'San Roque', 'cadiz'),
  entry('sotogrande-costa', 'Sotogrande Costa', 'San Roque', 'cadiz'),
  entry('sotogrande-alto', 'Sotogrande Alto', 'San Roque', 'cadiz'),
  entry('pueblo-nuevo-de-guadiaro', 'Pueblo Nuevo de Guadiaro', 'San Roque', 'cadiz', 'ES', ['Pueblo Nuevo']),
  entry('guadiaro', 'Guadiaro', 'San Roque', 'cadiz'),
  entry('torreguadiaro', 'Torreguadiaro', 'San Roque', 'cadiz'),
  entry('san-enrique-de-guadiaro', 'San Enrique de Guadiaro', 'San Roque', 'cadiz', 'ES', ['San Enrique']),
  entry('algeciras', 'Algeciras', 'Algeciras', 'cadiz'),
  entry('los-barrios', 'Los Barrios', 'Los Barrios', 'cadiz'),
  entry('palmones', 'Palmones', 'Los Barrios', 'cadiz'),
  entry('tarifa', 'Tarifa', 'Tarifa', 'cadiz'),
  entry('jimena-de-la-frontera', 'Jimena de la Frontera', 'Jimena de la Frontera', 'cadiz'),
  entry('castellar-de-la-frontera', 'Castellar de la Frontera', 'Castellar de la Frontera', 'cadiz'),
  entry('san-martin-del-tesorillo', 'San Martín del Tesorillo', 'San Martín del Tesorillo', 'cadiz'),
  entry('gibraltar', 'Gibraltar', 'Gibraltar', 'gibraltar', 'GI'),
])

export function normalizeLocationText(value) {
  return normalized(value)
}

export function locationDisplayLabel(location) {
  if (!location) return ''
  return location.municipality && normalized(location.municipality) !== normalized(location.locality)
    ? `${location.locality} — ${location.municipality}`
    : location.locality
}

export function searchLaunchLocations(query) {
  const search = normalized(query)
  if (!search) return [...LAUNCH_LOCATION_CATALOGUE]
  return LAUNCH_LOCATION_CATALOGUE.filter((location) => (
    [location.id, location.locality, location.municipality, locationDisplayLabel(location), ...location.aliases]
      .some((value) => normalized(value).includes(search))
  ))
}

export function resolveLaunchLocation(value) {
  const search = normalized(value)
  if (!search) return null
  const idMatch = LAUNCH_LOCATION_CATALOGUE.find((location) => normalized(location.id) === search)
  if (idMatch) return idMatch
  const localityMatches = LAUNCH_LOCATION_CATALOGUE.filter(
    (location) => normalized(location.locality) === search,
  )
  if (localityMatches.length === 1) return localityMatches[0]
  const displayMatches = LAUNCH_LOCATION_CATALOGUE.filter(
    (location) => normalized(locationDisplayLabel(location)) === search,
  )
  if (displayMatches.length === 1) return displayMatches[0]
  const aliasMatches = LAUNCH_LOCATION_CATALOGUE.filter((location) => (
    location.aliases.some((candidate) => normalized(candidate) === search)
  ))
  return aliasMatches.length === 1 ? aliasMatches[0] : null
}

function normalizedRegion(value) {
  const region = normalized(value).replace(/\s+province$/, '')
  if (region === 'malaga' || region === 'cadiz' || region === 'gibraltar') return region
  return region
}

export function validateBusinessLocation(business = {}, options = {}) {
  const location = business.location && typeof business.location === 'object'
    ? business.location
    : {}
  const primary = resolveLaunchLocation(location.locality)
  const selectionRequired = Object.hasOwn(options, 'selectedPrimaryLocationId')
  const selectedPrimary = selectionRequired
    ? resolveLaunchLocation(options.selectedPrimaryLocationId)
    : primary
  const primarySelected = Boolean(
    primary
    && selectedPrimary
    && selectedPrimary.id === primary.id
    && normalizedRegion(location.region) === primary.regionCode
    && normalized(location.countryCode) === normalized(primary.countryCode),
  )
  const serviceAreas = Array.isArray(business.serviceAreas) ? business.serviceAreas : []
  const unresolvedServiceAreas = serviceAreas.filter((area) => !resolveLaunchLocation(area))

  return Object.freeze({
    primary,
    primarySelected,
    serviceAreasValid: serviceAreas.length > 0 && unresolvedServiceAreas.length === 0,
    unresolvedServiceAreas: Object.freeze(unresolvedServiceAreas),
    valid: primarySelected && serviceAreas.length > 0 && unresolvedServiceAreas.length === 0,
  })
}
