import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import SelectField from '../../../src/components/common/SelectField.jsx'
import DatePicker from '../../../src/components/common/DatePicker.jsx'
import i18n from '../../../src/i18n/index.js'
import '../../../src/styles/tokens.css'
import '../../../src/styles/base.css'
import '../../../src/styles/global.css'
await i18n.changeLanguage('en')
export default function Fixture() {
  const params = new URLSearchParams(location.search)
  const [invalid, setInvalid] = useState(!['valid', 'disabled-valid'].includes(params.get('state')))
  const disabled = params.get('state').startsWith('disabled')
  const [selection, setSelection] = useState('one'), [date, setDate] = useState('2026-09-14')
  window.controlFixture = { setInvalid, selection, date }
  return <main><button id="before" type="button">Before control</button>
    <fieldset disabled={disabled && params.get('control') === 'date'}>
      {params.get('control') === 'select' ? <SelectField id="tested-select" ariaLabel="Synthetic choice" ariaInvalid={invalid} ariaDescribedBy={invalid ? 'test-error' : undefined} disabled={disabled} className={params.get('variant') === 'form' ? 'select-field--form' : ''} value={selection} onChange={setSelection} options={[{ value: 'one', label: 'First choice' }, { value: 'two', label: 'Second choice' }]} /> : <DatePicker label="Synthetic date" value={date} today="2026-09-14" onChange={setDate} ariaInvalid={invalid} ariaDescribedBy={invalid ? 'test-error' : undefined} />}
      {invalid && <p id="test-error" role="alert">Synthetic validation error</p>}
    </fieldset><button id="after" type="button">After control</button></main>
}
createRoot(document.getElementById('root')).render(<Fixture />)
