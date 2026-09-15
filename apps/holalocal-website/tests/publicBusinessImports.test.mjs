import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('public callable reads have no eager managed Firestore or Storage dependency', async () => {
  const visited = new Set(), active = new Set()
  async function inspect(url) {
    assert.ok(!active.has(url.href), `circular dependency: ${url.href}`)
    if (visited.has(url.href)) return
    active.add(url.href); visited.add(url.href)
    const source = await readFile(url, 'utf8')
    for (const match of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
      const specifier = match[1]
      assert.doesNotMatch(specifier, /firebase\/firestore|firestoreClient|businessService\.js|storageClient/)
      if (specifier.startsWith('.')) await inspect(new URL(specifier, url))
    }
    active.delete(url.href)
  }
  await inspect(new URL('../src/services/publicBusinessService.js', import.meta.url))
  for (const page of ['HomePage','ServicesPage']) {
    const source = await readFile(new URL(`../src/pages/${page}.jsx`, import.meta.url),'utf8')
    assert.match(source, /from ['"]\.\.\/services\/publicBusinessService\.js['"]/)
    assert.doesNotMatch(source, /from ['"]\.\.\/services\/businessService\.js['"]/)
  }
})
