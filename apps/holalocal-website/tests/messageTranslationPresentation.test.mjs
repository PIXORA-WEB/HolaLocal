import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { messageTranslationPresentation as present, recipientTranslationLanguage } from '../src/utils/messageTranslationPresentation.js'
const original = { messageId: 'a', senderId: 'other', text: 'Hola', moderationStatus: 'visible', deletedAt: null }
const translated = { ...original, translation: { status: 'completed', sourceLanguage: 'es', targetLanguage: 'en', translatedText: 'Hello' } }
const view = (m, toggle = false, target = 'en') => present(m, 'viewer', target, toggle, 1000)
test('no translation is original without status', () => assert.deepEqual(view(original), { text: 'Hola', status: null, canToggle: false, expiresAt: null }))
test('matching target shows translated text and label eligibility', () => { assert.equal(view(translated).text, 'Hello'); assert.equal(view(translated).canToggle, true) })
test('show original and show translation are reversible', () => { assert.equal(view(translated, true).text, 'Hola'); assert.equal(view(translated, false).text, 'Hello') })
test('target mismatch never exposes stored text or controls', () => { assert.equal(view(translated, false, 'de').text, 'Hola'); assert.equal(view(translated, false, 'de').canToggle, false) })
test('live processing keeps original', () => { const p = view({ ...original, translation: { status: 'processing', targetLanguage: 'en', processingLeaseUntil: { toMillis: () => 1001 } } }); assert.equal(p.status, 'processing'); assert.equal(p.text, 'Hola') })
for (const expiry of [undefined, { toMillis: () => 1000 }, { toMillis: () => NaN }, { toMillis: () => { throw Error('bad') } }]) test('expired/malformed lease cannot remain processing', () => assert.equal(view({ ...original, translation: { status: 'processing', targetLanguage: 'en', processingLeaseUntil: expiry } }).status, 'failed'))
test('failed is original with safe status only', () => { const p = view({ ...original, translation: { status: 'failed', targetLanguage: 'en', error: 'secret' } }); assert.equal(p.text, 'Hola'); assert.equal(p.status, 'failed'); assert(!JSON.stringify(p).includes('secret')) })
test('snapshot completion and language changes recompute', () => { assert.equal(view(original).text, 'Hola'); assert.equal(view(translated).text, 'Hello'); assert.equal(view(translated, false, 'fr').text, 'Hola') })
test('outgoing message always original', () => assert.equal(present(translated, 'other', 'en').text, 'Hola'))
test('unknown/malformed metadata safely falls back', () => { for (const translation of [null, 'bad', {}, { status: 'unknown' }, { status: 'completed', targetLanguage: 'en', translatedText: '' }]) assert.equal(view({ ...original, translation }).text, 'Hola') })
test('same-language and not-required have no label', () => { assert.equal(view({ ...translated, translation: { ...translated.translation, sourceLanguage: 'en' } }).canToggle, false); assert.equal(view({ ...translated, translation: { ...translated.translation, status: 'not_required' } }).status, null) })
test('removed message cannot retain translation controls', () => assert.equal(view({ ...translated, deletedAt: {} }).canToggle, false))
test('saved account locale matches worker including legacy fallback', () => { assert.equal(recipientTranslationLanguage({ preferredLocale: 'de-DE', primaryLanguage: 'es' }), 'de'); assert.equal(recipientTranslationLanguage({ preferredLocale: 'xx', preferredLanguage: 'Español' }), 'es'); assert.equal(recipientTranslationLanguage({}), null) })
test('page scopes toggle identity and translation owners have no service calls', async () => { const page = await readFile(new URL('../src/pages/MessagesPage.jsx', import.meta.url), 'utf8'); assert(page.includes('JSON.stringify([user.uid, conversationId, message.messageId, targetLanguage])')); assert(!page.includes("language: activeLanguage")); for (const file of ['../src/utils/messageTranslationPresentation.js', '../src/components/common/MessageTranslationText.jsx']) { const text = await readFile(new URL(file, import.meta.url), 'utf8'); assert(!/httpsCallable|fetch\(|axios|services\/|firebase\/|setDoc|updateDoc/.test(text)) } })
test('17 locales provide localized machine label and states', async () => { const en = JSON.parse(await readFile(new URL('../src/i18n/locales/en.json', import.meta.url))); assert.equal(en.messages.translation.completed, 'Machine translation'); for (const lang of 'es fr de nl pt pl ro cs sk hu uk it sv da fi no'.split(' ')) { const { default: locale } = await import(`../src/i18n/locales/operational/operational-${lang}.js`); for (const key of ['completed', 'processing', 'failed', 'viewOriginal', 'viewTranslation']) assert(locale.messages.translation[key]); assert.notEqual(locale.messages.translation.completed, en.messages.translation.completed) } })

test('component labels only the displayed translation across both toggle directions', async () => {
  const { build } = await import('vite')
  const { chromium } = await import('playwright')
  const { fileURLToPath } = await import('node:url')
  const root = fileURLToPath(new URL('../', import.meta.url))
  const component = fileURLToPath(new URL('../src/components/common/MessageTranslationText.jsx', import.meta.url))
  const entry = 'virtual:translation-label-regression'
  const result = await build({
    root, configFile: false, envDir: false, logLevel: 'silent',
    esbuild: { jsx: 'automatic' },
    plugins: [{
      name: 'translation-label-fixture',
      resolveId(id) { if (id === entry) return '\0' + entry },
      load(id) {
        if (id !== '\0' + entry) return null
        return `import React from 'react';
          import {createRoot} from 'react-dom/client';
          import MessageTranslationText from ${JSON.stringify(component)};
          const copy = ${JSON.stringify({
            'messages.translation.completed': 'Machine translation',
            'messages.translation.viewOriginal': 'View original',
            'messages.translation.viewTranslation': 'View translation',
          })};
          createRoot(document.getElementById('root')).render(
            React.createElement(MessageTranslationText, {message:${JSON.stringify(translated)}, viewerId:"viewer", targetLanguage:"en", t:key=>copy[key]}));`
      },
    }],
    build: { write: false, minify: false, rolldownOptions: { input: entry, output: { inlineDynamicImports: true } } },
  })
  const script = result.output.find(item => item.type === 'chunk' && item.isEntry)
  assert(script)
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' })
    const unexpected = []
    await context.route('**/*', route => {
      const url = route.request().url()
      if (url === 'http://translation-label.test/') return route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script type="module" src="/fixture.js"></script>' })
      if (url === 'http://translation-label.test/fixture.js') return route.fulfill({ contentType: 'application/javascript', body: script.code })
      unexpected.push(url)
      return route.abort()
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('http://translation-label.test/')
    await page.getByRole('button', { name: 'View original', exact: true }).waitFor()
    async function assertState(text, labelCount, buttonName) {
      assert.equal(await page.locator('#root > p').innerText(), text)
      assert.equal(await page.getByText('Machine translation', { exact: true }).count(), labelCount)
      assert.equal(await page.getByRole('button', { name: buttonName, exact: true }).count(), 1)
      assert.equal(await page.getByRole('button').count(), 1)
    }
    await assertState('Hello', 1, 'View original')
    await page.getByRole('button', { name: 'View original', exact: true }).click()
    await page.getByRole('button', { name: 'View translation', exact: true }).waitFor()
    await assertState('Hola', 0, 'View translation')
    await page.getByRole('button', { name: 'View translation', exact: true }).click()
    await page.getByRole('button', { name: 'View original', exact: true }).waitFor()
    await assertState('Hello', 1, 'View original')
    assert.deepEqual(errors, [])
    assert.deepEqual(unexpected, [])
  } finally {
    await browser.close()
  }
})
