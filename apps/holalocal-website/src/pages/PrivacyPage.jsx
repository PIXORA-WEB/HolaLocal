import PlaceholderPage from '../components/common/PlaceholderPage.jsx'
import { useTranslation } from 'react-i18next'

function PrivacyPage() {
  const { t } = useTranslation()

  return (
    <PlaceholderPage
      eyebrow={t('legalPages.version')}
      title={t('legalPages.privacy.title')}
      description={t('legalPages.privacy.description')}
    >
      <section>
        <h2>{t('legalPages.privacy.audience')}</h2>
        <p>
          HolaLocal is being developed for customers looking for local services and for businesses
          and self-employed professionals offering services across Spain. Early Access lets people
          create real accounts and prepare profiles before the full marketplace launches.
        </p>
      </section>

      <section>
        <h2>{t('legalPages.privacy.information')}</h2>
        <ul>
          <li>Account details, such as your name, email address, account role and login information.</li>
          <li>Customer profile details, including your preferred language and general location.</li>
          <li>Business profile details, including business name, services, service areas, languages and description.</li>
          <li>Contact preferences and optional business phone, email and WhatsApp details.</li>
          <li>Business logos, profile images and work images where uploads are supported.</li>
          <li>Messages, reports and information you choose to submit through platform features.</li>
          <li>Technical and security data, such as device, browser, authentication, error and activity information.</li>
        </ul>
        <p>We do not ask you to provide information that is not reasonably needed for the service.</p>
      </section>

      <section>
        <h2>{t('legalPages.privacy.purpose')}</h2>
        <p>
          We use information to create and protect accounts, provide profile and messaging features,
          prepare business listings, remember language and location preferences, respond to support
          requests, prevent abuse, investigate reports and improve the Early Access experience.
        </p>
      </section>

      <section>
        <h2>{t('legalPages.privacy.profiles')}</h2>
        <p>
          New business profiles may remain private and marked as drafts until marketplace publishing
          becomes available. Creating a draft does not guarantee publication or verification. We will
          explain any additional publishing choices before making a draft profile public.
        </p>
      </section>

      <section>
        <h2>{t('legalPages.privacy.providers')}</h2>
        <p>
          HolaLocal uses cloud services, including Firebase services for authentication, database and
          file storage, together with website hosting and operational providers. These providers process
          information only to support the platform and are subject to their own security and privacy terms.
          Data may be processed outside your country with appropriate safeguards where required.
        </p>
      </section>

      <section>
        <h2>{t('legalPages.privacy.visibility')}</h2>
        <p>
          HolaLocal messaging is the core contact method. Businesses may optionally add a phone number,
          email address or WhatsApp number and control whether each is shown publicly. Hidden contact
          values are not included in public business-profile data. Businesses should only publish contact
          information they are comfortable sharing.
        </p>
      </section>

      <section>
        <h2>{t('legalPages.privacy.deletion')}</h2>
        <p>
          You may ask us to correct your information or request account deletion by emailing
          <a href="mailto:hello@holalocal.es"> hello@holalocal.es</a> from the address associated with
          your account. Use the subject “Privacy or account deletion request”. We may need to verify your
          identity. Some information may be retained where reasonably necessary for security, legal duties,
          dispute handling or abuse prevention, and will be deleted or anonymised when no longer required.
        </p>
      </section>

      <section>
        <h2>{t('legalPages.privacy.security')}</h2>
        <p>
          We use reasonable technical and organisational safeguards, including access controls and
          protected authentication. No online service can promise absolute security, so please use a
          strong password and contact us if you believe your account has been compromised.
        </p>
      </section>

      <section>
        <h2>{t('legalPages.privacy.changes')}</h2>
        <p>
          HolaLocal will evolve during Early Access. We may update this policy when features, providers
          or legal requirements change. The version and effective date at the top will identify the current
          policy, and material changes will be communicated where appropriate.
        </p>
      </section>

      <section>
        <h2>{t('footer.contact')}</h2>
        <p>Questions about privacy or this policy can be sent to <a href="mailto:hello@holalocal.es">hello@holalocal.es</a>.</p>
      </section>
    </PlaceholderPage>
  )
}

export default PrivacyPage
