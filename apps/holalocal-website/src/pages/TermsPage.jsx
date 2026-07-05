import PlaceholderPage from '../components/common/PlaceholderPage.jsx'
import { useTranslation } from 'react-i18next'

function TermsPage() {
  const { t } = useTranslation()

  return (
    <PlaceholderPage
      eyebrow={t('legalPages.version')}
      title={t('legalPages.terms.title')}
      description={t('legalPages.terms.description')}
    >
      <section>
        <h2>{t('earlyAccess.navigation')}</h2>
        <p>
          HolaLocal is still being developed. Features may be incomplete, changed, paused or removed,
          and the full public marketplace is not yet launched. By taking part, you agree to use the
          service responsibly and understand that the experience will continue to evolve.
        </p>
      </section>

      <section>
        <h2>{t('legalPages.terms.account')}</h2>
        <p>
          You must provide accurate account information, protect your password and tell us promptly if
          you suspect unauthorised access. You are responsible for activity carried out through your
          account. Do not share access in a way that compromises another person or the platform.
        </p>
      </section>

      <section>
        <h2>{t('legalPages.terms.customers')}</h2>
        <p>
          Customer accounts are for finding local services, managing preferences and contacting businesses.
          Customers must communicate respectfully and independently check that a business is suitable,
          qualified and insured where relevant before agreeing to work.
        </p>
      </section>

      <section>
        <h2>{t('legalPages.terms.businesses')}</h2>
        <p>
          Businesses and professionals may prepare profiles describing their services, coverage, languages
          and contact preferences. You must have authority to represent the business and keep all details,
          images, qualifications and claims accurate and current.
        </p>
        <p>
          Early Access business profiles normally remain drafts. A draft is not a public listing, approval,
          endorsement or verified status. Publishing and review processes may be introduced later, and we
          may ask for further information before a profile becomes public.
        </p>
      </section>

      <section>
        <h2>{t('legalPages.terms.prohibited')}</h2>
        <p>You must not use HolaLocal to:</p>
        <ul>
          <li>abuse, threaten, harass or discriminate against another person;</li>
          <li>send spam, misleading promotions or unwanted repeated messages;</li>
          <li>run scams, impersonate others or create fake business profiles;</li>
          <li>offer illegal, unsafe or deliberately misleading services;</li>
          <li>upload harmful content or interfere with the platform’s security or operation; or</li>
          <li>use another person’s personal information without permission or a lawful reason.</li>
        </ul>
      </section>

      <section>
        <h2>{t('legalPages.terms.messaging')}</h2>
        <p>
          HolaLocal messaging is the platform’s core contact method and cannot be disabled by a business.
          Optional public contact channels may also be available. Translation features may be added or
          improved later. Automated translations can be inaccurate, so users should confirm prices,
          addresses, dates, safety instructions and other important details directly with each other.
        </p>
      </section>

      <section>
        <h2>{t('legalPages.terms.changes')}</h2>
        <p>
          We may change the platform during development. We may restrict, suspend or remove accounts,
          profiles or content where reasonably necessary to protect users, investigate reports, comply with
          law or enforce these terms. Serious or repeated misuse may result in permanent removal.
        </p>
      </section>

      <section>
        <h2>{t('legalPages.terms.availability')}</h2>
        <p>
          We do not guarantee that HolaLocal will always be available, error-free or launch on a particular
          date. HolaLocal helps people discover and communicate with independent businesses; it does not
          employ those businesses or become a party to agreements between users.
        </p>
        <p>
          To the extent permitted by law, HolaLocal is not responsible for indirect losses or for the quality,
          safety, legality or outcome of services arranged between users. Nothing in these terms excludes
          rights or liability that cannot legally be excluded, including applicable consumer rights.
        </p>
      </section>

      <section>
        <h2>{t('legalPages.terms.law')}</h2>
        <p>
          These terms are governed by the laws of Spain. Any mandatory consumer protections and rights to
          bring a claim in another competent court remain unaffected.
        </p>
      </section>

      <section>
        <h2>{t('footer.contact')}</h2>
        <p>Questions about these terms can be sent to <a href="mailto:hello@holalocal.es">hello@holalocal.es</a>.</p>
      </section>
    </PlaceholderPage>
  )
}

export default TermsPage
