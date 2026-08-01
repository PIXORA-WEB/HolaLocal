import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  ownerRejectionTranslations,
} from '../src/i18n/adminTranslations.js'

const locales = ['en', 'es', 'fr', 'de', 'nl', 'pt', 'pl', 'ro', 'cs', 'sk', 'hu', 'uk', 'it', 'sv', 'da', 'fi', 'no']
const ownerMessageKeys = ['eyebrow', 'title', 'category', 'nextStep', 'edit']

const sourceUrls = {
  layout: new URL('../src/components/layout/AdminLayout.jsx', import.meta.url),
  overview: new URL('../src/pages/admin/AdminOverviewPage.jsx', import.meta.url),
  businesses: new URL('../src/pages/admin/AdminBusinessesPage.jsx', import.meta.url),
  review: new URL('../src/pages/admin/AdminBusinessReviewPage.jsx', import.meta.url),
  styles: new URL('../src/styles/global.css', import.meta.url),
}

test('owner-facing rejection messages are complete and localized for all 17 locales', () => {
  for (const locale of locales) {
    const owner = ownerRejectionTranslations[locale]?.rejection?.owner
    assert.deepEqual(Object.keys(owner ?? {}).sort(), [...ownerMessageKeys].sort(), locale)
    for (const key of ownerMessageKeys) assert.ok(owner[key]?.trim(), `${locale}.${key}`)
    if (locale !== 'en') {
      assert.notDeepEqual(owner, ownerRejectionTranslations.en.rejection.owner, locale)
    }
  }
})

test('all admin page modules are route-level lazy imports', async () => {
  const source = await readFile(new URL('../src/routes/AppRoutes.jsx', import.meta.url), 'utf8')
  for (const page of ['AdminOverviewPage', 'AdminBusinessesPage', 'AdminBusinessReviewPage']) {
    assert.ok(source.includes(`const ${page} = lazy(() => import('../pages/admin/${page}.jsx'))`), page)
    assert.doesNotMatch(source, new RegExp(`import ${page} from`))
  }
})

test('admin shell provides active desktop navigation and an accessible mobile drawer', async () => {
  const layout = await readFile(sourceUrls.layout, 'utf8')

  assert.match(layout, /<aside className="admin-sidebar">/)
  assert.match(layout, /<NavLink end=\{item\.end\}/)
  assert.match(layout, /aria-expanded=\{menuOpen\}/)
  assert.match(layout, /<AccessibleDialog/)
  assert.match(layout, /onClose=\{\(\) => setMenuOpen\(false\)\}/)
  assert.match(layout, /autoFocus aria-label=\{t\('admin\.navigation\.closeMenu'\)\}/)
  assert.match(layout, /t\('auth\.logout'\)/)
  assert.doesNotMatch(layout, /nav\.signOut/)
  assert.match(layout, /to="\/".*admin\.navigation\.returnWebsite/)
})

test('overview remains bounded and adds only a five-item pending submission preview', async () => {
  const overview = await readFile(sourceUrls.overview, 'utf8')

  assert.match(overview, /getBusinessStatusCounts\(\)/)
  assert.match(overview, /getAdminBusinessesPage\(\{ status: 'pending_review', pageSize: 5 \}\)/)
  assert.match(overview, /admin\.overview\.recentTitle/)
  assert.match(overview, /state\.status === 'loading'/)
  assert.match(overview, /state\.status === 'error'/)
  assert.match(overview, /state\.recent\.length === 0/)
})

test('business moderation uses status tabs, local search, bounded pagination and responsive views', async () => {
  const [businesses, styles] = await Promise.all([
    readFile(sourceUrls.businesses, 'utf8'),
    readFile(sourceUrls.styles, 'utf8'),
  ])

  assert.match(businesses, /role="group"/)
  assert.match(businesses, /aria-pressed=\{status === item\}/)
  assert.match(businesses, /getBusinessStatusCounts\(\)/)
  assert.match(businesses, /getAdminBusinessesPage\(\{ cursor: state\.cursor, status \}\)/)
  assert.match(businesses, /state\.businesses\.filter/)
  assert.match(businesses, /admin\.businesses\.pageSearchHelp/)
  assert.match(businesses, /aria-describedby="admin-business-search-help"/)
  assert.match(businesses, /admin\.businesses\.clearSearch/)
  assert.match(businesses, /<table className="admin-table">/)
  assert.match(businesses, /<ul className="admin-business-cards">/)
  assert.match(styles, /@media \(max-width: 44rem\)[\s\S]*?\.admin-table-panel \{ display: none; \}/)
  assert.match(styles, /@media \(max-width: 44rem\)[\s\S]*?\.admin-business-cards \{ display: grid;/)
  assert.match(styles, /@media \(max-width: 24rem\)[\s\S]*?\.admin-business-card__heading/)
})

test('review workspace preserves callable request handling and separates technical details', async () => {
  const review = await readFile(sourceUrls.review, 'utf8')

  assert.match(review, /requestIdRef\.current \?\?= crypto\.randomUUID\(\)\.replaceAll\('-', ''\)/)
  assert.match(review, /await moderateBusiness\(\{[\s\S]*?businessId,[\s\S]*?operation,[\s\S]*?reasonCode,[\s\S]*?guidance: guidance\.trim\(\),[\s\S]*?requestId: requestIdRef\.current/)
  assert.match(review, /<aside className="admin-moderation-panel"/)
  assert.match(review, /<details className="admin-technical-details">/)
  assert.match(review, /<Detail label=\{t\('admin\.review\.businessId'\)\}/)
  assert.match(review, /<Detail label=\{t\('admin\.review\.ownerUid'\)\}/)
  assert.match(review, /<AccessibleDialog[\s\S]*?open=\{dialog === 'approve'\}/)
  assert.match(review, /<AccessibleDialog[\s\S]*?open=\{dialog === 'reject'\}/)
  assert.match(review, /disabled=\{decisionPending\}/)
  assert.match(review, /completion\.items\.filter\(\(item\) => item\.complete\)\.length/)
  assert.match(review, /admin\.review\.requirementsPresent/)
  assert.match(review, /admin\.review\.profileCompleteness/)
  assert.match(review, /admin\.review\.publishNotVerify/)
  assert.match(review, /admin\.common\.notProvided/)
})

test('admin fallback translations contain polished search, checklist and verification guidance', async () => {
  const translations = await readFile(new URL('../src/i18n/adminTranslations.js', import.meta.url), 'utf8')

  assert.match(translations, /pageSearch: 'Search this page'/)
  assert.match(translations, /searchPlaceholder: 'Search by business name'/)
  assert.match(translations, /pageSearchHelp: 'Searches only the businesses currently loaded on this page\.'/)
  assert.match(translations, /requirementsPresent: '\{\{complete\}\} of \{\{total\}\} required fields present'/)
  assert.match(translations, /publishNotVerify: 'Publishing this profile does not mark the business as verified\.'/)
  assert.doesNotMatch(translations, /Filter this page by business name/)
})
