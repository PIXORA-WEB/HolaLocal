import { useEffect, useRef } from 'react'

function AccessibleDialog({
  ariaDescribedBy,
  ariaLabelledBy,
  children,
  className = '',
  closeDisabled = false,
  onClose,
  open,
}) {
  const dialogRef = useRef(null)
  const returnFocusRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
      returnFocusRef.current?.focus?.()
    }
  }, [open])

  useEffect(() => () => {
    returnFocusRef.current?.focus?.()
  }, [])

  function requestClose() {
    if (!closeDisabled) onClose()
  }

  return (
    <dialog
      aria-describedby={ariaDescribedBy}
      aria-labelledby={ariaLabelledBy}
      className={className}
      onCancel={(event) => {
        event.preventDefault()
        requestClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
      ref={dialogRef}
    >
      {children}
    </dialog>
  )
}

export default AccessibleDialog
