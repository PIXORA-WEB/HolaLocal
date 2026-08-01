import PlaceholderPage from '../components/common/PlaceholderPage.jsx'
import LegalSectionContent from '../components/common/LegalSectionContent.jsx'
import { useTranslation } from 'react-i18next'

function PrivacyPage() {
  const { t } = useTranslation()
  const sections = t('legalPages.privacy.sections', { returnObjects: true })

  return (
    <PlaceholderPage
      eyebrow={t('legalPages.version')}
      title={t('legalPages.privacy.title')}
      description={t('legalPages.privacy.description')}
    >
      <LegalSectionContent sections={Array.isArray(sections) ? sections : []} />
    </PlaceholderPage>
  )
}

export default PrivacyPage
