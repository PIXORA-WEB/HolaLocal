import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
const source = await readFile(new URL('../src/pages/MessagesPage.jsx', import.meta.url), 'utf8')
// Execute the real effect bodies, with browser boundaries replaced by spies.
const start = source.indexOf('  useEffect(() => {\n    const history =')
const end = source.indexOf('\n  useEffect(() => {', source.indexOf('}, [conversationId, conversationLoadStatus])', start))
const body = source.slice(start, end)
function run({ messages = [], mobile = false, reduced = false, conversationId = 'a', mounted = true } = {}) {
  const scrolls = [], focuses = [], frames = new Map(), cleanups = []
  const history = { scrollHeight: 2000, scrollTo: value => scrolls.push(value) }
  const window = {
    matchMedia: query => ({ matches: query.includes('reduced-motion') ? reduced : mobile }),
    requestAnimationFrame: cb => { frames.set(1, cb); return 1 },
    cancelAnimationFrame: id => frames.delete(id),
  }
  new Function('useEffect', 'window', 'messageListRef', 'messages', 'mobileBackRef', 'conversationListHeadingRef', 'conversationId', 'conversationLoadStatus', body)(
    fn => cleanups.push(fn()), window, { current: mounted ? history : null }, messages,
    { current: { focus: options => focuses.push(['back', options]) } },
    { current: { focus: options => focuses.push(['inbox', options]) } }, conversationId, 'ready',
  )
  return { scrolls, focuses, flush: () => { for (const cb of frames.values()) cb() }, cleanup: () => cleanups.forEach(fn => fn?.()) }
}
test('empty history performs no scroll', () => assert.deepEqual(run().scrolls, []))
test('populated history targets only its own bottom', () => assert.deepEqual(run({ messages: [{}] }).scrolls, [{ top: 2000, behavior: 'smooth' }]))
test('reduced motion keeps immediate internal bottom positioning', () => assert.equal(run({ messages: [{}], reduced: true }).scrolls[0].behavior, 'auto'))
test('unmounted history is ignored', () => assert.deepEqual(run({ messages: [{}], mounted: false }).scrolls, []))
test('desktop does not move focus', () => { const r = run(); r.flush(); assert.deepEqual(r.focuses, []) })
test('mobile conversation retains back focus without scrolling', () => { const r = run({ mobile: true }); r.flush(); assert.deepEqual(r.focuses, [['back', { preventScroll: true }]]) })
test('mobile inbox retains heading focus without scrolling', () => { const r = run({ mobile: true, conversationId: null }); r.flush(); assert.deepEqual(r.focuses, [['inbox', { preventScroll: true }]]) })
test('navigation/unmount cancels pending old focus frame', () => { const r = run({ mobile: true }); r.cleanup(); r.flush(); assert.deepEqual(r.focuses, []) })
test('new snapshots retain bottom behavior', () => { for (const messages of [[{}], [{}, {}]]) assert.equal(run({ messages }).scrolls.length, 1) })
