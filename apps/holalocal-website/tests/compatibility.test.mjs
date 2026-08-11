import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import i18next from 'i18next'
import {
  resolveWebsiteBusinessLookup,
  isPublicBusinessEligible,
  toManagedBusinessView,
  toPublicBusinessView,
  toWebsiteUserProfile,
} from '../src/services/firebaseCompatibility.js'
import {
  businessCategoryOptions,
  countryOptions,
  getBusinessCategoryLabel,
  serviceAreaOptions,
} from '../src/utils/business.js'
import {
  formatLanguageList,
  getLanguageDisplayName,
  supportedUILanguages,
} from '../src/utils/languages.js'
import {
  getServiceAreaGroupLabel,
  getServiceAreaLabel,
  serviceAreaGroupLabels,
  serviceAreaLabels,
} from '../src/utils/locations.js'
import { authenticatedTranslations } from '../src/i18n/locales/authenticatedTranslations.js'
import { fallbackLocaleCompletionTranslations } from '../src/i18n/locales/fallbackLocaleCompletionTranslations.js'
import { legalPageContent } from '../src/i18n/locales/legalContent.js'
import { mergeLocale } from '../src/i18n/locales/mergeLocale.js'
import { universalOperationalTranslations } from '../src/i18n/locales/universalOperationalTranslations.js'

class TimestampFixture {
  toDate() { return new Date(0) }
}

const canonicalContact = {
  phone: '', phoneVisible: false, email: '', emailVisible: false,
  whatsappNumber: '', whatsappVisible: false, website: '', websiteVisible: false,
  preferredContactMethod: 'holalocal', allowCallbackRequests: false,
}

const jsonLocaleCodes = new Set(['en', 'es', 'fr', 'de', 'nl', 'pt'])
const localeRoot = new URL('../src/i18n/locales/', import.meta.url)

async function readJsonLocale(code) {
  return JSON.parse(await readFile(new URL(`${code}.json`, localeRoot), 'utf8'))
}

async function readBaseLocale(code, english) {
  if (jsonLocaleCodes.has(code)) return readJsonLocale(code)
  return english
}

const homepageTrustTranslations = {
  en: { hero: { activeProfile: 'Public profile' }, trust: { verified: { title: 'Business verification', comingSoon: 'Coming soon', description: 'We are developing a verification process to help customers recognise businesses whose identity and registration details have been checked.' } } },
  es: { hero: { activeProfile: 'Perfil público' }, trust: { verified: { title: 'Verificación de negocios', comingSoon: 'Próximamente', description: 'Estamos desarrollando un proceso de verificación para ayudar a los clientes a reconocer negocios cuya identidad y datos de registro hayan sido comprobados.' } } },
  fr: { hero: { activeProfile: 'Profil public' }, trust: { verified: { title: 'Vérification des entreprises', comingSoon: 'Bientôt disponible', description: 'Nous développons un processus de vérification pour aider les clients à reconnaître les entreprises dont l’identité et les informations d’enregistrement ont été contrôlées.' } } },
  de: { hero: { activeProfile: 'Öffentliches Profil' }, trust: { verified: { title: 'Unternehmensverifizierung', comingSoon: 'Demnächst', description: 'Wir entwickeln einen Verifizierungsprozess, damit Kunden Unternehmen erkennen können, deren Identität und Registrierungsdaten geprüft wurden.' } } },
  nl: { hero: { activeProfile: 'Openbaar profiel' }, trust: { verified: { title: 'Bedrijfsverificatie', comingSoon: 'Binnenkort', description: 'We ontwikkelen een verificatieproces zodat klanten bedrijven kunnen herkennen waarvan de identiteit en registratiegegevens zijn gecontroleerd.' } } },
  pt: { hero: { activeProfile: 'Perfil público' }, trust: { verified: { title: 'Verificação de empresas', comingSoon: 'Em breve', description: 'Estamos a desenvolver um processo de verificação para ajudar os clientes a reconhecer empresas cuja identidade e dados de registo foram confirmados.' } } },
  pl: { hero: { activeProfile: 'Profil publiczny' }, trust: { verified: { title: 'Weryfikacja firm', comingSoon: 'Wkrótce', description: 'Opracowujemy proces weryfikacji, który pomoże klientom rozpoznawać firmy, których tożsamość i dane rejestrowe zostały sprawdzone.' } } },
  ro: { hero: { activeProfile: 'Profil public' }, trust: { verified: { title: 'Verificarea afacerilor', comingSoon: 'În curând', description: 'Dezvoltăm un proces de verificare care să ajute clienții să recunoască afacerile ale căror identitate și date de înregistrare au fost verificate.' } } },
  cs: { hero: { activeProfile: 'Veřejný profil' }, trust: { verified: { title: 'Ověření firem', comingSoon: 'Již brzy', description: 'Vyvíjíme ověřovací proces, který zákazníkům pomůže rozpoznat firmy, jejichž totožnost a registrační údaje byly zkontrolovány.' } } },
  sk: { hero: { activeProfile: 'Verejný profil' }, trust: { verified: { title: 'Overenie firiem', comingSoon: 'Čoskoro', description: 'Vyvíjame proces overenia, ktorý zákazníkom pomôže rozpoznať firmy, ktorých identita a registračné údaje boli skontrolované.' } } },
  hu: { hero: { activeProfile: 'Nyilvános profil' }, trust: { verified: { title: 'Vállalkozás-ellenőrzés', comingSoon: 'Hamarosan', description: 'Olyan ellenőrzési folyamatot fejlesztünk, amely segít az ügyfeleknek felismerni azokat a vállalkozásokat, amelyek személyazonosságát és regisztrációs adatait ellenőrizték.' } } },
  uk: { hero: { activeProfile: 'Публічний профіль' }, trust: { verified: { title: 'Перевірка бізнесу', comingSoon: 'Незабаром', description: 'Ми розробляємо процес перевірки, який допоможе клієнтам розпізнавати бізнеси, чиї особу та реєстраційні дані було перевірено.' } } },
  it: { hero: { activeProfile: 'Profilo pubblico' }, trust: { verified: { title: 'Verifica delle attività', comingSoon: 'Prossimamente', description: 'Stiamo sviluppando un processo di verifica per aiutare i clienti a riconoscere le attività di cui sono stati controllati identità e dati di registrazione.' } } },
  sv: { hero: { activeProfile: 'Offentlig profil' }, trust: { verified: { title: 'Företagsverifiering', comingSoon: 'Kommer snart', description: 'Vi utvecklar en verifieringsprocess som hjälper kunder att känna igen företag vars identitet och registreringsuppgifter har kontrollerats.' } } },
  da: { hero: { activeProfile: 'Offentlig profil' }, trust: { verified: { title: 'Virksomhedsverificering', comingSoon: 'Kommer snart', description: 'Vi udvikler en verificeringsproces, der hjælper kunder med at genkende virksomheder, hvis identitet og registreringsoplysninger er blevet kontrolleret.' } } },
  fi: { hero: { activeProfile: 'Julkinen profiili' }, trust: { verified: { title: 'Yritysten vahvistus', comingSoon: 'Tulossa pian', description: 'Kehitämme vahvistusprosessia, joka auttaa asiakkaita tunnistamaan yritykset, joiden henkilöllisyys ja rekisteröintitiedot on tarkistettu.' } } },
  no: { hero: { activeProfile: 'Offentlig profil' }, trust: { verified: { title: 'Bedriftsverifisering', comingSoon: 'Kommer snart', description: 'Vi utvikler en verifiseringsprosess som hjelper kunder med å kjenne igjen bedrifter der identitet og registreringsopplysninger er kontrollert.' } } },
}

const homepageCarouselTranslations = {
  en: { previousBusiness: 'Previous business', nextBusiness: 'Next business', businessPosition: 'Business {{current}} of {{total}}' },
  es: { previousBusiness: 'Negocio anterior', nextBusiness: 'Negocio siguiente', businessPosition: 'Negocio {{current}} de {{total}}' },
  fr: { previousBusiness: 'Entreprise précédente', nextBusiness: 'Entreprise suivante', businessPosition: 'Entreprise {{current}} sur {{total}}' },
  de: { previousBusiness: 'Vorheriges Unternehmen', nextBusiness: 'Nächstes Unternehmen', businessPosition: 'Unternehmen {{current}} von {{total}}' },
  nl: { previousBusiness: 'Vorig bedrijf', nextBusiness: 'Volgend bedrijf', businessPosition: 'Bedrijf {{current}} van {{total}}' },
  pt: { previousBusiness: 'Empresa anterior', nextBusiness: 'Empresa seguinte', businessPosition: 'Empresa {{current}} de {{total}}' },
  pl: { previousBusiness: 'Poprzednia firma', nextBusiness: 'Następna firma', businessPosition: 'Firma {{current}} z {{total}}' },
  ro: { previousBusiness: 'Afacerea anterioară', nextBusiness: 'Afacerea următoare', businessPosition: 'Afacerea {{current}} din {{total}}' },
  cs: { previousBusiness: 'Předchozí firma', nextBusiness: 'Další firma', businessPosition: 'Firma {{current}} z {{total}}' },
  sk: { previousBusiness: 'Predchádzajúca firma', nextBusiness: 'Ďalšia firma', businessPosition: 'Firma {{current}} z {{total}}' },
  hu: { previousBusiness: 'Előző vállalkozás', nextBusiness: 'Következő vállalkozás', businessPosition: '{{current}}. vállalkozás / {{total}}' },
  uk: { previousBusiness: 'Попередній бізнес', nextBusiness: 'Наступний бізнес', businessPosition: 'Бізнес {{current}} з {{total}}' },
  it: { previousBusiness: 'Attività precedente', nextBusiness: 'Attività successiva', businessPosition: 'Attività {{current}} di {{total}}' },
  sv: { previousBusiness: 'Föregående företag', nextBusiness: 'Nästa företag', businessPosition: 'Företag {{current}} av {{total}}' },
  da: { previousBusiness: 'Forrige virksomhed', nextBusiness: 'Næste virksomhed', businessPosition: 'Virksomhed {{current}} af {{total}}' },
  fi: { previousBusiness: 'Edellinen yritys', nextBusiness: 'Seuraava yritys', businessPosition: 'Yritys {{current}}/{{total}}' },
  no: { previousBusiness: 'Forrige bedrift', nextBusiness: 'Neste bedrift', businessPosition: 'Bedrift {{current}} av {{total}}' },
}

function getPath(resource, key) {
  return key.split('.').reduce((current, part) => current?.[part], resource)
}

function translatorFor(resource) {
  return (key, options = {}) => {
    const value = getPath(resource, key)
    if (typeof value === 'string') return value
    return options.defaultValue ?? key
  }
}

function flattenLegalStrings(sections) {
  return sections.flatMap((section) => [
    section.title,
    ...(section.paragraphs ?? []),
    ...(section.items ?? []),
  ])
}

function leafEntries(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return child && typeof child === 'object'
      ? leafEntries(child, path)
      : [[path, child]]
  })
}

function interpolationVariables(value) {
  return [...String(value).matchAll(/{{\s*([^}\s]+)\s*}}/g)]
    .map((match) => match[1])
    .sort()
}

function resourceForLocale(code, english, baseLocale) {
  return mergeLocale(
    english,
    baseLocale,
    { marketing: homepageTrustTranslations[code] },
    { marketing: { hero: homepageCarouselTranslations[code] } },
    authenticatedTranslations[code],
    fallbackLocaleCompletionTranslations[code],
    universalOperationalTranslations[code],
    { legalPages: legalPageContent[code] },
    { locations: { areas: serviceAreaLabels } },
  )
}

function canonicalBusiness(overrides = {}) {
  return {
    ownerId: 'owner-1', managerIds: ['owner-1'], name: 'Canonical Business',
    description: 'A complete canonical business profile.',
    primaryCategoryId: 'cleaning', categoryIds: ['cleaning'], serviceAreas: ['marbella'],
    languages: ['en'], primaryLanguage: 'en', location: { locality: 'Marbella', region: 'Málaga', countryCode: 'ES' },
    contact: canonicalContact, status: 'draft', verificationStatus: 'unverified',
    subscription: { tier: 'free', status: 'none' }, profileCompleted: true,
    publishedAt: null,
    ...overrides,
  }
}

test('launch-critical operational translations are complete for every locale', async () => {
  const english = await readJsonLocale('en')
  const englishResource = resourceForLocale('en', english, english)
  const namespacePaths = [
    ['messages', 56],
    ['reports', 18],
    ['onboarding', 12],
    ['auth.errors', 10],
    ['auth.passwordUx', 2],
    ['auth.recovery', 4],
    ['services.authPrompt', 6],
  ]
  const submissionPaths = [
    'business.control.submitForReview',
    'business.control.submitSuccess',
    'business.control.submitError',
  ]

  for (const { code } of supportedUILanguages) {
    const resource = resourceForLocale(code, english, await readBaseLocale(code, english))
    for (const [path, expectedCount] of namespacePaths) {
      const entries = leafEntries(getPath(resource, path))
      assert.equal(entries.length, expectedCount, `${code}: ${path} leaf count`)
      for (const [key, value] of entries) {
        assert.equal(typeof value, 'string', `${code}: ${path}.${key} is a string`)
        assert.notEqual(value.trim(), '', `${code}: ${path}.${key} is non-empty`)
      }
    }
    for (const path of submissionPaths) {
      assert.equal(typeof getPath(resource, path), 'string', `${code}: ${path} resolves`)
      assert.notEqual(getPath(resource, path).trim(), '', `${code}: ${path} is non-empty`)
    }

    if (code !== 'en') {
      for (const path of [
        'messages.placeholderDescription',
        'messages.errors.sessionExpired',
        'messages.errors.permissionDenied',
        'messages.errors.networkUnavailable',
        'messages.errors.notFound',
        'messages.errors.invalid',
        'messages.errors.conflict',
        'reports.submittedDescription',
        'onboarding.description',
        'auth.errors.sessionRestore',
        'auth.passwordUx.show',
        'auth.recovery.description',
        'services.authPrompt.reportDescription',
        ...submissionPaths,
      ]) {
        assert.notEqual(getPath(resource, path), getPath(englishResource, path), `${code}: ${path} is localized`)
      }
    }
  }

  for (const code of ['es', 'pl', 'uk', 'fi', 'de']) {
    const resource = resourceForLocale(code, english, await readBaseLocale(code, english))
    assert.notEqual(resource.messages.emptyConversations, englishResource.messages.emptyConversations)
    assert.notEqual(resource.reports.reasonLegend, englishResource.reports.reasonLegend)
    assert.notEqual(resource.onboarding.title, englishResource.onboarding.title)
  }
})

test('fallback locale completion packs merge without overriding specialized content', async () => {
  const english = await readJsonLocale('en')
  const englishResource = resourceForLocale('en', english, english)
  const allowedIdenticalValues = new Set(['services.locationPlaceholder'])
  const allowedIdenticalByLocale = {
    it: new Set(['auth.password', 'business.form.contact.emailLabel']),
    da: new Set(['services.categories.handyman', 'business.form.media.uploadLogo']),
  }

  assert.deepEqual(Object.keys(fallbackLocaleCompletionTranslations).sort(), ['cs', 'da', 'fi', 'hu', 'it', 'no', 'pl', 'ro', 'sk', 'sv', 'uk'])

  for (const code of ['pl', 'ro', 'cs', 'sk', 'hu', 'uk', 'it', 'fi', 'sv', 'da', 'no']) {
    const completion = fallbackLocaleCompletionTranslations[code]
    const resource = resourceForLocale(code, english, await readBaseLocale(code, english))
    const entries = leafEntries(completion)

    const expectedLeafCounts = {
      pl: 260, ro: 254, cs: 254, sk: 286, hu: 262, uk: 274,
      it: 248, fi: 262, sv: 262, da: 261, no: 262,
    }
    assert.equal(entries.length, expectedLeafCounts[code], `${code}: scoped completion leaf count`)
    for (const [path, value] of entries) {
      assert.equal(getPath(resource, path), value, `${code}: ${path} is active in the merged resource`)
      const canonicalPath = /_(few|many)$/.test(path)
        ? path.replace(/_(few|many)$/, '_other')
        : path
      assert.deepEqual(
        interpolationVariables(value),
        interpolationVariables(getPath(englishResource, canonicalPath)),
        `${code}: ${path} preserves interpolation variables`,
      )
      if (!allowedIdenticalValues.has(path) && !allowedIdenticalByLocale[code]?.has(path)) {
        assert.notEqual(value, getPath(englishResource, canonicalPath), `${code}: ${path} is localized`)
      }
    }

    const pluralStems = [
      'marketing.hero.ratingCount',
      'services.resultCount',
      'business.control.heroContextAreas',
      'business.control.missingCount',
      'business.control.serviceAreas',
      'business.form.errors.galleryRemaining',
    ]
    for (const pluralStem of pluralStems) {
      assert.equal(typeof getPath(resource, `${pluralStem}_one`), 'string', `${code}: ${pluralStem}_one`)
      assert.equal(typeof getPath(resource, `${pluralStem}_other`), 'string', `${code}: ${pluralStem}_other`)
      const extraCategories = {
        pl: ['few', 'many'],
        ro: ['few'],
        cs: ['few'],
        sk: ['few'],
        hu: [],
        uk: ['few', 'many'],
        it: [],
        fi: [],
        sv: [],
        da: [],
        no: [],
      }
      for (const category of extraCategories[code]) {
        const path = `${pluralStem}_${category}`
        assert.equal(typeof getPath(resource, path), 'string', `${code}: ${path}`)
        assert.deepEqual(
          interpolationVariables(getPath(resource, path)),
          interpolationVariables(getPath(englishResource, `${pluralStem}_other`)),
          `${code}: ${path} interpolation variables`,
        )
      }
    }

    assert.deepEqual(resource.publicBusinessDetail, authenticatedTranslations[code].publicBusinessDetail)
    assert.deepEqual(resource.messages, universalOperationalTranslations[code].messages)
    assert.deepEqual(resource.reports, universalOperationalTranslations[code].reports)
    assert.deepEqual(resource.onboarding, universalOperationalTranslations[code].onboarding)
    assert.deepEqual(resource.auth.errors, universalOperationalTranslations[code].auth.errors)
    assert.deepEqual(resource.auth.passwordUx, universalOperationalTranslations[code].auth.passwordUx)
    assert.deepEqual(resource.auth.recovery, universalOperationalTranslations[code].auth.recovery)
    assert.deepEqual(resource.services.authPrompt, universalOperationalTranslations[code].services.authPrompt)
    assert.deepEqual(resource.legalPages.terms.sections, legalPageContent[code].terms.sections)
    assert.deepEqual(resource.legalPages.privacy.sections, legalPageContent[code].privacy.sections)
    assert.deepEqual(resource.locations.areas, serviceAreaLabels)
  }

  assert.notDeepEqual(
    fallbackLocaleCompletionTranslations.cs,
    fallbackLocaleCompletionTranslations.sk,
    'Czech and Slovak use independent completion objects',
  )
  assert.equal(fallbackLocaleCompletionTranslations.cs.services.categories.cleaning, 'Úklid')
  assert.equal(fallbackLocaleCompletionTranslations.sk.services.categories.cleaning, 'Upratovanie')
  assert.equal(fallbackLocaleCompletionTranslations.cs.auth.forgotPassword, 'Zapomněli jste heslo?')
  assert.equal(fallbackLocaleCompletionTranslations.sk.auth.forgotPassword, 'Zabudli ste heslo?')
  assert.equal(fallbackLocaleCompletionTranslations.hu.services.categories.cleaning, 'Takarítás')
  assert.equal(fallbackLocaleCompletionTranslations.uk.services.categories.cleaning, 'Прибирання')
  assert.equal(fallbackLocaleCompletionTranslations.hu.business.control.visibility.pending_review, 'A profil felülvizsgálatra vár, és még nem szerepel nyilvánosan.')
  assert.equal(fallbackLocaleCompletionTranslations.uk.business.control.visibility.pending_review, 'Профіль очікує розгляду й ще не опублікований.')
  assert.equal(fallbackLocaleCompletionTranslations.it.business.control.visibility.pending_review, 'Il profilo è in attesa di revisione e non è ancora pubblicato.')
  assert.equal(fallbackLocaleCompletionTranslations.fi.business.control.visibility.pending_review, 'Profiili odottaa tarkistusta, eikä sitä ole vielä julkaistu.')
  assert.equal(fallbackLocaleCompletionTranslations.it.services.categories.cleaning, 'Pulizie')
  assert.equal(fallbackLocaleCompletionTranslations.fi.services.categories.cleaning, 'Siivous')
  assert.equal(fallbackLocaleCompletionTranslations.sv.services.categories.cleaning, 'Städning')
  assert.equal(fallbackLocaleCompletionTranslations.da.services.categories.cleaning, 'Rengøring')
  assert.equal(fallbackLocaleCompletionTranslations.no.services.categories.cleaning, 'Rengjøring')
  assert.equal(fallbackLocaleCompletionTranslations.sv.business.control.visibility.pending_review, 'Profilen väntar på granskning och är ännu inte offentligt publicerad.')
  assert.equal(fallbackLocaleCompletionTranslations.da.business.control.visibility.pending_review, 'Profilen afventer gennemgang og er endnu ikke offentliggjort.')
  assert.equal(fallbackLocaleCompletionTranslations.no.business.control.visibility.pending_review, 'Profilen avventer gjennomgang og er ennå ikke offentlig publisert.')
  assert.notDeepEqual(fallbackLocaleCompletionTranslations.sv, fallbackLocaleCompletionTranslations.da)
  assert.notDeepEqual(fallbackLocaleCompletionTranslations.da, fallbackLocaleCompletionTranslations.no)
  assert.notDeepEqual(fallbackLocaleCompletionTranslations.sv, fallbackLocaleCompletionTranslations.no)
  assert.doesNotMatch(JSON.stringify(fallbackLocaleCompletionTranslations.uk), /[ыэёъ]/iu)
})

test('shared residual interface and fuller-locale gaps are localized', async () => {
  const english = await readJsonLocale('en')
  const englishResource = resourceForLocale('en', english, english)
  const nonEnglishLocales = ['es', 'fr', 'de', 'nl', 'pt', 'pl', 'ro', 'cs', 'sk', 'hu', 'uk', 'it', 'sv', 'da', 'fi', 'no']
  const completionLocales = ['pl', 'ro', 'cs', 'sk', 'hu', 'uk', 'it', 'sv', 'da', 'fi', 'no']

  for (const code of nonEnglishLocales) {
    const resource = resourceForLocale(code, english, await readBaseLocale(code, english))
    for (const path of ['business.form.media.logoAlt', 'business.form.contact.holalocal']) {
      assert.notEqual(getPath(resource, path), getPath(englishResource, path), `${code}: ${path} is localized`)
    }
    assert.deepEqual(
      interpolationVariables(resource.business.form.media.logoAlt),
      ['name'],
      `${code}: logo alternative text preserves the business-name placeholder`,
    )
  }

  for (const code of completionLocales) {
    const resource = resourceForLocale(code, english, await readBaseLocale(code, english))
    assert.deepEqual(
      interpolationVariables(resource.messages.translationNote),
      ['language'],
      `${code}: translation note preserves the preferred-language placeholder`,
    )
    for (const path of [
      'nav.business',
      'metadata.description',
      'locations.provinces.malaga',
      'locations.provinces.cadiz',
      'subscription.summary',
      'subscription.features.manage',
      'subscription.features.marketplace',
      'subscription.features.future',
    ]) {
      assert.notEqual(getPath(resource, path), getPath(englishResource, path), `${code}: ${path} is localized`)
    }
    assert.match(resource.locations.provinces.malaga, /Málaga/u, `${code}: Málaga proper name is preserved`)
    assert.match(resource.locations.provinces.cadiz, /Cádiz/u, `${code}: Cádiz proper name is preserved`)
  }

  const spanish = resourceForLocale('es', english, await readBaseLocale('es', english))
  assert.notEqual(spanish.business.control.visibility.rejected, englishResource.business.control.visibility.rejected)

  const fullerLocalePaths = [
    'services.verified',
    'business.control.visibility.rejected',
    'business.control.visibilitySteps.saved',
    'business.control.visibilitySteps.private',
    'business.control.visibilitySteps.visibleToYou',
    'business.control.visibilitySteps.notPublic',
    'business.control.visibilitySteps.comingLater',
    'business.control.insights.contactClicks',
    'business.form.media.description',
    'business.form.media.logoHelp',
    'business.form.media.workImageAlt',
    'business.form.media.saveFirst',
    'business.form.mediaSavedImmediately',
    'business.form.unsavedDescription',
    'business.form.contact.messagingHelp',
    'business.form.errors.galleryLimit',
    'subscription.features.manage',
    'subscription.features.marketplace',
    'subscription.features.future',
  ]
  for (const code of ['fr', 'de', 'nl', 'pt']) {
    const resource = resourceForLocale(code, english, await readBaseLocale(code, english))
    for (const path of fullerLocalePaths) {
      assert.notEqual(getPath(resource, path), getPath(englishResource, path), `${code}: ${path} is localized`)
    }
  }
})

test('French, German, Dutch and Portuguese final account residuals are localized in their owning layers', async () => {
  const english = await readJsonLocale('en')
  const englishResource = resourceForLocale('en', english, english)
  const accountPaths = [
    'profile.businessAssurance',
    'profile.preparingBusiness',
    'profile.completion.eyebrow',
    'profile.startBusiness',
    'business.form.contact.showWebsite',
    'business.form.errors.galleryRemaining_one',
    'business.form.errors.galleryRemaining_other',
  ]
  const counts = [0, 1, 2, 3, 4, 5, 10, 11, 12, 20, 21, 22, 25, 100, 101, 102]

  for (const code of ['fr', 'de', 'nl', 'pt']) {
    const baseLocale = await readBaseLocale(code, english)
    const resource = resourceForLocale(code, english, baseLocale)
    const paths = code === 'nl' || code === 'pt'
      ? [...accountPaths, 'profile.businessTools']
      : accountPaths

    for (const path of paths) {
      const value = getPath(resource, path)
      assert.equal(typeof value, 'string', `${code}: ${path} is a string`)
      assert.notEqual(value, '', `${code}: ${path} is non-empty`)
      assert.notEqual(value, getPath(englishResource, path), `${code}: ${path} is localized`)
      assert.deepEqual(
        interpolationVariables(value),
        interpolationVariables(getPath(englishResource, path)),
        `${code}: ${path} preserves interpolation variables`,
      )
      assert.equal(
        value,
        getPath(authenticatedTranslations[code], path),
        `${code}: ${path} remains owned by the authenticated translation pack`,
      )
      if (path !== 'profile.businessTools') {
        assert.equal(
          getPath(baseLocale, path),
          undefined,
          `${code}: ${path} is not duplicated in the full locale JSON`,
        )
      }
    }

    for (const suffix of ['one', 'other']) {
      const path = `business.control.heroContextAreas_${suffix}`
      const value = getPath(resource, path)
      assert.equal(value, getPath(baseLocale, path), `${code}: ${path} remains owned by the locale JSON`)
      assert.notEqual(value, getPath(englishResource, path), `${code}: ${path} is localized`)
      assert.deepEqual(
        interpolationVariables(value),
        ['category', 'count', 'location'],
        `${code}: ${path} preserves all dashboard placeholders`,
      )
      assert.equal(
        getPath(authenticatedTranslations[code], path),
        undefined,
        `${code}: ${path} is not duplicated in the authenticated translation pack`,
      )
    }

    const runtime = i18next.createInstance()
    await runtime.init({
      resources: {
        en: { translation: englishResource },
        [code]: { translation: resource },
      },
      lng: code,
      fallbackLng: 'en',
      supportedLngs: ['en', code],
      initImmediate: false,
      interpolation: { escapeValue: false },
      returnNull: false,
    })

    for (const stem of ['business.control.heroContextAreas', 'business.form.errors.galleryRemaining']) {
      for (const count of counts) {
        const details = runtime.t(stem, {
          category: 'Category',
          location: 'Location',
          count,
          lng: code,
          returnDetails: true,
        })
        assert.equal(details.usedLng, code, `${code}: ${stem} count ${count} remains localized`)
        assert.notEqual(details.res, stem, `${code}: ${stem} count ${count} is not a raw key`)
        assert.match(String(details.res), new RegExp(String(count)), `${code}: ${stem} count ${count} interpolates`)
        assert.equal(
          details.exactUsedKey,
          `${stem}_${new Intl.PluralRules(code).select(count)}`,
          `${code}: ${stem} count ${count} uses the runtime plural category`,
        )
      }
    }
  }
})

test('the authoritative 30-item completion-locale residual manifest is fully localized', async () => {
  const english = await readJsonLocale('en')
  const englishResource = resourceForLocale('en', english, english)
  const fixedPaths = [
    'profile.businessAssurance',
    'profile.preparingBusiness',
    'profile.completion.eyebrow',
    'business.control.heroContextAreas_one',
    'business.control.heroContextAreas_other',
    'business.form.errors.galleryRemaining_one',
    'business.form.errors.galleryRemaining_other',
    'business.form.contact.showWebsite',
    'profile.startBusiness',
  ]

  for (const code of ['fr', 'de', 'nl', 'pt']) {
    const resource = resourceForLocale(code, english, await readBaseLocale(code, english))
    for (const path of fixedPaths) {
      assert.notEqual(getPath(resource, path), getPath(englishResource, path), `${code}: ${path} is no longer a residual`)
    }
    if (code === 'nl' || code === 'pt') {
      assert.notEqual(
        resource.profile.businessTools,
        englishResource.profile.businessTools,
        `${code}: profile.businessTools is no longer a residual`,
      )
    }
  }

  const corrected = [
    ...['pl', 'ro', 'cs', 'it'].map((code) => [code, 'common.changeImage']),
    ...['sk', 'hu', 'uk', 'sv', 'da', 'fi', 'no'].flatMap((code) => [
      [code, 'common.changeImage'],
      [code, 'common.uploading'],
    ]),
    ...[
      'cleaning', 'plumbing', 'electrical', 'gardening', 'paintingDecorating',
      'buildingRenovation', 'handyman', 'airConditioning', 'locksmith',
      'pestControl', 'poolMaintenance', 'petServices',
    ].map((category) => ['sk', `business.categories.${category}`]),
  ]
  assert.equal(corrected.length, 30)
  for (const [code, path] of corrected) {
    const resource = resourceForLocale(code, english, await readBaseLocale(code, english))
    const value = getPath(resource, path)
    assert.equal(typeof value, 'string', `${code}: ${path} is a string`)
    assert.notEqual(value, '', `${code}: ${path} is non-empty`)
    assert.notEqual(
      value,
      getPath(englishResource, path),
      `${code}: ${path} no longer inherits English`,
    )
    assert.deepEqual(
      interpolationVariables(value),
      interpolationVariables(getPath(englishResource, path)),
      `${code}: ${path} preserves interpolation variables`,
    )
    assert.equal(
      value,
      getPath(fallbackLocaleCompletionTranslations[code], path),
      `${code}: ${path} is owned by the fallback completion layer`,
    )
  }

  const expectedSlovakCategories = {
    cleaning: 'Upratovanie',
    plumbing: 'Inštalatérske práce',
    electrical: 'Elektroinštalácie',
    gardening: 'Záhradníctvo',
    paintingDecorating: 'Maľovanie a dekorovanie',
    buildingRenovation: 'Stavebníctvo a renovácie',
    handyman: 'Domáce opravy',
    airConditioning: 'Klimatizácia',
    locksmith: 'Zámočníctvo',
    pestControl: 'Hubenie škodcov',
    poolMaintenance: 'Údržba bazénov',
    petServices: 'Služby pre domáce zvieratá',
  }
  assert.deepEqual(
    Object.fromEntries(
      Object.keys(expectedSlovakCategories).map((category) => [
        category,
        fallbackLocaleCompletionTranslations.sk.business.categories[category],
      ]),
    ),
    expectedSlovakCategories,
  )
  assert.doesNotMatch(
    Object.values(expectedSlovakCategories).join(' '),
    /\b(?:Cleaning|Plumbing|Electrical|Gardening|Handyman|Locksmith|úklid|instalatérství|zámečník|zahradničení|malování|rekonstrukce)\b/iu,
    'Slovak categories contain neither English nor representative Czech substitutions',
  )
  assert.doesNotMatch(
    `${fallbackLocaleCompletionTranslations.uk.common.changeImage} ${fallbackLocaleCompletionTranslations.uk.common.uploading}`,
    /\b(?:изменить|загрузка|загрузить)\b/iu,
    'Ukrainian controls contain no Russian substitutions',
  )
  assert.doesNotMatch(
    `${fallbackLocaleCompletionTranslations.no.common.changeImage} ${fallbackLocaleCompletionTranslations.no.common.uploading}`,
    /\b(?:ikkje|eg|dykk|verksemd|frå|høve)\b/iu,
    'Norwegian controls remain Bokmål',
  )
  assert.notEqual(
    fallbackLocaleCompletionTranslations.sv.common.uploading,
    fallbackLocaleCompletionTranslations.da.common.uploading,
    'Swedish and Danish upload statuses are independently authored',
  )
  assert.notEqual(
    fallbackLocaleCompletionTranslations.da.common.uploading,
    fallbackLocaleCompletionTranslations.no.common.uploading,
    'Danish and Norwegian upload statuses are independently authored',
  )

  assert.deepEqual(
    businessCategoryOptions.map(({ value }) => value),
    [
      'Cleaning', 'Plumbing', 'Electrical', 'Gardening', 'Painting & Decorating',
      'Building & Renovation', 'Handyman', 'Air Conditioning', 'Locksmith',
      'Pest Control', 'Pool Maintenance', 'Pet Services', 'Other',
    ],
    'visible Slovak labels do not change submitted category identifiers',
  )

  for (const code of supportedUILanguages.map(({ code }) => code)) {
    const resource = resourceForLocale(code, english, await readBaseLocale(code, english))
    const legalStrings = flattenLegalStrings(resource.legalPages.terms.sections)
      .concat(flattenLegalStrings(resource.legalPages.privacy.sections))
    assert.equal(legalStrings.length, 55, `${code}: all 55 directly rendered legal strings remain present`)
    for (const text of legalStrings) {
      assert.equal(typeof text, 'string', `${code}: legal content is a string`)
      assert.notEqual(text.trim(), '', `${code}: legal content is non-empty`)
    }
  }

  for (const code of ['fr', 'de', 'nl', 'pt']) {
    const resource = resourceForLocale(code, english, await readBaseLocale(code, english))
    for (const path of fixedPaths) {
      assert.notEqual(
        getPath(resource, path),
        getPath(englishResource, path),
        `${code}: Step 5O correction ${path} remains active`,
      )
    }
  }
})

test('Polish, Romanian, Czech and Italian provider-account scope has no genuine English fallback', async () => {
  const english = await readJsonLocale('en')
  const englishResource = resourceForLocale('en', english, english)
  const scopedPrefixes = ['profile.', 'business.control.', 'business.form.', 'validation.']
  const naturalIdenticalValues = {
    it: new Set(['business.form.contact.emailLabel']),
  }

  for (const code of ['pl', 'ro', 'cs', 'it']) {
    const resource = resourceForLocale(code, english, await readBaseLocale(code, english))
    const scopedEntries = leafEntries(resource)
      .filter(([path, value]) => scopedPrefixes.some((prefix) => path.startsWith(prefix)) && typeof value === 'string')

    for (const [path, value] of scopedEntries) {
      assert.notEqual(value, '', `${code}: ${path} is non-empty`)
      const canonicalPath = /_(few|many)$/.test(path)
        ? path.replace(/_(few|many)$/, '_other')
        : path
      const englishValue = getPath(englishResource, canonicalPath)
      assert.deepEqual(
        interpolationVariables(value),
        interpolationVariables(englishValue),
        `${code}: ${path} preserves interpolation variables`,
      )
      if (!naturalIdenticalValues[code]?.has(path)) {
        assert.notEqual(value, englishValue, `${code}: ${path} does not inherit English`)
      }
    }

    assert.equal(
      getPath(resource, 'validation.passwordLength'),
      getPath(fallbackLocaleCompletionTranslations[code], 'validation.passwordLength'),
      `${code}: password-length validation is active from the completion layer`,
    )
  }
})

test('Slovak provider-account scope has no genuine English or Czech substitution', async () => {
  const english = await readJsonLocale('en')
  const englishResource = resourceForLocale('en', english, english)
  const slovak = resourceForLocale('sk', english, await readBaseLocale('sk', english))
  const scopedPrefixes = ['profile.', 'business.control.', 'business.form.', 'validation.']
  const scopedEntries = leafEntries(slovak)
    .filter(([path, value]) => scopedPrefixes.some((prefix) => path.startsWith(prefix)) && typeof value === 'string')

  for (const [path, value] of scopedEntries) {
    assert.notEqual(value, '', `sk: ${path} is non-empty`)
    const canonicalPath = /_(few|many)$/.test(path)
      ? path.replace(/_(few|many)$/, '_other')
      : path
    const englishValue = getPath(englishResource, canonicalPath)
    assert.deepEqual(
      interpolationVariables(value),
      interpolationVariables(englishValue),
      `sk: ${path} preserves interpolation variables`,
    )
    assert.notEqual(value, englishValue, `sk: ${path} does not inherit English`)
  }

  assert.equal(slovak.profile.changeImage, 'Zmeniť obrázok')
  assert.equal(slovak.business.form.media.addImages, 'Pridať obrázky')
  assert.equal(slovak.validation.website, 'Zadajte platnú webovú adresu vrátane https://.')
  assert.doesNotMatch(
    JSON.stringify(fallbackLocaleCompletionTranslations.sk),
    /\b(?:Změnit|Přidat|obrázků|webovou)\b/u,
    'Slovak completion does not use representative Czech-only forms',
  )
})

test('Hungarian and Ukrainian provider-account scope has no genuine English fallback', async () => {
  const english = await readJsonLocale('en')
  const englishResource = resourceForLocale('en', english, english)
  const scopedPrefixes = ['profile.', 'business.control.', 'business.form.', 'validation.']

  for (const code of ['hu', 'uk']) {
    const resource = resourceForLocale(code, english, await readBaseLocale(code, english))
    const scopedEntries = leafEntries(resource)
      .filter(([path, value]) => scopedPrefixes.some((prefix) => path.startsWith(prefix)) && typeof value === 'string')

    for (const [path, value] of scopedEntries) {
      assert.notEqual(value, '', `${code}: ${path} is non-empty`)
      const canonicalPath = /_(few|many)$/.test(path)
        ? path.replace(/_(few|many)$/, '_other')
        : path
      const englishValue = getPath(englishResource, canonicalPath)
      assert.deepEqual(
        interpolationVariables(value),
        interpolationVariables(englishValue),
        `${code}: ${path} preserves interpolation variables`,
      )
      assert.notEqual(value, englishValue, `${code}: ${path} does not inherit English`)
    }
  }

  const hungarian = resourceForLocale('hu', english, await readBaseLocale('hu', english))
  assert.equal(hungarian.profile.changeImage, 'Kép módosítása')
  assert.equal(hungarian.business.form.location.radius, 'Szolgáltatási sugár (km)')
  assert.equal(hungarian.validation.passwordLength, 'Legalább nyolc karaktert használj.')

  const ukrainian = resourceForLocale('uk', english, await readBaseLocale('uk', english))
  assert.equal(ukrainian.profile.changeImage, 'Змінити зображення')
  assert.equal(ukrainian.business.form.contact.messagingHelp, 'Повідомлення HolaLocal завжди доступні.')
  assert.equal(ukrainian.validation.customServiceArea, 'Введіть власну зону обслуговування.')
  assert.doesNotMatch(
    JSON.stringify(fallbackLocaleCompletionTranslations.uk),
    /[ыэёъ]|\b(?:аккаунт|сообщение|настройка|отзыв|загрузить|проверка)\b/iu,
    'Ukrainian completion does not contain representative Russian substitutions',
  )
})

test('Swedish, Danish, Finnish and Norwegian provider-account scope is independently localized', async () => {
  const english = await readJsonLocale('en')
  const englishResource = resourceForLocale('en', english, english)
  const scopedPrefixes = ['profile.', 'business.control.', 'business.form.', 'validation.']
  const naturalIdenticalValues = {
    da: new Set(['business.form.media.uploadLogo']),
  }
  const resources = {}

  for (const code of ['sv', 'da', 'fi', 'no']) {
    const resource = resourceForLocale(code, english, await readBaseLocale(code, english))
    resources[code] = resource
    const scopedEntries = leafEntries(resource)
      .filter(([path, value]) => scopedPrefixes.some((prefix) => path.startsWith(prefix)) && typeof value === 'string')

    for (const [path, value] of scopedEntries) {
      assert.notEqual(value, '', `${code}: ${path} is non-empty`)
      const canonicalPath = /_(few|many)$/.test(path)
        ? path.replace(/_(few|many)$/, '_other')
        : path
      const englishValue = getPath(englishResource, canonicalPath)
      assert.deepEqual(
        interpolationVariables(value),
        interpolationVariables(englishValue),
        `${code}: ${path} preserves interpolation variables`,
      )
      if (!naturalIdenticalValues[code]?.has(path)) {
        assert.notEqual(value, englishValue, `${code}: ${path} does not inherit English`)
      }
    }
  }

  assert.equal(resources.sv.business.form.media.addImages, 'Lägg till bilder')
  assert.equal(resources.da.business.form.media.addImages, 'Tilføj billeder')
  assert.equal(resources.fi.business.form.media.addImages, 'Lisää kuvia')
  assert.equal(resources.no.business.form.media.addImages, 'Legg til bilder')
  assert.equal(resources.fi.business.form.location.radius, 'Palvelusäde (km)')
  assert.equal(resources.no.business.form.location.radius, 'Tjenesteradius (km)')

  for (const [left, right] of [['sv', 'da'], ['sv', 'no'], ['da', 'no'], ['fi', 'sv']]) {
    assert.notDeepEqual(
      fallbackLocaleCompletionTranslations[left],
      fallbackLocaleCompletionTranslations[right],
      `${left} and ${right} use independent completion objects`,
    )
  }
  assert.doesNotMatch(
    JSON.stringify(fallbackLocaleCompletionTranslations.no),
    /\b(?:ikkje|eg|dykk|verksemd|frå|høve)\b/iu,
    'Norwegian completion remains Bokmål rather than Nynorsk',
  )
})

test('locale-specific plural categories resolve without English fallback', async () => {
  const english = await readJsonLocale('en')
  const resources = {}
  for (const { code } of supportedUILanguages) {
    resources[code] = {
      translation: resourceForLocale(code, english, await readBaseLocale(code, english)),
    }
  }
  const runtime = i18next.createInstance()
  await runtime.init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    supportedLngs: supportedUILanguages.map(({ code }) => code),
    initImmediate: false,
    interpolation: { escapeValue: false },
    returnNull: false,
  })

  const counts = [0, 1, 2, 3, 4, 5, 10, 11, 12, 20, 21, 22, 25, 100, 101, 102]
  const pluralStems = [
    'marketing.hero.ratingCount',
    'services.resultCount',
    'business.control.heroContextAreas',
    'business.control.missingCount',
    'business.control.serviceAreas',
    'business.form.errors.galleryRemaining',
    'publicBusinessDetail.reviewCount',
  ]

  for (const code of ['pl', 'ro', 'cs', 'sk', 'hu', 'uk', 'it', 'fi', 'sv', 'da', 'no']) {
    for (const stem of pluralStems) {
      const isCovered = ['pl', 'ro', 'cs', 'sk', 'hu', 'uk', 'it', 'fi', 'sv', 'da', 'no'].includes(code)
        || stem === 'publicBusinessDetail.reviewCount'
      for (const count of counts) {
        const details = runtime.t(stem, { count, lng: code, returnDetails: true })
        assert.notEqual(details.res, stem, `${code}: ${stem} count ${count} is not a raw key`)
        assert.match(String(details.res), new RegExp(String(count)), `${code}: ${stem} count interpolates`)
        if (isCovered) {
          const category = new Intl.PluralRules(code).select(count)
          assert.equal(details.usedLng, code, `${code}: ${stem} count ${count} remains localized`)
          assert.equal(details.exactUsedKey, `${stem}_${category}`, `${code}: ${stem} count ${count} category`)
        }
      }
    }
  }

  const countNeutralSelectedAreas = {
    es: 'Zonas seleccionadas: {{count}}',
    fr: 'Zones sélectionnées : {{count}}',
    pt: 'Áreas selecionadas: {{count}}',
    ro: 'Zone selectate: {{count}}',
    it: 'Aree selezionate: {{count}}',
    sv: 'Valda områden: {{count}}',
    fi: 'Valitut alueet: {{count}}',
  }
  for (const [code, expected] of Object.entries(countNeutralSelectedAreas)) {
    assert.equal(
      resources[code].translation.business.form.location.totalSelected,
      expected,
      `${code}: selected-area count uses neutral wording`,
    )
  }
})

test('canonical website user view preserves behavior and opaque timestamps', () => {
  const timestamp = new TimestampFixture()
  const raw = {
    uid: 'user-1', email: 'user@example.invalid', displayName: 'Synthetic User',
    displayNameNormalized: 'synthetic user', roles: ['customer', 'business'], accountType: 'both',
    preferredLocale: 'es', accountStatus: 'active', profileCompleted: true,
    onboardingCompleted: true, businessProfileRequired: true, businessProfileCompleted: true,
    businessId: 'business-1', createdAt: timestamp, updatedAt: timestamp,
  }
  const before = { ...raw }
  const profile = toWebsiteUserProfile('user-1', raw)
  assert.deepEqual(profile.roles, ['customer', 'business'])
  assert.equal(profile.accountType, 'both')
  assert.equal(profile.preferredLocale, 'es')
  assert.equal(profile.createdAt, timestamp)
  assert.equal(profile.compatibility.writeSafe, false)
  assert.deepEqual(raw, before)
})

test('legacy mobile user is interpreted without promoting trust', () => {
  const raw = {
    uid: 'legacy-user', email: 'legacy@example.invalid', displayName: 'Legacy User',
    accountType: 'business', preferredLanguage: 'Deutsch', accountStatus: 'active',
    profileCompleted: true, onboardingCompleted: true, isVerified: true, isPremium: true,
  }
  const profile = toWebsiteUserProfile('legacy-user', raw)
  assert.deepEqual(profile.roles, ['business'])
  assert.equal(profile.preferredLocale, 'de')
  assert.equal(profile.emailVerified, null)
  assert.equal('isPremium' in profile, false)
  assert.equal(profile.compatibility.writeSafe, false)
})

test('roles win conflicts so accountType cannot grant additional access', () => {
  const profile = toWebsiteUserProfile('conflict-user', {
    email: 'conflict@example.invalid', roles: ['customer'], accountType: 'both',
    preferredLocale: 'en', accountStatus: 'active',
  })
  assert.deepEqual(profile.roles, ['customer'])
  assert.equal(profile.accountType, 'both')
  assert.equal(profile.roles.includes('business'), false)
})

test('canonical managed and public business views remain compatible', () => {
  const raw = canonicalBusiness({ status: 'active', publishedAt: new TimestampFixture(), ratingAverage: 4.5, ratingCount: 2 })
  const managed = toManagedBusinessView('business-1', raw)
  const publicView = toPublicBusinessView('business-1', raw)
  assert.equal(isPublicBusinessEligible(raw), true)
  assert.equal(managed.name, 'Canonical Business')
  assert.equal(managed.businessId, 'business-1')
  assert.equal(managed.subscription.planId, 'early_access')
  assert.equal(managed.entitlements.effectivePlanId, 'early_access')
  assert.equal(managed.entitlements.resolutionSource, 'legacy_compatibility')
  assert.equal(managed.entitlements.features.businessInsights, true)
  assert.equal(managed.entitlements.limits.galleryImages, 8)
  assert.equal(publicView.name, 'Canonical Business')
  assert.equal(publicView.status, 'active')
  assert.equal(publicView.subscriptionTier, 'early_access')
  assert.equal(publicView.subscriptionStatus, 'active')
  assert.equal('subscription' in publicView, false)
  assert.equal('entitlements' in publicView, false)
  assert.equal(publicView.ratingAverage, 4.5)
})

test('managed business views resolve canonical and malformed subscription states safely', () => {
  const canonical = toManagedBusinessView('growth-business', canonicalBusiness({
    subscription: {
      schemaVersion: 1,
      planId: 'growth',
      planRevision: 1,
      accessStatus: 'active',
      assignmentSource: 'admin',
    },
  }))
  assert.equal(canonical.subscription.planId, 'growth')
  assert.equal(canonical.entitlements.assignedPlanId, 'growth')
  assert.equal(canonical.entitlements.effectivePlanId, 'growth')
  assert.equal(canonical.entitlements.baselineApplied, true)
  assert.equal(canonical.entitlements.limits.categoryIds, 30)

  const publicGrowth = toPublicBusinessView('growth-public-business', canonicalBusiness({
    status: 'active',
    publishedAt: new TimestampFixture(),
    subscription: {
      schemaVersion: 1,
      planId: 'growth',
      planRevision: 1,
      accessStatus: 'active',
      assignmentSource: 'admin',
    },
  }))
  assert.equal(publicGrowth.subscriptionTier, 'growth')
  assert.equal(publicGrowth.subscriptionStatus, 'active')
  assert.equal('subscription' in publicGrowth, false)
  assert.equal('entitlements' in publicGrowth, false)

  const malformed = toManagedBusinessView('malformed-business', canonicalBusiness({
    subscription: { schemaVersion: 1, planId: 'unknown' },
  }))
  assert.equal(malformed.subscription, null)
  assert.equal(malformed.entitlements.effectivePlanId, 'early_access')
  assert.equal(malformed.entitlements.resolutionSource, 'fallback')
  assert.equal(malformed.entitlements.features.publicListing, true)
})

test('public directory eligibility only allows active safe records', () => {
  for (const status of ['draft', 'pending_review', 'rejected', 'suspended', 'archived', 'deleted']) {
    const raw = canonicalBusiness({ status })
    assert.equal(isPublicBusinessEligible(raw), false)
    assert.equal(toPublicBusinessView(`business-${status}`, canonicalBusiness({ status })), null)
  }
  assert.equal(isPublicBusinessEligible(canonicalBusiness({
    status: 'active',
    publishedAt: new TimestampFixture(),
    deletedAt: new TimestampFixture(),
  })), false)
  assert.equal(isPublicBusinessEligible(canonicalBusiness({
    status: 'active',
    publishedAt: new TimestampFixture(),
    deletionRequestedAt: new TimestampFixture(),
  })), false)

  const activeLegacyShape = {
    ownerId: 'owner-1',
    managerIds: ['owner-1'],
    businessName: 'Legacy Named Business',
    mainCategory: 'Cleaning',
    subcategories: ['Cleaning'],
    serviceAreas: ['Málaga'],
    languages: ['English'],
    primaryLanguage: 'English',
    city: 'Málaga',
    status: 'active',
    publishedAt: new TimestampFixture(),
    verificationStatus: 'unverified',
    subscription: { tier: 'free', status: 'none' },
    isVerified: true,
    isPremium: true,
    email: 'private@example.invalid',
    contact: {
      ...canonicalContact,
      website: 'https://example.invalid',
      websiteVisible: false,
    },
  }
  const publicView = toPublicBusinessView('legacy-canonical-active', activeLegacyShape)
  assert.equal(publicView, null)
})

test('legacy UID business is owner-readable without trust or media promotion', () => {
  const raw = {
    ownerId: 'owner-1', businessName: 'Legacy Business', mainCategory: 'Cleaning',
    subcategories: ['Cleaning'], serviceAreas: ['Málaga', 'Custom Coast'],
    languages: ['English', 'Custom Tongue'], primaryLanguage: 'English', city: 'Málaga',
    phone: '000000000', email: 'legacy@example.invalid', website: 'https://example.invalid',
    logoURL: 'https://example.invalid/logo.png', galleryImageURLs: ['https://example.invalid/work.png'],
    isActive: true, isVerified: true, isPremium: true, subscriptionTier: 'paid',
  }
  const before = structuredClone(raw)
  const managed = toManagedBusinessView('owner-1', raw)
  assert.equal(managed.name, 'Legacy Business')
  assert.equal(managed.primaryCategoryId, 'Cleaning')
  assert.deepEqual(managed.languages, ['en', 'Custom Tongue'])
  assert.deepEqual(managed.serviceAreas, ['malaga', 'Custom Coast'])
  assert.equal(managed.status, null)
  assert.equal(managed.verificationStatus, null)
  assert.equal(managed.subscription, null)
  assert.equal(managed.profilePhoto, null)
  assert.equal(managed.logoUrl, raw.logoURL)
  assert.equal(managed.contact.phoneVisible, false)
  assert.equal(managed.contact.website, '')
  assert.equal(managed.legacyPrivateContact.website, raw.website)
  assert.equal(toPublicBusinessView('owner-1', raw), null)
  assert.deepEqual(raw, before)
})

test('legacy top-level contacts never enter an otherwise canonical public view', () => {
  const publicView = toPublicBusinessView('business-1', canonicalBusiness({
    status: 'active', publishedAt: new TimestampFixture(), contact: undefined, phone: '000000000', email: 'legacy@example.invalid',
  }))
  assert.equal(publicView, null)
})

test('public contact eligibility rejects hidden values and allows explicit visibility', () => {
  const hidden = toPublicBusinessView('business-hidden', canonicalBusiness({
    status: 'active',
    publishedAt: new TimestampFixture(),
    contact: {
      ...canonicalContact,
      phone: '000000000',
      email: 'owner@example.invalid',
      whatsappNumber: '111111111',
      website: 'https://example.invalid',
    },
  }))
  assert.equal(hidden, null)

  const visible = toPublicBusinessView('business-visible', canonicalBusiness({
    status: 'active',
    publishedAt: new TimestampFixture(),
    contact: {
      ...canonicalContact,
      phone: '000000000',
      phoneVisible: true,
      email: 'owner@example.invalid',
      emailVisible: true,
      whatsappNumber: '111111111',
      whatsappVisible: true,
      website: 'https://example.invalid',
      websiteVisible: true,
    },
  }))
  assert.equal(visible.contact.phone, '000000000')
  assert.equal(visible.contact.email, 'owner@example.invalid')
  assert.equal(visible.contact.whatsappNumber, '111111111')
  assert.equal(visible.contact.website, 'https://example.invalid')
})

test('business editor includes all four explicit public-contact visibility controls', async () => {
  const [editor, english] = await Promise.all([
    readFile(new URL('../src/pages/business/EditBusinessPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/i18n/locales/en.json', import.meta.url), 'utf8'),
  ])
  for (const field of ['emailVisible', 'phoneVisible', 'whatsappVisible', 'websiteVisible']) {
    assert.match(editor, new RegExp(`${field}: false`))
    assert.match(editor, new RegExp(`${field}: profile\\?\\.contact\\?\\.${field}`))
    assert.match(editor, new RegExp(`${field}: form\\.${field}`))
  }
  const translations = JSON.parse(english)
  assert.equal(translations.business.form.contact.showEmail, 'Show email on my public profile')
  assert.equal(translations.business.form.contact.showPhone, 'Show phone number on my public profile')
  assert.equal(translations.business.form.contact.showWhatsapp, 'Show WhatsApp on my public profile')
  assert.equal(translations.business.form.contact.showWebsite, 'Show website on my public profile')
})

test('business editor controlled option labels resolve for every supported locale', async () => {
  const [english, editor] = await Promise.all([
    readJsonLocale('en'),
    readFile(new URL('../src/pages/business/EditBusinessPage.jsx', import.meta.url), 'utf8'),
  ])
  const rawKeys = [
    'business.categories.cleaning',
    'locations.countries.ES',
    'locations.groups.malaga',
    'locations.groups.cadiz',
    'locations.groups.gibraltar',
    'locations.groups.other',
    'common.other',
  ]
  const categoryIds = businessCategoryOptions.map((option) => option.value)
  const countryIds = countryOptions.map((option) => option.value)
  const serviceAreaIds = serviceAreaOptions.map((option) => option.value)
  const serviceAreaGroups = [...new Set(serviceAreaOptions.map((option) => option.group))]

  assert.deepEqual(categoryIds, [
    'Cleaning', 'Plumbing', 'Electrical', 'Gardening', 'Painting & Decorating',
    'Building & Renovation', 'Handyman', 'Air Conditioning', 'Locksmith',
    'Pest Control', 'Pool Maintenance', 'Pet Services', 'Other',
  ])
  assert.deepEqual(countryIds, ['ES', 'GI'])
  assert.equal(serviceAreaIds.includes('marbella'), true)
  assert.equal(serviceAreaIds.includes('other'), false)

  for (const { code } of supportedUILanguages) {
    const baseLocale = await readBaseLocale(code, english)
    const resource = mergeLocale(
      english,
      baseLocale,
      authenticatedTranslations[code],
      { locations: { areas: serviceAreaLabels } },
    )
    const translate = translatorFor(resource)

    assert.equal(translate('common.other') === 'common.other', false, `${code}: common.other resolves`)
    for (const key of rawKeys) {
      assert.notEqual(translate(key), key, `${code}: ${key} resolves`)
    }
    for (const option of businessCategoryOptions) {
      assert.notEqual(getBusinessCategoryLabel(option.value, translate), option.labelKey, `${code}: ${option.labelKey}`)
    }
    for (const option of countryOptions) {
      assert.notEqual(translate(option.labelKey, { defaultValue: option.defaultLabel }), option.labelKey, `${code}: ${option.labelKey}`)
    }
    for (const group of serviceAreaGroups) {
      assert.notEqual(getServiceAreaGroupLabel(group, translate), `locations.groups.${group}`, `${code}: locations.groups.${group}`)
      assert.notEqual(getServiceAreaGroupLabel(group, translate), group, `${code}: group ${group} is not a raw id`)
    }
    for (const option of serviceAreaOptions) {
      assert.notEqual(getServiceAreaLabel(option.value, translate), option.labelKey, `${code}: ${option.labelKey}`)
    }
  }

  assert.doesNotMatch(editor, /label:\s*['"](?:Spain|Málaga|Cádiz|Gibraltar|Other)['"]/)
  assert.match(editor, /<LocationCombobox/)
  assert.match(editor, /primaryLocationSelectionState\(location\)/)
  assert.match(editor, /locationDisplayLabel\(area\.location\)/)
  assert.match(editor, /getServiceAreaGroupLabel\(area\.group, t\)/)
  assert.match(editor, /t\('common\.other', \{ defaultValue: 'Other' \}\)/)
})

test('homepage business previews use canonical category and localized language labels', async () => {
  const english = await readJsonLocale('en')
  const spanish = await readJsonLocale('es')
  const englishResource = mergeLocale(english, authenticatedTranslations.en, { locations: { areas: serviceAreaLabels } })
  const spanishResource = mergeLocale(english, spanish, authenticatedTranslations.es, { locations: { areas: serviceAreaLabels } })
  const englishTranslate = translatorFor(englishResource)
  const spanishTranslate = translatorFor(spanishResource)

  assert.equal(getBusinessCategoryLabel('Cleaning', englishTranslate), 'Cleaning')
  assert.equal(getBusinessCategoryLabel('Cleaning', spanishTranslate), 'Limpieza')
  assert.equal(englishTranslate('services.noReviews'), 'No reviews yet')
  assert.equal(spanishTranslate('services.noReviews'), 'Aún no hay reseñas')
  assert.equal(englishTranslate('marketing.hero.activeProfile'), 'Public profile')
  assert.equal(spanishTranslate('marketing.hero.activeProfile'), 'Perfil público')
  assert.equal(englishTranslate('marketing.trust.verified.title'), 'Business verification')
  assert.equal(englishTranslate('marketing.trust.verified.comingSoon'), 'Coming soon')
  assert.equal(englishTranslate('marketing.hero.previousBusiness'), 'Previous business')
  assert.equal(englishTranslate('marketing.hero.nextBusiness'), 'Next business')
  assert.equal(englishTranslate('marketing.hero.businessPosition'), 'Business {{current}} of {{total}}')
  assert.equal(
    englishTranslate('marketing.trust.verified.description'),
    'We are developing a verification process to help customers recognise businesses whose identity and registration details have been checked.',
  )
  assert.equal(formatLanguageList(['en', 'es'], 'en'), 'English • Spanish')
  assert.equal(formatLanguageList(['en', 'es'], 'es'), 'Inglés • Español')
  assert.equal(getLanguageDisplayName('en', 'fr'), 'Anglais')
})

test('all supported locales resolve home card and footer translation keys', async () => {
  const english = await readJsonLocale('en')
  const requiredHomeCardKeys = [
    'services.noReviews',
    'services.notSpecified',
    'marketing.hero.activeProfile',
    'marketing.hero.exampleProfile',
    'marketing.hero.loadFailure',
    'marketing.hero.exampleCleaningName',
    'marketing.hero.exampleGardenName',
    'marketing.hero.exampleRepairsName',
    'marketing.hero.verifiedProfile',
    'marketing.trust.verified.title',
    'marketing.trust.verified.comingSoon',
    'marketing.trust.verified.description',
    'marketing.hero.previousBusiness',
    'marketing.hero.nextBusiness',
    'marketing.hero.businessPosition',
    'marketing.hero.ratingCount_one',
    'marketing.hero.ratingCount_other',
    'marketing.hero.locationLabel',
    'marketing.hero.languagesLabel',
  ]
  const requiredFooterKeys = [
    'footer.description',
    'footer.platform',
    'footer.platformLabel',
    'footer.account',
    'footer.accountLabel',
    'footer.legal',
    'footer.legalLabel',
    'footer.privacy',
    'footer.terms',
    'footer.contact',
    'footer.language',
    'footer.copyright',
    'footer.poweredBy',
    'nav.home',
    'nav.findServices',
    'nav.join',
    'account.signIn',
  ]

  for (const { code } of supportedUILanguages) {
    const baseLocale = await readBaseLocale(code, english)
    const resource = resourceForLocale(code, english, baseLocale)
    const translate = translatorFor(resource)

    for (const key of [...requiredHomeCardKeys, ...requiredFooterKeys]) {
      const value = translate(key, { count: 2 })
      assert.notEqual(value, key, `${code}: ${key}`)
      assert.equal(typeof value, 'string', `${code}: ${key} is a string`)
      assert.notEqual(value.trim(), '', `${code}: ${key} is non-empty`)
    }

    const positionLabel = translate('marketing.hero.businessPosition')
      .replace('{{current}}', '1')
      .replace('{{total}}', '3')
    assert.notEqual(positionLabel, 'marketing.hero.businessPosition', `${code}: business position resolves`)
    assert.match(positionLabel, /1/)
    assert.match(positionLabel, /3/)

    if (code !== 'en') {
      assert.notEqual(translate('marketing.hero.activeProfile'), 'Public profile', `${code}: public profile localized`)
      assert.notEqual(translate('marketing.hero.exampleProfile'), 'Example profile', `${code}: example profile localized`)
      assert.notEqual(
        translate('marketing.hero.loadFailure'),
        'Featured businesses could not be loaded right now. Please try again later.',
        `${code}: featured-business failure localized`,
      )
      assert.notEqual(translate('marketing.hero.exampleCleaningName'), 'Example Cleaning Service', `${code}: cleaning example localized`)
      assert.notEqual(translate('marketing.hero.exampleGardenName'), 'Example Garden Service', `${code}: garden example localized`)
      assert.notEqual(translate('marketing.hero.exampleRepairsName'), 'Example Home Repairs', `${code}: repairs example localized`)
      assert.notEqual(translate('marketing.trust.verified.title'), 'Business verification', `${code}: verification title localized`)
      assert.notEqual(translate('marketing.trust.verified.comingSoon'), 'Coming soon', `${code}: coming soon localized`)
      assert.notEqual(translate('marketing.hero.previousBusiness'), 'Previous business', `${code}: previous business localized`)
      assert.notEqual(translate('marketing.hero.nextBusiness'), 'Next business', `${code}: next business localized`)
      assert.notEqual(
        translate('marketing.trust.verified.description'),
        'We are developing a verification process to help customers recognise businesses whose identity and registration details have been checked.',
        `${code}: verification description localized`,
      )
    }

    for (const option of businessCategoryOptions) {
      const label = getBusinessCategoryLabel(option.value, translate)
      assert.notEqual(label, option.labelKey, `${code}: ${option.labelKey}`)
      assert.notEqual(label.trim(), '', `${code}: ${option.value} label is non-empty`)
    }

    const languageList = formatLanguageList(['en', 'es'], code)
    assert.doesNotMatch(languageList, /undefined|language/i, `${code}: localized language display`)
    assert.notEqual(languageList.trim(), '', `${code}: localized language display is non-empty`)
  }
})

test('shared navigation, homepage carousel, and footer keep their responsive width contracts', async () => {
  const [baseStyles, globalStyles, homePage] = await Promise.all([
    readFile(new URL('../src/styles/base.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles/global.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/HomePage.jsx', import.meta.url), 'utf8'),
  ])
  const mobileNavigation = globalStyles.match(
    /\.mobile-navigation > nav \{[\s\S]*?\n\}/,
  )?.[0] ?? ''
  const heroViewport = globalStyles.match(
    /\.marketing-hero__viewport \{[\s\S]*?\n\}/,
  )?.[0] ?? ''
  const heroTrack = globalStyles.match(
    /\.marketing-hero__track \{[\s\S]*?\n\}/,
  )?.[0] ?? ''
  const footerInner = globalStyles.match(
    /\.site-footer__inner \{[\s\S]*?\n\}/,
  )?.[0] ?? ''
  const footerNavigation = globalStyles.match(
    /\.site-footer__navigation \{[\s\S]*?\n\}/,
  )?.[0] ?? ''
  const footerLinks = globalStyles.match(
    /\.site-footer__links \{[\s\S]*?\n\}/,
  )?.[0] ?? ''

  assert.match(mobileNavigation, /position: fixed/)
  assert.match(mobileNavigation, /width: min\(17rem, calc\(100% - 1\.5rem\)\)/)
  assert.doesNotMatch(mobileNavigation, /100vw/)
  const viewportMarkupIndex = homePage.indexOf('className="marketing-hero__viewport"')
  const trackMarkupIndex = homePage.indexOf('className="marketing-hero__track"')
  const controlsMarkupIndex = homePage.indexOf('className="marketing-hero__carousel-controls"')
  assert.ok(viewportMarkupIndex >= 0)
  assert.ok(trackMarkupIndex > viewportMarkupIndex)
  assert.ok(controlsMarkupIndex > trackMarkupIndex)
  assert.match(homePage, /businesses\.map\(\(business\) => \([\s\S]*?<PublicBusinessCard/)
  assert.match(heroViewport, /width: 100%/)
  assert.match(heroViewport, /max-width: 100%/)
  assert.match(heroViewport, /min-width: 0/)
  assert.match(heroViewport, /overflow: hidden/)
  assert.match(heroViewport, /contain: layout paint/)
  assert.match(heroTrack, /overflow-x: auto/)
  assert.match(globalStyles, /\.public-business-card--hero \{[\s\S]*?flex: 0 0 100%/)
  assert.doesNotMatch(
    globalStyles,
    /\.marketing-hero__viewport\s*\{[^}]*(?:overflow|overflow-x):\s*visible/s,
  )
  assert.doesNotMatch(
    `${baseStyles}\n${globalStyles}`,
    /(?:html|body|#root)[^{]*\{[^}]*overflow-x:\s*hidden/s,
  )
  assert.match(footerInner, /text-align: center/)
  assert.match(footerNavigation, /justify-items: center/)
  assert.match(footerLinks, /align-items: center/)
  assert.doesNotMatch(globalStyles, /\.site-footer__links a:hover \{[^}]*translateX/s)
})

test('public business-detail translations are complete and localized for every supported locale', async () => {
  const english = await readJsonLocale('en')
  const englishResource = resourceForLocale('en', english, english)
  const reference = englishResource.publicBusinessDetail
  const representativeKeys = [
    'backToResults',
    'verificationComingSoon',
    'messageBusiness',
    'workImageAlt',
    'noContact',
    'messageError',
    'reportError',
    'unavailableTitle',
    'unavailableDescription',
  ]
  const expectedPluralExtensions = {
    pl: ['reviewCount_few', 'reviewCount_many'],
    ro: ['reviewCount_few'],
    cs: ['reviewCount_few'],
    sk: ['reviewCount_few'],
    uk: ['reviewCount_few', 'reviewCount_many'],
  }

  assert.equal(Object.keys(reference).length, 45)

  for (const { code } of supportedUILanguages) {
    const baseLocale = await readBaseLocale(code, english)
    const resource = resourceForLocale(code, english, baseLocale)
    const extraKeys = Object.keys(resource.publicBusinessDetail)
      .filter((key) => !Object.hasOwn(reference, key))
      .sort()
    assert.deepEqual(extraKeys, expectedPluralExtensions[code] ?? [], `${code}: valid plural extensions`)

    for (const key of Object.keys(reference)) {
      assert.equal(typeof resource.publicBusinessDetail[key], 'string', `${code}: ${key} is a string`)
      assert.notEqual(resource.publicBusinessDetail[key].trim(), '', `${code}: ${key} is non-empty`)
    }
    for (const key of extraKeys) {
      assert.equal(typeof resource.publicBusinessDetail[key], 'string', `${code}: ${key} is a string`)
      assert.deepEqual(
        interpolationVariables(resource.publicBusinessDetail[key]),
        interpolationVariables(reference.reviewCount_other),
        `${code}: ${key} interpolation variables`,
      )
    }

    if (code !== 'en') {
      for (const key of representativeKeys) {
        assert.notEqual(
          resource.publicBusinessDetail[key],
          reference[key],
          `${code}: ${key} is localized`,
        )
      }
    }
  }

  for (const code of ['es', 'cs', 'fi']) {
    const baseLocale = await readBaseLocale(code, english)
    const detail = resourceForLocale(code, english, baseLocale).publicBusinessDetail
    assert.notEqual(detail.backToResults, reference.backToResults, `${code}: translated return action`)
    assert.notEqual(detail.messageBusiness, reference.messageBusiness, `${code}: translated message action`)
    assert.notEqual(detail.unavailableTitle, reference.unavailableTitle, `${code}: translated unavailable state`)
  }
})

test('legal page body content is locale-driven and structurally complete for every supported locale', async () => {
  const english = await readJsonLocale('en')
  const englishResource = resourceForLocale('en', english, english)
  const canonicalTermsSentence = 'HolaLocal is a developing local marketplace.'
  const canonicalPrivacySentence = 'HolaLocal is being developed for customers looking for local services'
  const canonicalEnglishSnippets = [
    canonicalTermsSentence,
    'You must provide accurate account information',
    'Customer accounts are for finding local services',
    canonicalPrivacySentence,
    'Account details, such as your name',
  ]
  const canonicalSpanishSnippets = [
    'HolaLocal es un mercado local en desarrollo.',
    'Debes proporcionar información de cuenta exacta',
    'Las cuentas de clientes sirven',
  ]
  const expectedLocaleCodes = supportedUILanguages.map(({ code }) => code).sort()

  assert.equal(englishResource.legalPages.version, 'Version 1 · Effective 4 July 2026')
  assert.equal(englishResource.legalPages.terms.sections[0].paragraphs[0].startsWith(canonicalTermsSentence), true)
  assert.equal(englishResource.legalPages.privacy.sections[0].paragraphs[0].startsWith(canonicalPrivacySentence), true)
  assert.deepEqual(Object.keys(legalPageContent).sort(), expectedLocaleCodes)

  for (const { code } of supportedUILanguages) {
    const baseLocale = await readBaseLocale(code, english)
    const resource = resourceForLocale(code, english, baseLocale)
    const translate = translatorFor(resource)

    for (const key of [
      'legalPages.version',
      'legalPages.terms.title',
      'legalPages.terms.description',
      'legalPages.privacy.title',
      'legalPages.privacy.description',
    ]) {
      const value = translate(key)
      assert.notEqual(value, key, `${code}: ${key}`)
      assert.notEqual(value.trim(), '', `${code}: ${key}`)
    }

    assert.deepEqual(
      resource.legalPages.terms.sections.map((section) => section.key),
      englishResource.legalPages.terms.sections.map((section) => section.key),
      `${code}: terms section order`,
    )
    assert.deepEqual(
      resource.legalPages.privacy.sections.map((section) => section.key),
      englishResource.legalPages.privacy.sections.map((section) => section.key),
      `${code}: privacy section order`,
    )
    resource.legalPages.terms.sections.forEach((section, index) => {
      const canonical = englishResource.legalPages.terms.sections[index]
      assert.equal(section.paragraphs?.length ?? 0, canonical.paragraphs?.length ?? 0, `${code}: terms ${section.key} paragraph count`)
      assert.equal(section.items?.length ?? 0, canonical.items?.length ?? 0, `${code}: terms ${section.key} item count`)
    })
    resource.legalPages.privacy.sections.forEach((section, index) => {
      const canonical = englishResource.legalPages.privacy.sections[index]
      assert.equal(section.paragraphs?.length ?? 0, canonical.paragraphs?.length ?? 0, `${code}: privacy ${section.key} paragraph count`)
      assert.equal(section.items?.length ?? 0, canonical.items?.length ?? 0, `${code}: privacy ${section.key} item count`)
    })

    const legalStrings = flattenLegalStrings(resource.legalPages.terms.sections)
      .concat(flattenLegalStrings(resource.legalPages.privacy.sections))
    for (const text of legalStrings) {
      assert.equal(typeof text, 'string', `${code}: legal text is string`)
      assert.notEqual(text.trim(), '', `${code}: legal text is non-empty`)
      assert.doesNotMatch(text, /^legalPages\./, `${code}: no raw legal key`)
    }

    if (code !== 'en') {
      for (const snippet of canonicalEnglishSnippets) {
        assert.equal(
          legalStrings.some((text) => text.includes(snippet)),
          false,
          `${code}: does not fall back to canonical English legal body`,
        )
      }
    }

    if (code !== 'es') {
      for (const snippet of canonicalSpanishSnippets) {
        assert.equal(
          legalStrings.some((text) => text.includes(snippet)),
          false,
          `${code}: does not reuse Spanish legal body`,
        )
      }
    }
  }
})

test('lookup accepts a valid user pointer and deduplicates the same owner-query document', () => {
  const document = canonicalBusiness()
  const result = resolveWebsiteBusinessLookup({
    ownerId: 'owner-1',
    pointerCandidate: { businessId: 'business-1', ownerId: 'owner-1', document },
    ownerCandidates: [{ businessId: 'business-1', ownerId: 'owner-1', document }],
  })
  assert.equal(result.lookup.status, 'found')
  assert.equal(result.lookup.source, 'user_business_id')
  assert.equal(result.document, document)
})

test('lookup reports invalid pointers and owner mismatches without selecting them', () => {
  assert.equal(resolveWebsiteBusinessLookup({ ownerId: 'owner-1', pointerInvalid: true }).lookup.status, 'invalid_mapping')
  assert.equal(resolveWebsiteBusinessLookup({ ownerId: 'owner-1', uidInvalid: true }).lookup.status, 'invalid_mapping')
  const mismatch = resolveWebsiteBusinessLookup({
    ownerId: 'owner-1',
    pointerCandidate: { businessId: 'other-business', ownerId: 'other-owner', document: {} },
  })
  assert.equal(mismatch.lookup.status, 'owner_mismatch')
  assert.equal(mismatch.document, null)
})

test('lookup treats inaccessible speculative UID document as absent for new business users', () => {
  const result = resolveWebsiteBusinessLookup({
    ownerId: 'owner-1',
    pointerCandidate: null,
    uidCandidate: null,
    ownerCandidates: [],
    pointerInvalid: false,
    uidInvalid: false,
  })

  assert.equal(result.lookup.status, 'not_found')
  assert.equal(result.document, null)
})

test('lookup supports UID and owner-query fallbacks', () => {
  const uid = resolveWebsiteBusinessLookup({
    ownerId: 'owner-1', uidCandidate: { businessId: 'owner-1', ownerId: 'owner-1', document: {} },
  })
  assert.equal(uid.lookup.status, 'found')
  assert.equal(uid.lookup.source, 'owner_uid_document')

  const query = resolveWebsiteBusinessLookup({
    ownerId: 'owner-1', ownerCandidates: [{ businessId: 'business-1', ownerId: 'owner-1', document: {} }],
  })
  assert.equal(query.lookup.status, 'found')
  assert.equal(query.lookup.source, 'owner_id_query')
})

test('multiple candidates are always ambiguous regardless of order', () => {
  const first = { businessId: 'business-a', ownerId: 'owner-1', document: { name: 'A' } }
  const second = { businessId: 'business-b', ownerId: 'owner-1', document: { name: 'B' } }
  for (const ownerCandidates of [[first, second], [second, first]]) {
    const result = resolveWebsiteBusinessLookup({ ownerId: 'owner-1', ownerCandidates })
    assert.equal(result.lookup.status, 'ambiguous')
    assert.deepEqual(result.lookup.candidateDocumentIds, ['business-a', 'business-b'])
    assert.equal(result.document, null)
  }
  assert.equal(resolveWebsiteBusinessLookup({ ownerId: 'owner-1' }).lookup.status, 'not_found')
})

test('compatibility adapters remain isolated from canonical write builders', async () => {
  const [userService, businessService] = await Promise.all([
    readFile(new URL('../src/services/userService.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/businessService.js', import.meta.url), 'utf8'),
  ])
  assert.match(userService, /sanitizeProfileData\(updates\)/)
  assert.match(businessService, /sanitizeBusinessData\(updates\)/)
  assert.match(businessService, /projectPublicContact\(sanitizeContact\(contact\)\)\.contact/)
  assert.match(businessService, /ensureOwnerBusinessCallable\(\)/)
  assert.match(businessService, /if \(privateContact\) safeUpdates\.contact = storedPublicContact\(privateContact\)/)
  assert.match(businessService, /websiteVisible: contact\.websiteVisible === true/)
  assert.doesNotMatch(userService, /transaction\.(?:set|update)\([^\n]*toWebsiteUserProfile/)
  assert.doesNotMatch(businessService, /transaction\.(?:set|update)\([^\n]*toManagedBusinessView/)
  assert.doesNotMatch(businessService, /transaction\.set\(reference/)
})

test('business creation uses the trusted callable without browser owner discovery', async () => {
  const businessService = await readFile(new URL('../src/services/businessService.js', import.meta.url), 'utf8')
  const createBusinessProfileSource = businessService.match(
    /export async function createBusinessProfile\(\) \{[\s\S]*?\n\}/,
  )?.[0] ?? ''
  const ensureBusinessProfileSource = businessService.match(
    /export async function ensureBusinessProfile\(ownerId, userProfile\) \{[\s\S]*?return createBusinessProfile\(\)\n\}/,
  )?.[0] ?? ''

  assert.match(businessService, /candidateById\(businessId, source, \{ missingIsInvalid = false, permissionDeniedIsInvalid = false \} = \{\}\)/)
  assert.match(businessService, /candidateById\(userBusinessId, 'user_business_id', \{\s*missingIsInvalid: true,\s*permissionDeniedIsInvalid: true,\s*\}\)/s)
  assert.match(businessService, /candidateById\(ownerId, 'owner_uid_document'\)/)
  assert.match(businessService, /if \(result\.lookup\.status === 'not_found'\) return null/)
  assert.match(createBusinessProfileSource, /const result = await ensureOwnerBusinessCallable\(\)/)
  assert.doesNotMatch(createBusinessProfileSource, /getBusinessByOwnerId\(/)
  assert.match(createBusinessProfileSource, /const businessId = result\.data\?\.businessId/)
  assert.match(createBusinessProfileSource, /if \(!businessId\) throw createApplicationError\('business-create-failed'\)/)
  assert.match(createBusinessProfileSource, /return getManagedBusinessById\(businessId\)/)
  assert.match(ensureBusinessProfileSource, /if \(!userProfile\?\.roles\?\.includes\('business'\)\)/)
  assert.match(ensureBusinessProfileSource, /if \(userProfile\.businessId\) \{\s*const existingBusiness = await getManagedBusinessById\(userProfile\.businessId\)/s)
  assert.doesNotMatch(ensureBusinessProfileSource, /getBusinessByOwnerId\(|getManagedBusinessLookup\(/)
  assert.match(ensureBusinessProfileSource, /return createBusinessProfile\(\)/)
  assert.doesNotMatch(businessService, /addDoc\(|setDoc\(|doc\(collection\(db, 'businesses'\)\)/)
})

test('public directory and exact public detail use safe callable projections', async () => {
  const [businessService, functionsClient, servicesPage] = await Promise.all([
    readFile(new URL('../src/services/businessService.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/firebase/functionsClient.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/ServicesPage.jsx', import.meta.url), 'utf8'),
  ])
  const activeDirectorySource = businessService.match(
    /export async function getActivePublicBusinesses\(maxResults = 60\) \{[\s\S]*?\n\}/,
  )?.[0] ?? ''
  const publicDetailSource = businessService.match(
    /export async function getPublicBusinessById\(businessId\) \{[\s\S]*?\n\}/,
  )?.[0] ?? ''

  assert.match(functionsClient, /httpsCallable\(functions, 'listPublicBusinesses'\)/)
  assert.match(functionsClient, /httpsCallable\(functions, 'getPublicBusiness'\)/)
  assert.match(activeDirectorySource, /listPublicBusinessesCallable\(\{ maxResults: resultLimit \}\)/)
  assert.doesNotMatch(activeDirectorySource, /collection\(db, 'businesses'\)|getDocs\(|where\(|orderBy\(/)
  assert.match(activeDirectorySource, /const businesses = Array\.isArray\(result\.data\?\.businesses\)/)
  assert.match(activeDirectorySource, /return Promise\.all\(businesses\.map\(presentBusiness\)\)/)
  assert.match(servicesPage, /setBusinesses\(activeBusinesses\)/)
  assert.match(servicesPage, /services\.emptyTitle/)

  assert.match(publicDetailSource, /getPublicBusinessCallable\(\{ businessId \}\)/)
  assert.doesNotMatch(publicDetailSource, /getDoc\(|businessDocument\(|toPublicBusiness/)
})

test('canonical customer, business and combined roles retain route-facing semantics', () => {
  for (const [accountType, roles, hasBusiness] of [
    ['customer', ['customer'], false],
    ['business', ['business'], true],
    ['both', ['customer', 'business'], true],
  ]) {
    const profile = toWebsiteUserProfile(`user-${accountType}`, {
      email: `${accountType}@example.invalid`, accountType, roles,
      preferredLocale: 'en', accountStatus: 'active', profileCompleted: true,
      firstName: accountType, lastName: 'User', displayName: `${accountType} User`,
      city: 'Marbella', country: 'Spain',
      onboardingCompleted: true,
    })
    assert.equal(profile.roles.includes('business'), hasBusiness)
    assert.equal(profile.profileCompleted, true)
    assert.equal(profile.onboardingCompleted, true)
  }
})
