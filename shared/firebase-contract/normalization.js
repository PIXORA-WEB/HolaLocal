import { SUPPORTED_LANGUAGE_CODES } from './constants.js'
import { ISSUE_CODES, issue } from './issues.js'

function comparisonKey(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

function fnv1a(value, seed) {
  let hash = seed
  for (const character of value) {
    hash ^= character.codePointAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36).padStart(7, '0')
}

function customIdentifier(namespace, label) {
  // Preserve distinctions in unknown values. Diacritic-insensitive matching is
  // limited to known aliases; two unrecognised places must not be merged merely
  // because their labels look similar.
  const key = String(label ?? '').normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase()
  const readable = comparisonKey(label).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'value'
  const fingerprint = `${fnv1a(key, 0x811c9dc5)}${fnv1a(key, 0x9e3779b9)}`
  return `custom:${namespace}:${readable}:${fingerprint}`
}

const LANGUAGE_ALIASES = new Map(Object.entries({
  english: 'en', ingles: 'en', inglés: 'en', anglais: 'en', englisch: 'en',
  spanish: 'es', espanol: 'es', español: 'es', espagnol: 'es', spanisch: 'es',
  french: 'fr', francais: 'fr', français: 'fr', frances: 'fr', französisch: 'fr',
  german: 'de', deutsch: 'de', aleman: 'de', alemán: 'de', allemand: 'de',
  dutch: 'nl', nederlands: 'nl', neerlandes: 'nl', neerlandés: 'nl',
  portuguese: 'pt', portugues: 'pt', português: 'pt', portugais: 'pt',
  polish: 'pl', polski: 'pl', polaco: 'pl',
  romanian: 'ro', romana: 'ro', română: 'ro', rumano: 'ro',
  czech: 'cs', cestina: 'cs', čeština: 'cs', checo: 'cs',
  slovak: 'sk', slovencina: 'sk', slovenčina: 'sk', eslovaco: 'sk',
  hungarian: 'hu', magyar: 'hu', hungaro: 'hu', húngaro: 'hu',
  ukrainian: 'uk', українська: 'uk', ucraniano: 'uk',
  italian: 'it', italiano: 'it', italien: 'it',
  swedish: 'sv', svenska: 'sv', sueco: 'sv',
  danish: 'da', dansk: 'da', danes: 'da', danés: 'da',
  finnish: 'fi', suomi: 'fi', finlandes: 'fi', finlandés: 'fi',
  norwegian: 'no', norsk: 'no', noruego: 'no',
}).map(([label, code]) => [comparisonKey(label), code]))

const SERVICE_AREA_LABELS = Object.freeze({
  malaga: 'Málaga', torremolinos: 'Torremolinos', benalmadena: 'Benalmádena',
  'arroyo-de-la-miel': 'Arroyo de la Miel', fuengirola: 'Fuengirola', mijas: 'Mijas',
  'mijas-costa': 'Mijas Costa', 'la-cala-de-mijas': 'La Cala de Mijas', calahonda: 'Calahonda',
  marbella: 'Marbella', 'puerto-banus': 'Puerto Banús',
  'san-pedro-de-alcantara': 'San Pedro de Alcántara', benahavis: 'Benahavís',
  estepona: 'Estepona', casares: 'Casares', manilva: 'Manilva', sabinillas: 'Sabinillas',
  duquesa: 'Duquesa', nerja: 'Nerja', torrox: 'Torrox',
  'rincon-de-la-victoria': 'Rincón de la Victoria', 'velez-malaga': 'Vélez-Málaga',
  'alhaurin-de-la-torre': 'Alhaurín de la Torre', 'alhaurin-el-grande': 'Alhaurín el Grande',
  cartama: 'Cártama', coin: 'Coín', ojen: 'Ojén',
  'la-linea-de-la-concepcion': 'La Línea de la Concepción', 'santa-margarita': 'Santa Margarita',
  'san-roque': 'San Roque', sotogrande: 'Sotogrande', algeciras: 'Algeciras',
  'los-barrios': 'Los Barrios', tarifa: 'Tarifa',
  'jimena-de-la-frontera': 'Jimena de la Frontera',
  'castellar-de-la-frontera': 'Castellar de la Frontera', gibraltar: 'Gibraltar',
})

const SERVICE_AREA_ALIASES = new Map(Object.entries(SERVICE_AREA_LABELS).flatMap(([id, label]) => [
  [comparisonKey(id), id], [comparisonKey(label), id],
]))

export function isStandardLanguageCode(value) {
  return typeof value === 'string' && SUPPORTED_LANGUAGE_CODES.includes(value)
}

export function isCustomIdentifier(value, namespace) {
  return typeof value === 'string' && ['language', 'area'].includes(namespace) &&
    new RegExp(`^custom:${namespace}:[a-z0-9-]{1,32}:[a-z0-9]{14}$`).test(value)
}

export function normalizeLanguage(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return { value: null, issues: [issue(ISSUE_CODES.LANGUAGE_INVALID_VALUE)] }
  }
  const label = value.trim()
  const normalized = comparisonKey(label)
  const baseCode = normalized.split(/[-_]/)[0]
  const code = SUPPORTED_LANGUAGE_CODES.includes(baseCode) ? baseCode : LANGUAGE_ALIASES.get(normalized)
  if (code) return { value: { id: code, label, isCustom: false, source: label }, issues: [] }
  if (isCustomIdentifier(label, 'language')) {
    return { value: { id: label, label, isCustom: true, source: label }, issues: [] }
  }
  const id = customIdentifier('language', label)
  return {
    value: { id, label, isCustom: true, source: label },
    issues: [issue(ISSUE_CODES.LANGUAGE_UNKNOWN_CUSTOM, { identifier: id })],
  }
}

export function normalizeLanguages(values) {
  const source = Array.isArray(values) ? values : []
  const normalized = []
  const issues = []
  const seen = new Set()
  for (const rawValue of source) {
    const result = typeof rawValue === 'object' && rawValue !== null
      ? normalizeLanguage(rawValue.label ?? rawValue.id)
      : normalizeLanguage(rawValue)
    issues.push(...result.issues)
    if (!result.value) continue
    if (seen.has(result.value.id)) {
      issues.push(issue(ISSUE_CODES.LANGUAGE_DUPLICATE_REMOVED, { identifier: result.value.id }))
      continue
    }
    seen.add(result.value.id)
    normalized.push(result.value)
  }
  return { values: normalized, identifiers: normalized.map(({ id }) => id), issues }
}

export function normalizePrimaryLanguage(primaryLanguage, languages) {
  const normalizedLanguages = normalizeLanguages(languages)
  const primary = normalizeLanguage(primaryLanguage)
  if (primary.value && normalizedLanguages.identifiers.includes(primary.value.id)) {
    return { value: primary.value.id, languages: normalizedLanguages.values, issues: normalizedLanguages.issues }
  }
  const repaired = normalizedLanguages.identifiers[0] ?? null
  const issues = [...normalizedLanguages.issues]
  if (primaryLanguage !== undefined || repaired !== null) {
    issues.push(issue(ISSUE_CODES.LANGUAGE_PRIMARY_REPAIRED, { from: primary.value?.id ?? null, to: repaired }))
  }
  return { value: repaired, languages: normalizedLanguages.values, issues }
}

export function normalizeServiceArea(value, mapping = {}) {
  if (typeof value !== 'string' || !value.trim()) {
    return { value: null, issues: [issue(ISSUE_CODES.SERVICE_AREA_INVALID_VALUE)] }
  }
  const label = value.trim()
  const key = comparisonKey(label)
  const mappedId = mapping[key] ?? SERVICE_AREA_ALIASES.get(key)
  if (mappedId) return { value: { id: mappedId, label, isCustom: false, source: label }, issues: [] }
  if (isCustomIdentifier(label, 'area')) return { value: { id: label, label, isCustom: true, source: label }, issues: [] }
  const id = customIdentifier('area', label)
  return {
    value: { id, label, isCustom: true, source: label },
    issues: [issue(ISSUE_CODES.SERVICE_AREA_UNKNOWN_CUSTOM, { identifier: id })],
  }
}

export function normalizeServiceAreas(values, mapping = {}) {
  const normalized = []
  const issues = []
  const seen = new Set()
  for (const rawValue of Array.isArray(values) ? values : []) {
    const result = typeof rawValue === 'object' && rawValue !== null
      ? normalizeServiceArea(rawValue.label ?? rawValue.id, mapping)
      : normalizeServiceArea(rawValue, mapping)
    issues.push(...result.issues)
    if (!result.value) continue
    if (seen.has(result.value.id)) {
      issues.push(issue(ISSUE_CODES.SERVICE_AREA_DUPLICATE_REMOVED, { identifier: result.value.id }))
      continue
    }
    seen.add(result.value.id)
    normalized.push(result.value)
  }
  return { values: normalized, identifiers: normalized.map(({ id }) => id), issues }
}

export { SERVICE_AREA_LABELS }
