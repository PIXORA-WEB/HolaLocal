import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { homepagePlatformTranslations } from '../src/i18n/locales/homepagePlatformTranslations.js'
import { fallbackLocaleCompletionTranslations } from '../src/i18n/locales/fallbackLocaleCompletionTranslations.js'

const supportedLocales = [
  'en', 'es', 'fr', 'de', 'nl', 'pt', 'pl', 'ro', 'cs',
  'sk', 'hu', 'uk', 'it', 'sv', 'da', 'fi', 'no',
]

test('homepage hero and Early Access CTA are complete in all 17 supported locales', () => {
  assert.deepEqual(Object.keys(homepagePlatformTranslations), supportedLocales)

  for (const locale of supportedLocales) {
    const homepage = homepagePlatformTranslations[locale]?.marketing?.homepage
    assert.equal(typeof homepage?.hero?.eyebrow, 'string', `${locale} hero eyebrow`)
    assert.ok(homepage.hero.eyebrow.trim(), `${locale} hero eyebrow is non-empty`)
    for (const key of ['titleFirstLine', 'titleSecondLine', 'description', 'searchFormLabel', 'searchAction']) {
      assert.equal(typeof homepage?.hero?.[key], 'string', `${locale} hero ${key}`)
      assert.ok(homepage.hero[key].trim(), `${locale} hero ${key} is non-empty`)
    }
    for (const key of ['eyebrow', 'title', 'description', 'action']) {
      assert.equal(typeof homepage?.services?.[key], 'string', `${locale} Services ${key}`)
      assert.ok(homepage.services[key].trim(), `${locale} Services ${key} is non-empty`)
    }
    for (const key of ['eyebrow', 'title', 'availableNow', 'comingSoon']) {
      assert.equal(typeof homepage?.platform?.[key], 'string', `${locale} platform ${key}`)
      assert.ok(homepage.platform[key].trim(), `${locale} platform ${key} is non-empty`)
    }
    for (const product of ['services', 'events', 'community']) {
      for (const key of ['title', 'description', 'action']) {
        assert.equal(typeof homepage?.platform?.[product]?.[key], 'string', `${locale} platform ${product}.${key}`)
        assert.ok(homepage.platform[product][key].trim(), `${locale} platform ${product}.${key} is non-empty`)
      }
    }
    for (const product of ['events', 'community']) {
      assert.notEqual(
        homepage.platform[product].description.trim().toLocaleLowerCase(),
        homepage.platform.comingSoon.trim().toLocaleLowerCase(),
        `${locale} platform ${product} description differs from its status`,
      )
    }
    for (const key of ['eyebrow', 'title']) {
      assert.equal(typeof homepage?.why?.[key], 'string', `${locale} Why ${key}`)
      assert.ok(homepage.why[key].trim(), `${locale} Why ${key} is non-empty`)
    }
    for (const proof of ['local', 'multilingual', 'real']) {
      for (const key of ['title', 'description']) {
        assert.equal(typeof homepage?.why?.[proof]?.[key], 'string', `${locale} Why ${proof}.${key}`)
        assert.ok(homepage.why[proof][key].trim(), `${locale} Why ${proof}.${key} is non-empty`)
      }
    }
    assert.match(homepage.why.multilingual.description, /HolaLocal/)
    assert.match(homepage.why.multilingual.description, /17/)
    assert.equal(typeof homepage?.hero?.customerAction, 'string', `${locale} customer CTA`)
    assert.equal(typeof homepage?.hero?.businessAction, 'string', `${locale} business CTA`)
    assert.equal(typeof homepage?.cta?.description, 'string', `${locale} Early Access description`)
    assert.ok(homepage.hero.customerAction.trim())
    assert.ok(homepage.hero.businessAction.trim())
    assert.ok(homepage.cta.description.trim())
  }

  assert.equal(homepagePlatformTranslations.en.marketing.homepage.hero.titleFirstLine, 'Find local services.')
  assert.equal(
    homepagePlatformTranslations.en.marketing.homepage.hero.eyebrow,
    'Local services. Local businesses. One place.',
  )
  assert.equal(homepagePlatformTranslations.en.marketing.homepage.hero.titleSecondLine, 'In your language.')
  assert.equal(
    homepagePlatformTranslations.en.marketing.homepage.hero.description,
    'Browse local businesses and service providers in your area, with HolaLocal available in 17 languages.',
  )
  assert.equal(homepagePlatformTranslations.en.marketing.homepage.hero.searchFormLabel, 'Search for local services')
  assert.equal(homepagePlatformTranslations.en.marketing.homepage.hero.searchAction, 'Search')
  assert.equal(
    homepagePlatformTranslations.en.marketing.homepage.why.multilingual.description,
    'Use HolaLocal and browse service categories in 17 languages.',
  )
  assert.equal(
    homepagePlatformTranslations.en.marketing.homepage.why.real.title,
    'Local business profiles',
  )
  assert.equal(
    homepagePlatformTranslations.en.marketing.homepage.why.real.description,
    'Explore published profiles from local businesses and service providers.',
  )
  for (const locale of supportedLocales) {
    const why = homepagePlatformTranslations[locale].marketing.homepage.why
    assert.doesNotMatch(
      `${why.real.title}\n${why.real.description}`,
      /verified|vetted|endorsed|rating|background check/i,
      `${locale} Why real-business claim`,
    )
  }
  assert.doesNotMatch(
    JSON.stringify(homepagePlatformTranslations),
    /Real local businesses/,
  )
  assert.doesNotMatch(
    homepagePlatformTranslations.en.marketing.homepage.hero.eyebrow,
    /\b(?:trusted|verified|vetted|approved|guaranteed)\b|real people|reviews?|identity|qualifications?|insurance/i,
  )

  const englishHero = homepagePlatformTranslations.en.marketing.homepage.hero
  for (const locale of supportedLocales.slice(1)) {
    const hero = homepagePlatformTranslations[locale].marketing.homepage.hero
    assert.ok(
      ['titleFirstLine', 'titleSecondLine', 'description', 'searchFormLabel', 'searchAction']
        .some((key) => hero[key] !== englishHero[key]),
      `${locale} does not repeat all English hero copy`,
    )
  }
})

test('homepage Platform heading distinguishes live Services from upcoming products in every locale', () => {
  const expectedTitles = {
    en: 'Local services, with more to come.',
    es: 'Servicios locales, y más por llegar.',
    fr: 'Des services locaux, et bien plus à venir.',
    de: 'Lokale Dienstleistungen – weitere lokale Angebote folgen.',
    nl: 'Lokale diensten, met meer in het vooruitzicht.',
    pt: 'Serviços locais, com mais novidades a caminho.',
    pl: 'Lokalne usługi, a w przyszłości jeszcze więcej.',
    ro: 'Servicii locale, cu mai multe funcții pe viitor.',
    cs: 'Místní služby a časem ještě více.',
    sk: 'Miestne služby a časom ešte viac.',
    hu: 'Helyi szolgáltatások, később további lehetőségekkel.',
    uk: 'Місцеві послуги — і більше можливостей у майбутньому.',
    it: 'Servizi locali, con altre novità in arrivo.',
    sv: 'Lokala tjänster, med mer på väg.',
    da: 'Lokale tjenester med mere på vej.',
    fi: 'Paikalliset palvelut – lisää on tulossa.',
    no: 'Lokale tjenester, med mer på vei.',
  }

  for (const locale of supportedLocales) {
    const platform = homepagePlatformTranslations[locale].marketing.homepage.platform
    assert.equal(platform.title, expectedTitles[locale], `${locale} platform title`)
    assert.equal(platform.services.title.length > 0, true)
    assert.equal(platform.events.title.length > 0, true)
    assert.equal(platform.community.title.length > 0, true)
    assert.ok(platform.comingSoon.trim(), `${locale} coming-soon label`)
  }

  assert.equal(
    homepagePlatformTranslations.en.marketing.homepage.platform.title,
    'Local services, with more to come.',
  )
  assert.equal(homepagePlatformTranslations.en.marketing.homepage.platform.eyebrow, 'One local platform')
  assert.equal(homepagePlatformTranslations.en.marketing.homepage.platform.availableNow, 'Available now')
  assert.equal(homepagePlatformTranslations.en.marketing.homepage.platform.comingSoon, 'Coming soon')
  assert.deepEqual(homepagePlatformTranslations.en.marketing.homepage.platform.services, {
    title: 'Services',
    description: 'Find local professionals and businesses.',
    action: 'Explore services',
  })
  assert.deepEqual(homepagePlatformTranslations.en.marketing.homepage.platform.events, {
    title: 'Events',
    description: 'Planned as a place to discover what is happening locally.',
    action: 'Learn about Events',
  })
  assert.deepEqual(homepagePlatformTranslations.en.marketing.homepage.platform.community, {
    title: 'Community',
    description: 'Planned as a new way to connect with your local area.',
    action: 'Learn about Community',
  })
  assert.doesNotMatch(homepagePlatformTranslations.en.marketing.homepage.platform.events.description, /coming soon/i)
  assert.doesNotMatch(homepagePlatformTranslations.en.marketing.homepage.platform.community.description, /coming soon/i)
  assert.doesNotMatch(
    JSON.stringify(homepagePlatformTranslations),
    /Find local services now\. Events and community are coming next\./,
  )
})

test('final business CTA has accurate Early Access copy in all 17 locales', () => {
  const expectedActions = {
    en: 'List your business', es: 'Publica tu negocio', fr: 'Référencer votre entreprise',
    de: 'Unternehmen eintragen', nl: 'Vermeld je bedrijf', pt: 'Anunciar a sua empresa',
    pl: 'Dodaj swoją firmę', ro: 'Listează-ți afacerea', cs: 'Přidat firmu',
    sk: 'Pridať firmu', hu: 'Vállalkozás hozzáadása', uk: 'Додати свій бізнес',
    it: 'Inserisci la tua attività', sv: 'Lägg till ditt företag', da: 'Tilføj din virksomhed',
    fi: 'Lisää yrityksesi', no: 'Registrer bedriften din',
  }
  const noPaymentMeaning = {
    en: /No payment is required/, es: /No se requiere ningún pago/,
    fr: /Aucun paiement n’est requis/, de: /keine Zahlung erforderlich/,
    nl: /geen betaling nodig/, pt: /Não é necessário qualquer pagamento/,
    pl: /nie jest wymagana żadna płatność/, ro: /Nu este necesară nicio plată/,
    cs: /není vyžadována žádná platba/, sk: /nevyžaduje žiadna platba/,
    hu: /nincs szükség fizetésre/, uk: /оплата не потрібна/,
    it: /non è richiesto alcun pagamento/, sv: /Ingen betalning krävs/,
    da: /kræves ingen betaling/, fi: /maksua ei vaadita/,
    no: /Ingen betaling kreves/,
  }

  for (const locale of supportedLocales) {
    const cta = homepagePlatformTranslations[locale].marketing.homepage.cta
    assert.deepEqual(Object.keys(cta), ['eyebrow', 'title', 'description', 'action'])
    assert.equal(cta.action, expectedActions[locale], `${locale} final CTA action`)
    assert.match(cta.description, noPaymentMeaning[locale], `${locale} no-payment qualification`)
  }

  assert.deepEqual(homepagePlatformTranslations.en.marketing.homepage.cta, {
    eyebrow: 'Early Access',
    title: 'Run a local business?',
    description: 'Create a professional profile and make your services easier for local customers to discover. No payment is required during Early Access.',
    action: 'List your business',
  })
  assert.doesNotMatch(
    JSON.stringify(homepagePlatformTranslations.en.marketing.homepage.cta),
    /free forever|guaranteed|verified|vetted|endorsed|priority placement|paid promotion|instant publication|rating/i,
  )
})

test('homepage retains compatible CTA copy while rendering only the business hero CTA', async () => {
  const source = await readFile(new URL('../src/pages/HomePage.jsx', import.meta.url), 'utf8')
  const heroStart = source.indexOf('<section className="marketing-hero">')
  const heroEnd = source.indexOf('</section>', heroStart)
  const hero = source.slice(heroStart, heroEnd)

  assert.doesNotMatch(hero, /marketing\.homepage\.hero\.customerAction|to="\/services"/)
  assert.match(hero, /to="\/register\?intent=business">\{t\('marketing\.homepage\.hero\.businessAction'\)\}/)
  assert.match(hero, /<button className="button button--primary" type="submit">/)
  assert.match(source, /t\('marketing\.homepage\.hero\.searchFormLabel'\)/)
  assert.match(source, /t\('marketing\.homepage\.hero\.searchAction'\)/)
  assert.match(source, /t\('marketing\.homepage\.cta\.description'\)/)
  assert.doesNotMatch(source, /Find local services\. In your language\.|Search for local services|List your business free/)
})

test('journey copy remains concise and truthful in all 17 locales', async () => {
  const baseLocales = {}
  for (const locale of ['en', 'es', 'fr', 'de', 'nl', 'pt']) {
    const source = await readFile(new URL(`../src/i18n/locales/${locale}.json`, import.meta.url), 'utf8')
    baseLocales[locale] = JSON.parse(source)
  }
  const expectedBusinessActions = {
    en: 'List your business', es: 'Publicar tu negocio', fr: 'Référencer votre entreprise',
    de: 'Unternehmen eintragen', nl: 'Bedrijf vermelden', pt: 'Anunciar a sua empresa',
    ro: 'Listează-ți afacerea', pl: 'Dodaj swoją firmę', cs: 'Přidat firmu',
    sk: 'Pridať firmu', hu: 'Vállalkozás hozzáadása', uk: 'Додати свою компанію',
    it: 'Inserisci la tua attività', sv: 'Lägg till ditt företag', da: 'Tilføj din virksomhed',
    fi: 'Lisää yrityksesi', no: 'Legg til bedriften din',
  }
  const saveMeaning = {
    en: /save useful profiles/i, es: /guarda perfiles útiles/i, fr: /enregistrez des profils utiles/i,
    de: /speichern Sie nützliche Profile/i, nl: /bewaar nuttige profielen/i, pt: /guarde perfis úteis/i,
    ro: /salvează profiluri utile/i, pl: /zapisuj przydatne profile/i, cs: /ukládejte si užitečné profily/i,
    sk: /ukladajte si užitočné profily/i, hu: /ments el hasznos profilokat/i, uk: /зберігайте корисні профілі/i,
    it: /salva i profili utili/i, sv: /spara användbara profiler/i, da: /gem nyttige profiler/i,
    fi: /tallenna hyödyllisiä profiileja/i, no: /lagre nyttige profiler/i,
  }
  const signInMeaning = {
    en: /sign in/i, es: /inicia sesión/i, fr: /connectez-vous/i, de: /melden Sie sich an/i,
    nl: /log in/i, pt: /inicie sessão/i, ro: /autentifică-te/i, pl: /zaloguj się/i,
    cs: /přihlaste se/i, sk: /prihláste sa/i, hu: /jelentkezz be/i, uk: /ввійдіть/i,
    it: /accedi/i, sv: /logga in/i, da: /log ind/i, fi: /kirjaudu sisään/i, no: /logg inn/i,
  }
  const businessMeaning = {
    en: /services.*areas.*languages/i, es: /servicios.*zonas.*idiomas/i,
    fr: /services.*zones.*langues/i, de: /Dienste.*Einsatzgebiete.*Sprachen/i,
    nl: /diensten.*werkgebieden.*talen/i, pt: /serviços.*áreas.*idiomas/i,
    ro: /serviciile.*zonele.*limbile/i, pl: /usługi.*obszary.*języki/i,
    cs: /služby.*oblasti.*jazyky/i, sk: /služby.*oblasti.*jazyky/i,
    hu: /szolgáltatásaidat.*területeidet.*nyelveidet/i, uk: /послуги.*зони.*мови/i,
    it: /servizi.*aree.*lingue/i, sv: /tjänster.*serviceområden.*språk/i,
    da: /tjenester.*serviceområder.*sprog/i, fi: /palvelusi.*palvelualueesi.*kielesi/i,
    no: /tjenestene.*tjenesteområdene.*språkene/i,
  }

  for (const locale of supportedLocales) {
    const resource = baseLocales[locale] ?? fallbackLocaleCompletionTranslations[locale]
    const journeys = resource.marketing.journeys
    for (const value of [
      journeys.eyebrow, journeys.title,
      journeys.customers.title, journeys.customers.description, journeys.customers.action,
      journeys.businesses.title, journeys.businesses.description, journeys.businesses.action,
    ]) {
      assert.equal(typeof value, 'string', `${locale} journey value`)
      assert.ok(value.trim(), `${locale} journey value is non-empty`)
    }
    assert.equal(journeys.businesses.action, expectedBusinessActions[locale], `${locale} business action`)
    assert.match(journeys.customers.description, saveMeaning[locale], `${locale} saved-profile meaning`)
    assert.match(journeys.customers.description, signInMeaning[locale], `${locale} sign-in meaning`)
    assert.match(journeys.businesses.description, businessMeaning[locale], `${locale} business profile meaning`)
  }

  assert.equal(
    baseLocales.en.marketing.journeys.customers.description,
    'Save useful profiles and sign in when you’re ready to connect privately.',
  )
  assert.equal(
    baseLocales.en.marketing.journeys.businesses.description,
    'Present your services, areas and languages in one clear profile.',
  )
})

test('How It Works uses the truthful Browse, Review, Connect sequence in all 17 locales', async () => {
  const baseLocales = {}
  for (const locale of ['en', 'es', 'fr', 'de', 'nl', 'pt']) {
    const source = await readFile(new URL(`../src/i18n/locales/${locale}.json`, import.meta.url), 'utf8')
    baseLocales[locale] = JSON.parse(source)
  }

  const requiredPaths = [
    ['eyebrow'], ['title'], ['description'],
    ['browse', 'title'], ['browse', 'description'],
    ['review', 'title'], ['review', 'description'],
    ['connect', 'title'], ['connect', 'description'],
  ]
  const resources = {}

  for (const locale of supportedLocales) {
    const resource = baseLocales[locale] ?? fallbackLocaleCompletionTranslations[locale]
    const how = resource.marketing.how
    resources[locale] = how
    for (const path of requiredPaths) {
      const value = path.reduce((current, key) => current?.[key], how)
      assert.equal(typeof value, 'string', `${locale} How ${path.join('.')}`)
      assert.ok(value.trim(), `${locale} How ${path.join('.')} is non-empty`)
    }
    assert.equal(Object.hasOwn(how, 'choose'), false, `${locale} obsolete How choose branch`)
    if (locale !== 'en') {
      assert.notDeepEqual(how, resources.en, `${locale} must not fall back wholesale to English`)
    }
  }

  assert.deepEqual(resources.en, {
    eyebrow: 'How it works',
    title: 'Local help in three clear steps.',
    description: 'Browse local services, review published business profiles and connect when you are ready.',
    browse: {
      title: 'Browse local services',
      description: 'Explore local services and published business profiles without creating an account.',
    },
    review: {
      title: 'Review profiles',
      description: 'Compare services, service areas, languages and any public contact details businesses choose to share.',
    },
    connect: {
      title: 'Connect privately',
      description: 'Sign in to start a private conversation with the business that suits your needs.',
    },
  })
  assert.doesNotMatch(
    JSON.stringify(resources.en),
    /verif|vett|endors|background check|rating|review(?:s| feature)|automatic translat|guaranteed|anonymous messag|end-to-end encrypt/i,
  )
})
