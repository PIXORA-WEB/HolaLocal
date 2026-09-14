import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  const rootRef = useRef(null)
  const listRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const results = useMemo(
    () => searchLaunchLocations(inputValue).slice(0, 12),
    [inputValue],
  )

  // Parent-driven filtering can change results without an input event.
  const visibleActiveIndex = Math.min(activeIndex, Math.max(0, results.length - 1))

  useEffect(() => {
    if (!open) return undefined
    const ownerDocument = rootRef.current.ownerDocument
    function dismissOutside(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    ownerDocument.addEventListener('pointerdown', dismissOutside, true)
    return () => ownerDocument.removeEventListener('pointerdown', dismissOutside, true)
  }, [open])

  useLayoutEffect(() => {
    const list = listRef.current
    const option = list?.children[visibleActiveIndex]
    if (!open || !results.length || !option) return
    const listTop = list.getBoundingClientRect().top + list.clientTop
    const optionBounds = option.getBoundingClientRect()
    // Scroll the suggestion list only; scrollIntoView can move ancestor/page scrollers.
    if (optionBounds.top < listTop) list.scrollTop += optionBounds.top - listTop
    else if (optionBounds.bottom > listTop + list.clientHeight) {
      list.scrollTop += optionBounds.bottom - listTop - list.clientHeight
    }
  }, [open, results, visibleActiveIndex])

  function select(location) {
    onSelect(location)
    setOpen(false)
    setActiveIndex(0)
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex(() => {
        const direction = event.key === 'ArrowDown' ? 1 : -1
        return (visibleActiveIndex + direction + results.length) % Math.max(results.length, 1)
      })
    } else if (event.key === 'Enter' && open && results[visibleActiveIndex]) {
      event.preventDefault()
      select(results[visibleActiveIndex])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div
      className="location-combobox"
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <label htmlFor={inputId}>{label}</label>
      <p id={instructionsId}>{t('business.form.location.primaryInstruction')}</p>
      <div className="location-combobox__input">
        <input
          aria-activedescendant={open && results[visibleActiveIndex] ? `${generatedId}-option-${visibleActiveIndex}` : undefined}
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
        <ul className="location-combobox__listbox" ref={listRef} id={listboxId} role="listbox" tabIndex={-1}>
          {results.length > 0 ? results.map((location, index) => (
            <li
              aria-selected={location.id === selectedLocationId}
              className={index === visibleActiveIndex ? 'is-active' : ''}
              id={`${generatedId}-option-${index}`}
              key={location.id}
              onPointerDown={(event) => event.preventDefault()}
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
