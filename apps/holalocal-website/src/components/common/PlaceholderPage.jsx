import { brand } from '../../utils/brand.js'

function PlaceholderPage({ children, description, eyebrow = brand.name, title }) {
  return (
    <section className="placeholder">
      <header className="placeholder__header">
        <p className="placeholder__label">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </header>
      {children && <div className="placeholder__content">{children}</div>}
    </section>
  )
}

export default PlaceholderPage
