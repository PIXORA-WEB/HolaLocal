export function reviewPrivacySection(copy, availability) {
  const [title, identity, provider, retention] = copy
  return { key: 'reviews', title, paragraphs: [availability, identity, provider, retention] }
}
export function reviewTermsSection(copy, availability, text) {
  return { key: 'reviews', title: copy[0], paragraphs: [availability, text, copy[1]] }
}
