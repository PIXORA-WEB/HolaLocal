import { useTranslation } from 'react-i18next'
import { openAnalyticsSettings } from '../../services/analyticsConsent.js'
export default function AnalyticsPrivacy() {
  const { t } = useTranslation()
  return <section id="optional-analytics" className="analytics-privacy" tabIndex={-1}>
    <h2>{t('analytics.title')}</h2>
    <p>{t('analytics.details')}</p>
    <p>{t('analytics.history')}</p>
    <p>{t('analytics.limits')}</p>
    <button className="button button--secondary" type="button" onClick={openAnalyticsSettings}>{t('analytics.settings')}</button>
  </section>
}
