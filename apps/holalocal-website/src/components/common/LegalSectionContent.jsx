function renderParagraph(text, email) {
  const parts = String(text).split(/<email>|<\/email>/)
  if (parts.length !== 3) return text
  return (
    <>
      {parts[0]}
      <a href={`mailto:${email}`}>{parts[1]}</a>
      {parts[2]}
    </>
  )
}

function LegalSectionContent({ email = 'hello@holalocal.es', sections }) {
  return (
    <>
      {sections.map((section) => (
        <section key={section.key}>
          <h2>{section.title}</h2>
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
    </>
  )
}

export default LegalSectionContent
