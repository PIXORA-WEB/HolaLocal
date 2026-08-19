import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const websiteRoot = path.resolve(__dirname, '..')

const readWebsiteFile = (relativePath) =>
  readFile(path.join(websiteRoot, relativePath), 'utf8')

test('robots.txt exposes the canonical sitemap', async () => {
  const robots = await readWebsiteFile('public/robots.txt')

  assert.match(robots, /^User-agent: \*$/m)
  assert.match(robots, /^Allow: \/$/m)
  assert.match(
    robots,
    /^Sitemap: https:\/\/www\.holalocal\.es\/sitemap\.xml$/m,
  )
})

test('sitemap contains only stable public MVP routes', async () => {
  const sitemap = await readWebsiteFile('public/sitemap.xml')

  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(
    (match) => match[1],
  )

  assert.deepEqual(urls, [
    'https://www.holalocal.es/',
    'https://www.holalocal.es/services',
    'https://www.holalocal.es/contact',
    'https://www.holalocal.es/privacy',
    'https://www.holalocal.es/terms',
  ])

  assert.doesNotMatch(
    sitemap,
    /\/login|\/register|\/admin|\/profile|\/messages|\/businesses/,
  )
})

test('canonical URL defaults use the Production www hostname', async () => {
  const [indexHtml, envExample, metadataManager] = await Promise.all([
    readWebsiteFile('index.html'),
    readWebsiteFile('.env.example'),
    readWebsiteFile('src/components/common/MetadataManager.jsx'),
  ])

  assert.match(
    indexHtml,
    /<meta property="og:url" content="https:\/\/www\.holalocal\.es\/" \/>/,
  )
  assert.match(
    indexHtml,
    /<link rel="canonical" href="https:\/\/www\.holalocal\.es\/" \/>/,
  )
  assert.match(
    envExample,
    /^VITE_SITE_URL=https:\/\/www\.holalocal\.es$/m,
  )
  assert.match(
    metadataManager,
    /'https:\/\/www\.holalocal\.es'/,
  )

  for (const source of [indexHtml, envExample, metadataManager]) {
    assert.doesNotMatch(source, /https:\/\/holalocal\.es/)
  }
})

test('Vercel routing keeps known SPA routes and permanent legacy redirects', async () => {
  const config = JSON.parse(await readWebsiteFile('vercel.json'))
  const rewriteSources = config.rewrites.map((rewrite) => rewrite.source)

  assert.equal(rewriteSources.includes('/(.*)'), false)

  for (const route of [
    '/services',
    '/services/:businessId',
    '/contact',
    '/privacy',
    '/terms',
    '/login',
    '/register',
    '/profile',
    '/messages',
    '/messages/:conversationId',
    '/business/dashboard',
    '/admin',
    '/admin/businesses',
    '/admin/businesses/:businessId',
  ]) {
    assert.equal(
      rewriteSources.includes(route),
      true,
      `Missing rewrite for ${route}`,
    )
  }

  assert.equal(rewriteSources.includes('/businesses'), false)
  assert.equal(rewriteSources.includes('/businesses/:businessId'), false)
  assert.equal(rewriteSources.includes('/robots.txt'), false)
  assert.equal(rewriteSources.includes('/sitemap.xml'), false)
  assert.equal(rewriteSources.includes('/404.html'), false)

  assert.deepEqual(config.redirects, [
    {
      source: '/businesses',
      destination: '/services',
      permanent: true,
    },
    {
      source: '/businesses/:businessId',
      destination: '/services/:businessId',
      permanent: true,
    },
  ])
})

test('static 404 page is not indexable', async () => {
  const notFound = await readWebsiteFile('public/404.html')

  assert.match(
    notFound,
    /<meta name="robots" content="noindex, nofollow" \/>/,
  )
  assert.match(notFound, /<h1>404<\/h1>/)
  assert.match(notFound, /href="\/"/)
  assert.match(notFound, /href="\/services"/)
})
