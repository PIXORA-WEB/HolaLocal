import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { homepagePlatformTranslations } from '../src/i18n/locales/homepagePlatformTranslations.js'

const supportedLocales = [
  'en', 'es', 'fr', 'de', 'nl', 'pt', 'pl', 'ro', 'cs',
  'sk', 'hu', 'uk', 'it', 'sv', 'da', 'fi', 'no',
]

test('homepage Early Access CTA is complete in all 17 supported locales', () => {
  assert.deepEqual(Object.keys(homepagePlatformTranslations), supportedLocales)

  for (const locale of supportedLocales) {
    const homepage = homepagePlatformTranslations[locale]?.marketing?.homepage
    assert.equal(typeof homepage?.hero?.customerAction, 'string', `${locale} customer CTA`)
    assert.equal(typeof homepage?.hero?.businessAction, 'string', `${locale} business CTA`)
    assert.equal(typeof homepage?.cta?.description, 'string', `${locale} Early Access description`)
    assert.ok(homepage.hero.customerAction.trim())
    assert.ok(homepage.hero.businessAction.trim())
    assert.ok(homepage.cta.description.trim())
  }
})

test('homepage renders localized CTAs on the supported production routes', async () => {
  const source = await readFile(new URL('../src/pages/HomePage.jsx', import.meta.url), 'utf8')

  assert.match(source, /to="\/services">\{t\('marketing\.homepage\.hero\.customerAction'\)\}/)
  assert.match(source, /to="\/register\?intent=business">\{t\('marketing\.homepage\.hero\.businessAction'\)\}/)
  assert.match(source, /t\('marketing\.homepage\.cta\.description'\)/)
  assert.doesNotMatch(source, /Find local services\. Speak your language\.|List your business free/)
})
