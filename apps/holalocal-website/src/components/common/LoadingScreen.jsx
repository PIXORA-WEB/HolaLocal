import { useTranslation } from 'react-i18next'

function LoadingScreen({ message }) {
  const { t } = useTranslation()
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <span className="loading-screen__spinner" aria-hidden="true" />
      <p>{message ?? t('common.loadingAccount')}</p>
    </div>
  )
}

export default LoadingScreen
