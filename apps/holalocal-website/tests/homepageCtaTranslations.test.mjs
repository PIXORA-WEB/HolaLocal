import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fallbackLocaleCompletionTranslations } from '../src/i18n/locales/fallbackLocaleCompletionTranslations.js'

const expectedDescriptions = {
  en: 'Join as a customer, a business, or both. One account gives you access to everything on HolaLocal.',
  es: 'Únete como cliente, negocio o ambos. Una cuenta te da acceso a todo en HolaLocal.',
  fr: 'Rejoignez-nous comme client, entreprise ou les deux. Un seul compte vous donne accès à tout sur HolaLocal.',
  de: 'Treten Sie als Kunde, Unternehmen oder beides bei. Mit einem Konto haben Sie Zugriff auf alles bei HolaLocal.',
  nl: 'Doe mee als klant, bedrijf of allebei. Met één account krijg je toegang tot alles op HolaLocal.',
  pt: 'Junte-se como cliente, negócio ou ambos. Uma conta dá-lhe acesso a tudo na HolaLocal.',
  pl: 'Dołącz jako klient, firma lub obie role. Jedno konto zapewnia dostęp do wszystkiego w HolaLocal.',
  ro: 'Alătură-te ca client, firmă sau ambele. Un singur cont îți oferă acces la tot ce găsești pe HolaLocal.',
  cs: 'Přidejte se jako zákazník, firma nebo obojí. Jeden účet vám poskytne přístup ke všemu na HolaLocal.',
  sk: 'Pridajte sa ako zákazník, firma alebo oboje. Jeden účet vám poskytne prístup ku všetkému na HolaLocal.',
  hu: 'Csatlakozz ügyfélként, vállalkozásként vagy mindkettőként. Egyetlen fiókkal mindenhez hozzáférhetsz a HolaLocalon.',
  uk: 'Приєднуйтеся як клієнт, бізнес або в обох ролях. Один обліковий запис надає доступ до всього на HolaLocal.',
  it: 'Unisciti come cliente, attività o entrambi. Un solo account ti dà accesso a tutto su HolaLocal.',
  sv: 'Gå med som kund, företag eller båda. Ett konto ger dig tillgång till allt på HolaLocal.',
  da: 'Deltag som kunde, virksomhed eller begge dele. Én konto giver dig adgang til alt på HolaLocal.',
  fi: 'Liity asiakkaana, yrityksenä tai molempina. Yhdellä tilillä pääset käyttämään kaikkea HolaLocalissa.',
  no: 'Bli med som kunde, bedrift eller begge deler. Én konto gir deg tilgang til alt på HolaLocal.',
}

const jsonLocales = ['en', 'es', 'fr', 'de', 'nl', 'pt']

test('homepage account CTA is accurate in all 17 supported locales', async () => {
  const descriptions = {}

  for (const locale of jsonLocales) {
    const source = JSON.parse(await readFile(
      new URL(`../src/i18n/locales/${locale}.json`, import.meta.url),
      'utf8',
    ))
    descriptions[locale] = source.marketing.cta.description
  }

  for (const [locale, translations] of Object.entries(fallbackLocaleCompletionTranslations)) {
    descriptions[locale] = translations.marketing.cta.description
  }

  assert.deepEqual(descriptions, expectedDescriptions)
})

test('homepage renders the shared CTA translation key without hard-coded copy', async () => {
  const source = await readFile(new URL('../src/pages/HomePage.jsx', import.meta.url), 'utf8')

  assert.match(source, /t\('marketing\.cta\.description'\)/)
  assert.doesNotMatch(source, /One account gives you access to everything on HolaLocal/)
})
