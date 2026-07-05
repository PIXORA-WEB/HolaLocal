import { useTranslation } from 'react-i18next'

function RecoveryMessage({ message, onRetry }) {
  const { t } = useTranslation()

  return (
    <div className="form-message form-message--error recovery-message" role="alert">
      <p>{message || t('common.requestFailed')}</p>
      {onRetry && (
        <button className="button button--secondary" onClick={onRetry} type="button">
          {t('common.retry')}
        </button>
      )}
    </div>
  )
}

export default RecoveryMessage
