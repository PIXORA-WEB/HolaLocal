import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useAuthentication from '../../hooks/useAuthentication.js'
import { LANGUAGE_STORAGE_KEY } from '../../i18n/index.js'
import {
  getAuthenticatedUiLanguage,
  supportedUILanguages,
} from '../../utils/languages.js'

function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const { updateUserProfile, user, userProfile } = useAuthentication()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const activeLanguage = i18n.resolvedLanguage?.split('-')[0] ?? 'en'

  useEffect(() => {
    if (!user) return

    const preferredLanguageCode = getAuthenticatedUiLanguage(userProfile?.preferredLocale)
    if (!preferredLanguageCode || preferredLanguageCode === activeLanguage) return

    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, preferredLanguageCode)
    void i18n.changeLanguage(preferredLanguageCode)
  }, [activeLanguage, i18n, user, userProfile?.preferredLocale])

  async function handleLanguageChange(event) {
    const languageCode = event.target.value
    setError('')
    setSaving(true)

    try {
      if (user && userProfile?.preferredLocale !== languageCode) {
        await updateUserProfile({ preferredLocale: languageCode })
      }

      await i18n.changeLanguage(languageCode)
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode)
    } catch {
      setError('Unable to save language preference.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="language-switcher">
      <label className="visually-hidden" htmlFor="ui-language">{t('language.label')}</label>
      <select
        aria-label={t('language.label')}
        disabled={saving}
        id="ui-language"
        onChange={handleLanguageChange}
        value={activeLanguage}
      >
        {supportedUILanguages.map(({ code, name }) => (
          <option key={code} value={code}>{name}</option>
        ))}
      </select>
      {error && <span className="visually-hidden" role="alert">{error}</span>}
    </div>
  )
}

export default LanguageSwitcher
