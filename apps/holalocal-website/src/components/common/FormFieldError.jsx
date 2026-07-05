function FormFieldError({ id, message }) {
  if (!message) return null
  return <p className="field-error" id={id} role="alert">{message}</p>
}

export default FormFieldError
