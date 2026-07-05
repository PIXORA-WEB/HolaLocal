import { gzipSync } from 'node:zlib'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

const budgetBytes = 200 * 1024
const dist = resolve('dist')
const html = await readFile(join(dist, 'index.html'), 'utf8')
const entryMatch = html.match(/<script[^>]+src="([^"]+\.js)"/)
if (!entryMatch) throw new Error('Could not find the production JavaScript entry in dist/index.html.')

const visited = new Set()
const files = []
async function collectStaticImports(file) {
  if (visited.has(file)) return
  visited.add(file)
  const source = await readFile(file)
  files.push({ file, gzip: gzipSync(source).length, size: source.length })
  const text = source.toString('utf8')
  const imports = [...text.matchAll(/(?:from\s*|import\s*)["'](\.\/[^"']+\.js)["']/g)]
  await Promise.all(imports.map((match) => collectStaticImports(resolve(dirname(file), match[1]))))
}

await collectStaticImports(resolve(dist, entryMatch[1].replace(/^\//, '')))
const initialGzip = files.reduce((total, file) => total + file.gzip, 0)
console.log(`Initial static JavaScript: ${(initialGzip / 1024).toFixed(2)} kB gzip`)
files.sort((a, b) => b.gzip - a.gzip).forEach(({ file, gzip }) => {
  console.log(`- ${file.replace(`${dist}/`, '')}: ${(gzip / 1024).toFixed(2)} kB gzip`)
})

const i18nSource = await readFile(resolve('src/i18n/index.js'), 'utf8')
const eagerLocaleImports = [...i18nSource.matchAll(/^import .*locales\/(?!en\.json|mergeLocale)([^'";]+)/gm)]
if (eagerLocaleImports.length > 0) throw new Error('Non-English locale resources must remain dynamically imported.')

if (initialGzip > budgetBytes) {
  throw new Error(`Initial JavaScript exceeds the ${(budgetBytes / 1024).toFixed(0)} kB gzip budget.`)
}

// Ensure the build produced route chunks, rather than folding every page into the entry.
const assets = await readdir(join(dist, 'assets'))
if (!assets.some((file) => file.startsWith('EarlyAccessPage-'))) {
  throw new Error('Expected an Early Access route chunk in the production build.')
}
