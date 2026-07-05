export const supportedUILanguages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pt', name: 'Portuguese' },
]

export const spokenLanguageOptions = [
  ...supportedUILanguages.map(({ name }) => name),
  'Other',
]

export function getLanguageCodeFromName(languageName) {
  return (
    supportedUILanguages.find(
      ({ name }) => name.toLowerCase() === languageName?.trim().toLowerCase(),
    )?.code ?? null
  )
}

export function getLanguageNameFromCode(languageCode) {
  const normalizedCode = languageCode?.split('-')[0].toLowerCase()
  return supportedUILanguages.find(({ code }) => code === normalizedCode)?.name ?? null
}
