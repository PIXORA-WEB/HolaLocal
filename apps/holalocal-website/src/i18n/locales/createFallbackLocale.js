export function createFallbackLocale(fallback, overrides) {
  return {
    ...fallback,
    ...overrides,
    nav: { ...fallback.nav, ...overrides.nav },
    auth: { ...fallback.auth, ...overrides.auth },
    account: { ...fallback.account, ...overrides.account },
    language: { ...fallback.language, ...overrides.language },
    business: { ...fallback.business, ...overrides.business },
    earlyAccess: {
      ...fallback.earlyAccess,
      ...overrides.earlyAccess,
      hero: { ...fallback.earlyAccess.hero, ...overrides.earlyAccess?.hero },
      preview: { ...fallback.earlyAccess.preview, ...overrides.earlyAccess?.preview },
      principles: { ...fallback.earlyAccess.principles, ...overrides.earlyAccess?.principles },
      info: {
        ...fallback.earlyAccess.info,
        ...overrides.earlyAccess?.info,
        customers: { ...fallback.earlyAccess.info.customers, ...overrides.earlyAccess?.info?.customers },
        businesses: { ...fallback.earlyAccess.info.businesses, ...overrides.earlyAccess?.info?.businesses },
      },
      cta: { ...fallback.earlyAccess.cta, ...overrides.earlyAccess?.cta },
      roadmap: { ...fallback.earlyAccess.roadmap, ...overrides.earlyAccess?.roadmap },
      languageNotice: { ...fallback.earlyAccess.languageNotice, ...overrides.earlyAccess?.languageNotice },
      footer: { ...fallback.earlyAccess.footer, ...overrides.earlyAccess?.footer },
    },
    legalPages: {
      ...fallback.legalPages,
      ...overrides.legalPages,
      privacy: { ...fallback.legalPages.privacy, ...overrides.legalPages?.privacy },
      terms: { ...fallback.legalPages.terms, ...overrides.legalPages?.terms },
      contact: { ...fallback.legalPages.contact, ...overrides.legalPages?.contact },
    },
    footer: { ...fallback.footer, ...overrides.footer },
  }
}
