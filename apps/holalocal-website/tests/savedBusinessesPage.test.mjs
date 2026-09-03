import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

test('callable client validates and normalizes one bounded saved-business page', async () => {
  const [client, service] = await Promise.all([read('src/firebase/functionsClient.js'), read('src/services/savedBusinessService.js')])
  assert.equal((client.match(/httpsCallable\(functions, 'listSavedBusinesses'\)/g) ?? []).length, 1)
  assert.match(service, /normalizeSavedBusinessesPageSize/)
  assert.match(service, /validateSavedBusinessesCursor/)
  assert.match(service, /SAVED_BUSINESSES_DEFAULT_PAGE_SIZE/)
  assert.match(service, /callable\(\{[\s\S]*?pageSize: normalizedPageSize/)
  assert.doesNotMatch(service, /callable\(\{[^}]*uid/s)
  assert.match(service, /available: item\.available/)
  assert.match(service, /item\.available \? normalizePublicBusiness\(item\.business, item\.businessId\) : null/)
  for (const field of ['ownerId', 'managerIds', 'moderation']) assert.doesNotMatch(service, new RegExp(`${field}: value\\.`))
})

test('saved page has truthful states, separate actions, pagination, and stale-request protection', async () => {
  const page = await read('src/pages/customer/SavedBusinessesPage.jsx')
  assert.match(page, /<h1>/)
  assert.match(page, /<article className=/)
  assert.match(page, /to=\{`\/services\/\$\{encodeURIComponent\(item\.businessId\)\}`\}/)
  assert.match(page, /item\.available &&/)
  assert.match(page, /role="alert"/)
  assert.match(page, /aria-busy=/)
  assert.match(page, /nextCursor/)
  assert.match(page, /seen = new Set/)
  assert.match(page, /requestId !== requestRef\.current/)
  assert.match(page, /removeSavedBusiness\(userId, businessId\)/)
  assert.doesNotMatch(page, /getDoc|businessPrivate|ownerId|managerIds/)
})

test('saved page CSS is content driven responsive and motion free', async () => {
  const css = await read('src/styles/global.css')
  assert.match(css, /\.saved-businesses-grid \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(css, /@media \(max-width: 47\.999rem\) \{[\s\S]*?\.saved-businesses-grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/)
  assert.match(css, /\.saved-business-card__actions a,[\s\S]*?min-height: 2\.75rem/)
  const card = css.match(/\.saved-business-card \{([\s\S]*?)\n\}/)?.[1] ?? ''
  assert.doesNotMatch(card, /height:|transform|animation/)
})
