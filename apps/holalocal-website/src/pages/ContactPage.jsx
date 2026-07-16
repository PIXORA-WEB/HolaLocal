import PlaceholderPage from '../components/common/PlaceholderPage.jsx'
import { useTranslation } from 'react-i18next'

function ContactPage() {
  const { t } = useTranslation()

  return (
    <PlaceholderPage
      eyebrow="HolaLocal"
      title={t('footer.contact')}
      description={t('legalPages.contact.description')}
    >
      <section>
        <h2>{t('legalPages.contact.help')}</h2>
        <ul>
          <li><strong>{t('legalPages.contact.general')}:</strong> {t('legalPages.contact.generalText')}</li>
          <li><strong>{t('legalPages.contact.business')}:</strong> {t('legalPages.contact.businessText')}</li>
          <li><strong>{t('legalPages.contact.bugs')}:</strong> {t('legalPages.contact.bugsText')}</li>
          <li><strong>{t('legalPages.contact.feedback')}:</strong> {t('legalPages.contact.feedbackText')}</li>
          <li><strong>{t('legalPages.contact.privacy')}:</strong> {t('legalPages.contact.privacyText')}</li>
        </ul>
      </section>

      <section className="placeholder__contact-card">
        <h2>{t('legalPages.contact.email')}</h2>
        <p><a href="mailto:hello@holalocal.es">hello@holalocal.es</a></p>
        <p>{t('legalPages.contact.response')}</p>
      </section>
    </PlaceholderPage>
  )
}

export default ContactPage
