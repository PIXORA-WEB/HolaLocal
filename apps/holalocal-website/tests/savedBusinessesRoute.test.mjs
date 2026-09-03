import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

test('one protected customer-capability route owns /favourites', async () => {
  const [routes, customerRoute, sitemap, header] = await Promise.all([
    read('src/routes/AppRoutes.jsx'),
    read('src/routes/CustomerRoute.jsx'),
    read('public/sitemap.xml'),
    read('src/components/layout/SiteHeader.jsx'),
  ])
  assert.equal((routes.match(/path="favourites"/g) ?? []).length, 1)
  assert.match(routes, /<Route element=\{<ProtectedRoute \/>\}>[\s\S]*?<Route element=\{<CustomerRoute \/>\}>[\s\S]*?path="favourites"/)
  assert.match(customerRoute, /userProfile\?\.roles\?\.includes\('customer'\)/)
  assert.match(customerRoute, /<Navigate replace to="\/profile" \/>/)
  assert.doesNotMatch(customerRoute, /accountType|admin|moderator/)
  assert.doesNotMatch(sitemap, /\/favourites/)
  assert.equal((header.match(/to: '\/favourites'/g) ?? []).length, 1)
  assert.equal((header.match(/visibleAccountNavigationLinks\.map/g) ?? []).length, 2)
})
