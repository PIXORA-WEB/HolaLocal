import { useTranslation } from 'react-i18next'

function SubscriptionPage() {
  const { t } = useTranslation()

  return (
    <section
      aria-labelledby="subscription-products-title"
      className="business-subscription subscription-products-page"
    >
      <header className="business-page-heading subscription-products-page__header">
        <h1 id="subscription-products-title">{t('subscriptionProducts.title')}</h1>
        <p>{t('subscriptionProducts.description')}</p>
      </header>

      <div className="subscription-products-grid">
        <article className="subscription-product-card subscription-product-card--business">
          <h2>{t('subscriptionProducts.business.title')}</h2>
          <p className="subscription-product-card__status">
            {t('subscriptionProducts.business.status')}
          </p>
          <p className="subscription-product-card__description">
            {t('subscriptionProducts.business.description')}
          </p>
        </article>

        <article className="subscription-product-card subscription-product-card--events">
          <h2>{t('subscriptionProducts.events.title')}</h2>
          <p className="subscription-product-card__status">
            {t('subscriptionProducts.events.status')}
          </p>
          <p className="subscription-product-card__description">
            {t('subscriptionProducts.events.description')}
          </p>
        </article>
      </div>
    </section>
  )
}

export default SubscriptionPage
