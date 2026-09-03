import { useTranslation } from 'react-i18next'

const supportedProducts = new Set(['events', 'community'])

function ProductComingSoonPage({ product }) {
  const { t } = useTranslation()

  if (!supportedProducts.has(product)) {
    return null
  }

  const translationKey = `productLanding.${product}`

  return (
    <article className={`product-landing product-landing--${product}`}>
      <div className="product-landing__inner">
        <header className="product-landing__header">
          <p className="product-landing__eyebrow">
            {t(`${translationKey}.eyebrow`)}
          </p>

          <h1>{t(`${translationKey}.title`)}</h1>

          <p className="product-landing__description">
            {t(`${translationKey}.description`)}
          </p>
        </header>
        <section
          aria-labelledby={`${product}-status-title`}
          className="product-landing__status"
        >
          <h2
            className="product-landing__status-label"
            id={`${product}-status-title`}
          >
            {t('productLanding.comingSoon')}
          </h2>

          <p>{t(`${translationKey}.supportingMessage`)}</p>
        </section>
      </div>
    </article>
  )
}

export default ProductComingSoonPage
