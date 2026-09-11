function renderParagraph(text, email) {
  // Only authored, explicitly supported links are rendered; no HTML injection.
  return String(text).split(/(<(?:email|authority)>.*?<\/(?:email|authority)>)/).map((part, index) => {
    const match = part.match(/^<(email|authority)>(.*?)<\/\1>$/)
    if (!match) return part
    const href = match[1] === 'email' ? `mailto:${email}` : 'https://www.aepd.es/'
    return <a key={index} href={href}>{match[2]}</a>
  })
}

function LegalSectionContent({ email = 'hello@holalocal.es', sections, title }) {
  return (
    <div className="legal-content">
      <nav className="legal-content__contents" aria-label={title}>
        <ol>
          {sections.map((section) => (
            <li key={section.key}><a href={`#${section.key}`}>{section.title}</a></li>
          ))}
        </ol>
      </nav>
      <div className="legal-content__sections">
        {sections.map((section) => (
          <section key={section.key} aria-labelledby={section.key}>
            <h2 id={section.key} tabIndex={-1}>{section.title}</h2>
            {section.paragraphs?.map((paragraph, index) => (
              <p key={`${section.key}-paragraph-${index}`}>
                {renderParagraph(paragraph, email)}
              </p>
            ))}
            {section.items?.length > 0 && (
              <ul>
                {section.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}

export default LegalSectionContent
