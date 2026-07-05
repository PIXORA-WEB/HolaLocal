import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useAuthentication from '../../hooks/useAuthentication.js'
import { changeAppLanguage, LANGUAGE_STORAGE_KEY } from '../../i18n/index.js'
import {
  supportedUILanguages,
} from '../../utils/languages.js'
import SelectField from './SelectField.jsx'

function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const { updateUserProfile, user, userProfile } = useAuthentication()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const activeLanguage = i18n.resolvedLanguage?.split('-')[0] ?? 'en'
  const options = supportedUILanguages.map(({ code, flag, name }) => ({
    icon: flag,
    label: name,
    shortLabel: code.toUpperCase(),
    value: code,
  }))

  useEffect(() => {
    if (!user) return

    const preferredLocale = userProfile?.preferredLocale?.split('-')[0]
    if (!supportedUILanguages.some(({ code }) => code === preferredLocale) || preferredLocale === activeLanguage) return

    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, preferredLocale)
    void changeAppLanguage(preferredLocale)
  }, [activeLanguage, i18n, user, userProfile?.preferredLocale])

  async function handleLanguageChange(languageCode) {
    setError('')
    setSaving(true)

    try {
      if (user && userProfile?.preferredLocale !== languageCode) {
        await updateUserProfile({ preferredLocale: languageCode })
      }

      await changeAppLanguage(languageCode)
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode)
    } catch {
      setError(t('language.saveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SelectField
        ariaLabel={t('language.label')}
        className="select-field--compact"
        disabled={saving}
        onChange={(languageCode) => void handleLanguageChange(languageCode)}
        options={options}
        showLeadingIcon
        value={activeLanguage}
      />
      {error && <span className="visually-hidden" role="alert">{error}</span>}
    </>
  )
}

export default LanguageSwitcher
