import { useState } from 'react'

function PasswordField({
  autoComplete,
  error,
  hint,
  hideLabel,
  id,
  label,
  minLength,
  onChange,
  showLabel,
  value,
}) {
  const [visible, setVisible] = useState(false)
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="password-field">
      <div className="auth-form__label-row">
        <label htmlFor={id}>{label}</label>
        <button
          aria-controls={id}
          aria-pressed={visible}
          className="password-field__toggle"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          {visible ? hideLabel : showLabel}
        </button>
      </div>
      <input
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
        autoComplete={autoComplete}
        id={id}
        minLength={minLength}
        onChange={onChange}
        required
        type={visible ? 'text' : 'password'}
        value={value}
      />
      {hint && <p className="auth-form__hint" id={hintId}>{hint}</p>}
      {error && <p className="field-error" id={errorId} role="alert">{error}</p>}
    </div>
  )
}

export default PasswordField
