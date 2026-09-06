import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const pageUrl = new URL('../src/pages/ServicesPage.jsx', import.meta.url)
const stylesUrl = new URL('../src/styles/global.css', import.meta.url)

test('Services visual refinement preserves filter wiring and result branches', async () => {
  const source = await readFile(pageUrl, 'utf8')

  assert.match(source, /onChange=\{\(event\) => updateFilter\('q', event\.target\.value\)\}/)
  assert.match(source, /onChange=\{\(event\) => updateFilter\('area', event\.target\.value\)\}/)
  assert.match(source, /onChange=\{\(value\) => updateFilter\('language', value\)\}/)
  assert.match(source, /onChange=\{updateServiceFilter\}/)
  assert.match(source, /onClick=\{\(\) => setBrowseGroupOverride\(\{ groupId: group\.id, taxonomyStateToken \}\)\}/)
  assert.match(source, /aria-pressed=\{selectedGroupId === group\.id\}/)
  assert.match(source, /filterPublicBusinesses\(businesses, \{/)
  assert.match(source, /!loading && !error && businesses\.length === 0/)
  assert.match(source, /!loading && !error && businesses\.length > 0 && filteredBusinesses\.length === 0/)
  assert.match(source, /filteredBusinesses\.length > 0/)
  assert.match(source, /to="\/register\?intent=business"/)
  assert.doesNotMatch(source, /services-search-button|services-sort|result-count-control/)
})

test('Services category controls reuse the shared decorative icon system', async () => {
  const [source, iconSource, styles] = await Promise.all([
    readFile(pageUrl, 'utf8'),
    readFile(new URL('../src/components/common/ServiceCategoryIcon.jsx', import.meta.url), 'utf8'),
    readFile(stylesUrl, 'utf8'),
  ])

  assert.match(source, /import ServiceCategoryIcon from '\.\.\/components\/common\/ServiceCategoryIcon\.jsx'/)
  assert.match(source, /data-service-group=\{group\.id\}/)
  assert.match(source, /<ServiceCategoryIcon groupId=\{group\.id\} \/>/)
  assert.match(iconSource, /aria-hidden="true"/)
  assert.match(iconSource, /focusable="false"/)
  assert.match(styles, /\.service-browser__groups \{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(styles, /@media \(min-width: 48rem\)[\s\S]*?\.service-browser__groups \{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(styles, /@media \(min-width: 72rem\)[\s\S]*?\.service-browser__groups \{[\s\S]*?repeat\(6, minmax\(0, 1fr\)\)/)
})

test('Services results stay compact without an introduction wash', async () => {
  const [source, styles] = await Promise.all([
    readFile(pageUrl, 'utf8'),
    readFile(stylesUrl, 'utf8'),
  ])

  assert.equal(source.match(/services-state services-state--empty/g)?.length, 2)
  assert.match(styles, /\.services-results > \.services-state--empty \{[\s\S]*?border: 1px solid[\s\S]*?box-shadow:/)
  assert.doesNotMatch(styles, /\.services-page__header::before/)
  assert.doesNotMatch(styles.match(/\.services-results > \.services-state--empty \{[^}]*\}/)?.[0] ?? '', /dashed|height:/)
  assert.match(styles, /\.public-business-card--result \{[\s\S]*?grid-template-rows: auto auto;[\s\S]*?padding: 1\.05rem;/)
  assert.match(styles, /\.public-business-card__result-details \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto;/)
})
