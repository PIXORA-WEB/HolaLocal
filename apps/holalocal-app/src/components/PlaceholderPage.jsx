import { brand } from '../utils/brand.js'

function PlaceholderPage({ title, description }) {
  return (
    <section className="placeholder-page">
      <p className="placeholder-page__eyebrow">{brand.name}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  )
}

export default PlaceholderPage
