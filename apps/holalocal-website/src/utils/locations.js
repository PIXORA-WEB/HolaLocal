function normalizeAlias(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase()
}

export function normalizeLocationSearchText(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return ''
  return normalizeAlias(value)
}

export const provinceOptions = [
  { value: 'malaga', labelKey: 'locations.provinces.malaga', defaultLabel: 'Málaga province' },
  { value: 'cadiz', labelKey: 'locations.provinces.cadiz', defaultLabel: 'Cádiz province' },
  { value: 'gibraltar', labelKey: 'locations.provinces.gibraltar', defaultLabel: 'Gibraltar' },
  { value: 'other', labelKey: 'common.other', defaultLabel: 'Other' },
]

export const countryOptions = [
  { value: 'ES', labelKey: 'locations.countries.ES', defaultLabel: 'Spain' },
  { value: 'GI', labelKey: 'locations.countries.GI', defaultLabel: 'Gibraltar' },
]

export const serviceAreaLabels = {
  malaga: 'Málaga', torremolinos: 'Torremolinos', benalmadena: 'Benalmádena',
  'arroyo-de-la-miel': 'Arroyo de la Miel', fuengirola: 'Fuengirola', mijas: 'Mijas',
  'mijas-costa': 'Mijas Costa', 'la-cala-de-mijas': 'La Cala de Mijas', calahonda: 'Calahonda',
  marbella: 'Marbella', 'puerto-banus': 'Puerto Banús', 'san-pedro-de-alcantara': 'San Pedro de Alcántara',
  benahavis: 'Benahavís', estepona: 'Estepona', casares: 'Casares', manilva: 'Manilva',
  sabinillas: 'Sabinillas', duquesa: 'Duquesa', nerja: 'Nerja', torrox: 'Torrox',
  'rincon-de-la-victoria': 'Rincón de la Victoria', 'velez-malaga': 'Vélez-Málaga',
  'alhaurin-de-la-torre': 'Alhaurín de la Torre', 'alhaurin-el-grande': 'Alhaurín el Grande',
  cartama: 'Cártama', coin: 'Coín', ojen: 'Ojén', 'la-linea-de-la-concepcion': 'La Línea de la Concepción',
  'santa-margarita': 'Santa Margarita', 'san-roque': 'San Roque', sotogrande: 'Sotogrande',
  algeciras: 'Algeciras', 'los-barrios': 'Los Barrios', tarifa: 'Tarifa',
  'jimena-de-la-frontera': 'Jimena de la Frontera', 'castellar-de-la-frontera': 'Castellar de la Frontera',
  gibraltar: 'Gibraltar',
}

const areaGroups = {
  malaga: [
    'malaga', 'torremolinos', 'benalmadena', 'arroyo-de-la-miel', 'fuengirola', 'mijas',
    'mijas-costa', 'la-cala-de-mijas', 'calahonda', 'marbella', 'puerto-banus',
    'san-pedro-de-alcantara', 'benahavis', 'estepona', 'casares', 'manilva', 'sabinillas',
    'duquesa', 'nerja', 'torrox', 'rincon-de-la-victoria', 'velez-malaga',
    'alhaurin-de-la-torre', 'alhaurin-el-grande', 'cartama', 'coin', 'ojen',
  ],
  cadiz: [
    'la-linea-de-la-concepcion', 'santa-margarita', 'san-roque', 'sotogrande', 'algeciras',
    'los-barrios', 'tarifa', 'jimena-de-la-frontera', 'castellar-de-la-frontera',
  ],
  gibraltar: ['gibraltar'],
}

export const serviceAreaGroupLabels = {
  malaga: 'Málaga province / Costa del Sol',
  cadiz: 'Cádiz province / Campo de Gibraltar',
  gibraltar: 'Gibraltar',
  other: 'Other',
}

export const serviceAreaOptions = [
  ...Object.entries(areaGroups).flatMap(([group, ids]) => ids.map((value) => ({
    value,
    group,
    labelKey: `locations.areas.${value}`,
    defaultLabel: serviceAreaLabels[value],
  }))),
  { value: 'other', group: 'other', labelKey: 'common.other', defaultLabel: 'Other' },
]

const provinceAliases = new Map([
  ['malaga', 'malaga'], ['málaga', 'malaga'], ['cadiz', 'cadiz'], ['cádiz', 'cadiz'],
  ['gibraltar', 'gibraltar'], ['other', 'other'],
].map(([alias, value]) => [normalizeAlias(alias), value]))

const areaAliases = new Map(
  Object.entries(serviceAreaLabels).flatMap(([value, label]) => [
    [normalizeAlias(value), value],
    [normalizeAlias(label), value],
  ]),
)
areaAliases.set('other', 'other')

export function normalizeProvinceId(value) {
  return provinceAliases.get(normalizeAlias(value)) ?? value
}

export function normalizeCountryCode(value) {
  const normalized = normalizeAlias(value)
  if (normalized === 'es' || normalized === 'spain' || normalized === 'espana') return 'ES'
  if (normalized === 'gi' || normalized === 'gibraltar') return 'GI'
  return String(value ?? '').toUpperCase()
}

export function normalizeServiceAreaId(value) {
  return areaAliases.get(normalizeAlias(value)) ?? value
}

export function getServiceAreaLabel(value, translate) {
  const normalized = normalizeServiceAreaId(value)
  if (normalized === 'other') {
    return translate('common.other', { defaultValue: 'Other' })
  }
  const canonicalLabel = serviceAreaLabels[normalized]
  if (!canonicalLabel) return typeof value === 'string' ? value : ''
  return translate(`locations.areas.${normalized}`, { defaultValue: canonicalLabel })
}

export function serviceAreaMatchesSearch(option, query) {
  const normalizedQuery = normalizeLocationSearchText(query)
  if (!normalizedQuery) return true
  const canonicalLabel = serviceAreaLabels[option?.value] ?? option?.value
  return [option?.label, canonicalLabel]
    .some((value) => normalizeLocationSearchText(value).includes(normalizedQuery))
}

export function getProvinceLabel(value, translate) {
  const normalized = normalizeProvinceId(value)
  const option = provinceOptions.find((option) => option.value === normalized)
  return option
    ? translate(option.labelKey, { defaultValue: option.defaultLabel })
    : value
}

export function getServiceAreaGroupLabel(value, translate) {
  const defaultLabel = serviceAreaGroupLabels[value] ?? value
  return translate(`locations.groups.${value}`, { defaultValue: defaultLabel })
}
