import { CURRENT_TERMS_VERSION, CURRENT_TERMS_EFFECTIVE_DATE } from '../utils/policies.js'
import PlaceholderPage from '../components/common/PlaceholderPage.jsx'
import LegalSectionContent from '../components/common/LegalSectionContent.jsx'
import { useTranslation } from 'react-i18next'

function TermsPage() {
  const { t } = useTranslation()
  const sections = t('legalPages.terms.sections', { returnObjects: true })

  return (
    <PlaceholderPage
      eyebrow={`${t('legalPages.revisionNotice')} · ${CURRENT_TERMS_VERSION}${CURRENT_TERMS_EFFECTIVE_DATE ? ` · ${CURRENT_TERMS_EFFECTIVE_DATE}` : ''}`}
      title={t('legalPages.terms.title')}
      description={t('legalPages.terms.description')}
    >
      <LegalSectionContent title={t('legalPages.terms.title')} sections={Array.isArray(sections) ? sections : []} />
    </PlaceholderPage>
  )
}

export default TermsPage
