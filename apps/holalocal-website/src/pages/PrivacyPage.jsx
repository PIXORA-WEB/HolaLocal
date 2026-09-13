import { CURRENT_PRIVACY_VERSION, CURRENT_PRIVACY_EFFECTIVE_DATE } from '../utils/policies.js'
import AnalyticsPrivacy from '../components/common/AnalyticsPrivacy.jsx'
import PlaceholderPage from '../components/common/PlaceholderPage.jsx'
import LegalSectionContent from '../components/common/LegalSectionContent.jsx'
import { useTranslation } from 'react-i18next'

function PrivacyPage() {
  const { t } = useTranslation()
  const sections = t('legalPages.privacy.sections', { returnObjects: true })

  return (
    <PlaceholderPage
      eyebrow={`${t('legalPages.revisionNotice')} · ${CURRENT_PRIVACY_VERSION}${CURRENT_PRIVACY_EFFECTIVE_DATE ? ` · ${CURRENT_PRIVACY_EFFECTIVE_DATE}` : ''}`}
      title={t('legalPages.privacy.title')}
      description={t('legalPages.privacy.description')}
    >
      <AnalyticsPrivacy />
      <LegalSectionContent title={t('legalPages.privacy.title')} sections={Array.isArray(sections) ? sections : []} />
    </PlaceholderPage>
  )
}

export default PrivacyPage
