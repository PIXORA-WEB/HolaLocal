import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const businessLayoutUrl = new URL('../src/components/layout/BusinessLayout.jsx', import.meta.url)
const headerUrl = new URL('../src/components/layout/SiteHeader.jsx', import.meta.url)
const routesUrl = new URL('../src/routes/AppRoutes.jsx', import.meta.url)
const businessRouteUrl = new URL('../src/routes/BusinessRoute.jsx', import.meta.url)
const dashboardUrl = new URL('../src/pages/business/BusinessDashboardPage.jsx', import.meta.url)
const profileUrl = new URL('../src/pages/customer/ProfilePage.jsx', import.meta.url)
const footerUrl = new URL('../src/components/layout/SiteFooter.jsx', import.meta.url)

test('business layout is a stable outlet while edit remains a contextual action and deep link', async () => {
  const [layout, routes, dashboard, profile] = await Promise.all([
    readFile(businessLayoutUrl, 'utf8'),
    readFile(routesUrl, 'utf8'),
    readFile(dashboardUrl, 'utf8'),
    readFile(profileUrl, 'utf8'),
  ])
  assert.match(layout, /import \{ Outlet \} from 'react-router-dom'/)
  assert.match(layout, /<div className="business-area__content">\s*<Outlet \/>/)
  assert.doesNotMatch(layout, /NavLink|<nav|account-navigation|useTranslation/)

  assert.match(routes, /<Route path="edit" element=\{<EditBusinessPage \/>\} \/>/)
  assert.match(dashboard, /to="\/business\/edit"/)
  assert.match(profile, /to="\/business\/edit"/)
})

test('desktop and mobile use one ordered role-aware account descriptor list', async () => {
  const [header, businessRoute] = await Promise.all([
    readFile(headerUrl, 'utf8'),
    readFile(businessRouteUrl, 'utf8'),
  ])
  const descriptors = header.match(/const accountNavigationLinks = \[[\s\S]*?\n\]/)?.[0]

  assert.ok(descriptors)
  assert.match(
    descriptors,
    /\[\s*\{ labelKey: 'account\.profile', to: '\/profile' \},\s*\{ labelKey: 'savedBusinesses\.page\.navigation', to: '\/favourites', requiresCustomerAccess: true \},\s*\{ labelKey: 'account\.business', to: '\/business\/dashboard', requiresBusinessAccess: true \},/,
  )
  const profileDescriptor = descriptors.match(/\{ labelKey: 'account\.profile'[\s\S]*?\}/)?.[0] ?? ''
  const businessDescriptor = descriptors.match(/\{ labelKey: 'account\.business'[\s\S]*?\}/)?.[0] ?? ''
  const subscriptionDescriptor = descriptors.match(/\{ labelKey: 'business\.subscription'[\s\S]*?\}/)?.[0] ?? ''
  assert.doesNotMatch(profileDescriptor, /requiresBusinessAccess/)
  assert.match(businessDescriptor, /requiresBusinessAccess: true/)
  assert.doesNotMatch(subscriptionDescriptor, /requiresBusinessAccess/)
  assert.equal((descriptors.match(/requiresBusinessAccess: true/g) ?? []).length, 1)
  assert.match(header, /const visibleAccountNavigationLinks = accountNavigationLinks\.filter\(/)
  assert.match(header, /!link\.requiresBusinessAccess \|\| hasBusinessAccess/)
  assert.match(header, /!link\.requiresCustomerAccess \|\| hasCustomerAccess/)
  assert.equal((header.match(/visibleAccountNavigationLinks\.map\(\(link\) => \(/g) ?? []).length, 2)

  const desktopMap = header.match(/<nav aria-label=\{t\('account\.navigationLabel'\)\}>[\s\S]*?<\/nav>/)?.[0] ?? ''
  const mobileAccountGroup = header.match(/<div className="mobile-navigation__group mobile-navigation__group--account">[\s\S]*?<\/div>/)?.[0] ?? ''
  for (const context of [desktopMap, mobileAccountGroup]) {
    assert.match(context, /visibleAccountNavigationLinks\.map\(\(link\) => \(/)
    assert.match(context, /to="\/messages"/)
    assert.match(context, /renderUnreadBadge\(\)/)
    assert.match(context, /<button[\s\S]*?handleSignOut\(\)[\s\S]*?<\/button>/)
  }

  assert.match(header, /function renderUnreadBadge\(\)/)
  assert.match(header, /messages\.unreadCount/)
  assert.match(businessRoute, /userProfile\?\.roles\?\.includes\('business'\)/)
  assert.doesNotMatch(header, /my-events|\/my-events|account\.events|My Events/)
})

test('public navigation and shared footer remain intact', async () => {
  const [header, footer] = await Promise.all([
    readFile(headerUrl, 'utf8'),
    readFile(footerUrl, 'utf8'),
  ])

  for (const route of ['/services', '/events', '/community']) {
    assert.match(header, new RegExp(`to: '${route.replace('/', '\\/')}'`))
    assert.match(footer, new RegExp(`to: '${route.replace('/', '\\/')}'`))
  }
  assert.match(header, /publicNavigationLinks\.map/)
  assert.match(footer, /<BrandLockup \/>/)
  assert.match(footer, /<LanguageSwitcher \/>/)
})
