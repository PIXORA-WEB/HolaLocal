import { useTranslation } from 'react-i18next'

function RecoveryMessage({
  actionLabel,
  actionPending = false,
  message,
  onAction,
  onRetry,
}) {
  const { t } = useTranslation()
  const action = onAction ?? onRetry

  return (
    <div className="form-message form-message--error recovery-message" role="alert">
      <p>{message || t('common.requestFailed')}</p>
      {action && (
        <button
          aria-busy={actionPending || undefined}
          className="button button--secondary"
          disabled={actionPending}
          onClick={action}
          type="button"
        >
          {actionLabel || t('common.retry')}
        </button>
      )}
    </div>
  )
}

export default RecoveryMessage
