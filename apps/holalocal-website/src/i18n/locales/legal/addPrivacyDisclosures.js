import { reviewPrivacySection } from '../../legalDisclosures/createReviewSections.js'
export function addPrivacyDisclosures(content, reviewCopy, availability, deletionPrivacy) {
  return {
    ...content,
    privacy: {
      sections: [reviewPrivacySection(reviewCopy, availability), ...content.privacy.sections.map((section) => section.key === 'deletion'
        ? { ...section, paragraphs: [section.paragraphs[0], ...deletionPrivacy] }
        : section)],
    },
  }
}
