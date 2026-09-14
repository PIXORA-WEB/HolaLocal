import { StrictMode, useLayoutEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import SelectField from '../../../src/components/common/SelectField.jsx'
import LanguageSwitcher from '../../../src/components/common/LanguageSwitcher.jsx'
import '../../../src/styles/tokens.css'
import '../../../src/styles/base.css'
import '../../../src/styles/global.css'
await i18n.use(initReactI18next).init({ lng: 'en', resources: { en: { translation: { language: { label: 'Language' } } }, es: { translation: { language: { label: 'Language' } } } }, fallbackLng: 'en' })
window.h = { changes: [], saves: [], user: { uid: 'synthetic-user' }, profile: {},
  changeLanguage: async code => { await i18n.changeLanguage(code); return code },
  save: updates => { window.h.saves.push(updates); return new Promise(resolve => { window.h.resolveSave = resolve }) },
}
export function Fixture() {
  const [disabled, setDisabled] = useState(new URLSearchParams(location.search).has('disabled'))
  const [value, setValue] = useState('a')
  window.h.disable = value => flushSync(() => setDisabled(value))
  window.h.setValue = setValue
  useLayoutEffect(() => {
    if (disabled && window.h.atCommit) window.h.atCommit()
  }, [disabled])
  return <main className="auth-card"><h1>Selector fixture</h1><button id="before">Before</button>
    {new URLSearchParams(location.search).has('consumer') ? <LanguageSwitcher /> : <SelectField
      ariaLabel="Choice" disabled={disabled} value={value}
      options={[{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }, { value: 'c', label: 'Gamma' }]}
      onChange={next => { window.h.changes.push(next); setValue(next); if (window.h.focusNextOnChange) document.getElementById('after').focus() }} />}
    <label htmlFor="after">Following field</label><input id="after" />
    <output id="value">{value}</output><button id="outside">Outside</button>
  </main>
}
createRoot(document.getElementById('root')).render(<StrictMode><Fixture /></StrictMode>)
