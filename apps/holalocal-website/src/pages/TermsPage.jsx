import PlaceholderPage from '../components/common/PlaceholderPage.jsx'
import LegalSectionContent from '../components/common/LegalSectionContent.jsx'
import { useTranslation } from 'react-i18next'

function TermsPage() {
  const { t } = useTranslation()
  const sections = t('legalPages.terms.sections', { returnObjects: true })

  return (
    <PlaceholderPage
      eyebrow={t('legalPages.version')}
      title={t('legalPages.terms.title')}
      description={t('legalPages.terms.description')}
    >
      <LegalSectionContent sections={Array.isArray(sections) ? sections : []} />
    </PlaceholderPage>
  )
}

export default TermsPage
