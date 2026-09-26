import {
  CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_EFFECTIVE_DATE, CURRENT_TERMS_EFFECTIVE_DATE,
  SUPPORTED_PRIVACY_VERSIONS, SUPPORTED_TERMS_VERSIONS,
} from './legalConsent.js'

export const LEGAL_PUBLICATION_PATH = 'legalPublications/current'
export const NOTICE_INTRODUCTION = Object.freeze({ privacy: '1.1', terms: '1.1' })
export const BUNDLED_LEGAL_PUBLICATION = Object.freeze({
  privacyVersion: CURRENT_PRIVACY_VERSION, privacyEffectiveDate: CURRENT_PRIVACY_EFFECTIVE_DATE,
  termsVersion: CURRENT_TERMS_VERSION, termsEffectiveDate: CURRENT_TERMS_EFFECTIVE_DATE,
})
const order = { privacy: SUPPORTED_PRIVACY_VERSIONS, terms: SUPPORTED_TERMS_VERSIONS }
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const time = Date.parse(value + 'T00:00:00Z')
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
}

// Factory permits bounded synthetic release fixtures. Production uses the default contract.
export function createLegalNoticeContract(versions = order, bundled = BUNDLED_LEGAL_PUBLICATION) {
  function publication(value) {
    if (!object(value)) return null
    if (Object.keys(value).sort().join() !== Object.keys(BUNDLED_LEGAL_PUBLICATION).sort().join()) return null
    for (const kind of ['privacy', 'terms']) {
      const index = versions[kind].indexOf(value[kind + 'Version'])
      if (index < versions[kind].indexOf(bundled[kind + 'Version']) || index < 0
        || !validDate(value[kind + 'EffectiveDate'])) return null
      if (value[kind + 'Version'] === bundled[kind + 'Version']
        && value[kind + 'EffectiveDate'] !== bundled[kind + 'EffectiveDate']) return null
    }
    return { ...value }
  }
  function pending(profile, rawPublication) {
    const published = publication(rawPublication)
    if (!object(profile) || !published) return null
    return Object.fromEntries(['privacy', 'terms'].map(kind => {
      const known = versions[kind].indexOf(profile[kind + 'NoticeVersion'])
      const current = versions[kind].indexOf(published[kind + 'Version'])
      const baseline = versions[kind].indexOf(NOTICE_INTRODUCTION[kind])
      // Unknown/malformed acknowledgement cannot suppress a real update.
      // A recognized newer acknowledgement survives a rolled-back registry.
      const seen = known < baseline ? baseline : known
      return [kind, current > seen]
    }))
  }
  function acknowledgement(profile, rawPublication, displayed) {
    const published = publication(rawPublication)
    if (!object(profile) || !published || !object(displayed)
      || !Object.keys(displayed).length
      || Object.keys(displayed).some(k => !['privacy', 'terms'].includes(k))) throw new Error('notice-unavailable')
    const update = {}
    for (const kind of Object.keys(displayed)) {
      if (displayed[kind] !== published[kind + 'Version']) throw new Error('notice-stale')
      const stored = versions[kind].indexOf(profile[kind + 'NoticeVersion'])
      const target = versions[kind].indexOf(displayed[kind])
      // Preserve newer recognized evidence independently; other documents may advance.
      if (stored < target) update[kind + 'NoticeVersion'] = displayed[kind]
    }
    return update
  }
  return { publication, pending, acknowledgement }
}
export const legalNoticeContract = createLegalNoticeContract()

// Only call for explicit new registration, never generic profile repair/recovery.
export function registrationNoticeBaseline(profile) {
  if (profile.privacyAccepted !== true || profile.termsAccepted !== true
    || profile.privacyVersion !== CURRENT_PRIVACY_VERSION || profile.termsVersion !== CURRENT_TERMS_VERSION) return {}
  return { privacyNoticeVersion: CURRENT_PRIVACY_VERSION, termsNoticeVersion: CURRENT_TERMS_VERSION }
}
