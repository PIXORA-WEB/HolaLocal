// Canonical language metadata. UI availability and business spoken-language
// selection are separate exports so either can evolve without changing stored codes.
const languageCatalog = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'ro', name: 'Română', flag: '🇷🇴' },
  { code: 'cs', name: 'Čeština', flag: '🇨🇿' },
  { code: 'sk', name: 'Slovenčina', flag: '🇸🇰' },
  { code: 'hu', name: 'Magyar', flag: '🇭🇺' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
  { code: 'da', name: 'Dansk', flag: '🇩🇰' },
  { code: 'fi', name: 'Suomi', flag: '🇫🇮' },
  { code: 'no', name: 'Norsk', flag: '🇳🇴' },
]

const legacyLanguageNames = {
  english: 'en', spanish: 'es', french: 'fr', german: 'de', dutch: 'nl', portuguese: 'pt',
  polish: 'pl', romanian: 'ro', czech: 'cs', slovak: 'sk', hungarian: 'hu', ukrainian: 'uk',
  italian: 'it', swedish: 'sv', danish: 'da', finnish: 'fi', norwegian: 'no',
}

export const supportedUILanguages = languageCatalog

export const businessSpokenLanguages = languageCatalog.map(({ code, name }) => ({
  label: name,
  value: code,
}))

export const spokenLanguageOptions = [
  ...businessSpokenLanguages,
  { label: 'Other', value: 'other' },
]

export function getLanguageNameFromCode(languageCode) {
  const normalizedCode = languageCode?.split('-')[0].toLowerCase()
  return languageCatalog.find(({ code }) => code === normalizedCode)?.name ?? languageCode ?? ''
}

export function normalizeLanguageCode(language) {
  const normalized = String(language ?? '').trim().toLowerCase()
  return languageCatalog.find(({ code, name }) => code === normalized || name.toLowerCase() === normalized)?.code
    ?? legacyLanguageNames[normalized]
    ?? language
}

export function formatLanguageList(languageCodes) {
  return (languageCodes ?? []).map(getLanguageNameFromCode).join(' • ')
}
