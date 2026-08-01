import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  locationDisplayLabel,
  searchLaunchLocations,
} from '../../utils/locations.js'
import FormFieldError from '../common/FormFieldError.jsx'

function LocationCombobox({
  error = '',
  inputValue,
  label,
  onInputChange,
  onSelect,
  selectedLocationId = '',
}) {
  const { t } = useTranslation()
  const generatedId = useId()
  const inputId = `${generatedId}-input`
  const listboxId = `${generatedId}-listbox`
  const instructionsId = `${generatedId}-instructions`
  const errorId = `${generatedId}-error`
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const results = useMemo(
    () => searchLaunchLocations(inputValue).slice(0, 12),
    [inputValue],
  )

  function select(location) {
    onSelect(location)
    setOpen(false)
    setActiveIndex(0)
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((current) => {
        const direction = event.key === 'ArrowDown' ? 1 : -1
        return (current + direction + results.length) % Math.max(results.length, 1)
      })
    } else if (event.key === 'Enter' && open && results[activeIndex]) {
      event.preventDefault()
      select(results[activeIndex])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="location-combobox">
      <label htmlFor={inputId}>{label}</label>
      <p id={instructionsId}>{t('business.form.location.primaryInstruction')}</p>
      <div className="location-combobox__input">
        <input
          aria-activedescendant={open && results[activeIndex] ? `${generatedId}-option-${activeIndex}` : undefined}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-describedby={`${instructionsId}${error ? ` ${errorId}` : ''}`}
          aria-expanded={open}
          aria-invalid={Boolean(error)}
          autoComplete="off"
          id={inputId}
          onChange={(event) => {
            onInputChange(event.target.value)
            setActiveIndex(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          role="combobox"
          type="text"
          value={inputValue}
        />
        {inputValue && (
          <button
            aria-label={t('business.form.location.clearPrimary')}
            onClick={() => {
              onInputChange('')
              setOpen(false)
            }}
            type="button"
          >
            ×
          </button>
        )}
      </div>
      {open && (
        <ul className="location-combobox__listbox" id={listboxId} role="listbox">
          {results.length > 0 ? results.map((location, index) => (
            <li
              aria-selected={location.id === selectedLocationId}
              className={index === activeIndex ? 'is-active' : ''}
              id={`${generatedId}-option-${index}`}
              key={location.id}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => select(location)}
              role="option"
            >
              {locationDisplayLabel(location)}
            </li>
          )) : (
            <li className="location-combobox__empty" role="option" aria-disabled="true">
              {t('business.form.location.noAreaResults')}
            </li>
          )}
        </ul>
      )}
      <FormFieldError id={errorId} message={error} />
    </div>
  )
}

export default LocationCombobox
