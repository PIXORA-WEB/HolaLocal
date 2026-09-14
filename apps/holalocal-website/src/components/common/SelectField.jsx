import { useEffect, useId, useRef, useState } from 'react'

function SelectField({
  ariaLabel,
  ariaDescribedBy,
  ariaInvalid,
  className = '',
  disabled = false,
  id,
  onChange,
  options,
  showLeadingIcon = false,
  value,
}) {
  const generatedId = useId()
  const menuId = `${id || generatedId}-menu`
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const [open, setOpen] = useState(false)
  const menuOpen = open && !disabled
  // Reset stored intent as well as hiding the menu in this render. Re-enabling
  // must not revive an old popup, and no effect is needed to enforce disabling.
  if (disabled && open) setOpen(false)
  const activeOption = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!menuOpen) return undefined
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [menuOpen])

  useEffect(() => {
    if (menuOpen) menuRef.current?.querySelector('[aria-selected="true"]')?.focus()
  }, [menuOpen])

  function closeAndRestoreFocus() {
    setOpen(false)
    if (!disabled && !buttonRef.current?.disabled
      && rootRef.current?.contains(document.activeElement)) buttonRef.current?.focus()
  }

  function handleMenuKeyDown(event) {
    if (disabled || !menuOpen) return
    const optionButtons = [...menuRef.current.querySelectorAll('[role="option"]')]
    const currentIndex = optionButtons.indexOf(document.activeElement)
    let nextIndex

    if (event.key === 'ArrowDown') nextIndex = Math.min(currentIndex + 1, optionButtons.length - 1)
    else if (event.key === 'ArrowUp') nextIndex = Math.max(currentIndex - 1, 0)
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = optionButtons.length - 1
    else if (event.key === 'Escape') {
      event.preventDefault()
      closeAndRestoreFocus()
      return
    } else return

    event.preventDefault()
    optionButtons[nextIndex]?.focus()
  }

  return (
    <div
      className={`select-field${className ? ` ${className}` : ''}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      ref={rootRef}
    >
      <button
        aria-controls={menuId}
        aria-describedby={ariaDescribedBy}
        aria-expanded={menuOpen}
        aria-haspopup="listbox"
        aria-invalid={ariaInvalid}
        aria-label={ariaLabel}
        className="select-field__button"
        disabled={disabled}
        id={id}
        onClick={() => { if (!disabled) setOpen((current) => !current) }}
        onKeyDown={(event) => {
          if (disabled) return
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
          }
        }}
        ref={buttonRef}
        type="button"
      >
        {showLeadingIcon && activeOption?.icon && <span aria-hidden="true">{activeOption.icon}</span>}
        <span className="select-field__label">{activeOption?.label}</span>
        {activeOption?.shortLabel && <span className="select-field__code">{activeOption.shortLabel}</span>}
        <svg className="select-field__chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
      </button>
      <div
        aria-label={ariaLabel}
        className="select-field__menu"
        hidden={!menuOpen}
        id={menuId}
        onKeyDown={handleMenuKeyDown}
        ref={menuRef}
        role="listbox"
      >
        {options.map((option) => (
          <button
            aria-selected={option.value === value}
            className={option.value === value ? 'is-active' : ''}
            disabled={disabled}
            key={option.value}
            onClick={() => {
              if (disabled || !menuOpen) return
              onChange(option.value)
              closeAndRestoreFocus()
            }}
            role="option"
            type="button"
          >
            <span>{option.icon && <span aria-hidden="true">{option.icon} </span>}{option.label}</span>
            {option.value === value && <span aria-hidden="true">✓</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

export default SelectField
