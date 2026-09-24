import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { matchPath } from 'react-router-dom'
import { clearBusinessMediaPresentationCache, resolveBusinessMediaPresentation } from '../src/services/businessMediaPresentation.js'
import { createInboxViewState, inboxViewReducer, selectInboxView } from '../src/utils/messageConversationState.js'

const source = await readFile(new URL('../src/routes/AppRoutes.jsx', import.meta.url), 'utf8')
const body = source.slice(source.indexOf('function BusinessMediaPresentationCleanup()'), source.indexOf('function SignInRedirect()'))
// Execute the actual owner; model React's dependency cleanup without loading Firebase.
function lifecycle() {
  let pathname, previous, cleanup
  const render = new Function('useLocation', 'useLayoutEffect', 'matchPath', 'clearBusinessMediaPresentationCache', `${body}; return BusinessMediaPresentationCleanup`)(
    () => ({ pathname }),
    (effect, dependencies) => {
      if (!previous || dependencies.some((value, index) => !Object.is(value, previous[index]))) {
        cleanup?.()
        cleanup = effect()
        previous = dependencies
      }
    }, matchPath, clearBusinessMediaPresentationCache,
  )
  return { navigate(path) { pathname = path; render() }, unmount() { cleanup?.(); cleanup = null } }
}
async function cachedLogo(revoked) {
  const url = 'blob:inbox-owned'
  const business = await resolveBusinessMediaPresentation('a', { logoStoragePath: 'businesses/a/logos/logo/a' }, {
    resolveCanonicalUrl: async () => ({ url, revoke: () => revoked.push(url) }),
  })
  return business.logoUrl
}
const settle = () => new Promise(setImmediate)

test('Messages path transitions preserve the exact cached URL until leaving', async () => {
  clearBusinessMediaPresentationCache()
  const owner = lifecycle(), revoked = []
  owner.navigate('/messages')
  const url = await cachedLogo(revoked)
  for (const path of ['/messages/abc', '/messages', '/messages/abc', '/messages/xyz']) {
    owner.navigate(path)
    await settle()
    assert.deepEqual(revoked, [])
    assert.equal(await cachedLogo(revoked), url)
  }
  owner.navigate('/services')
  await settle()
  assert.deepEqual(revoked, [url])
  owner.unmount()
})

for (const destination of ['/profile', '/business/dashboard', '/messages-other', '/messages/abc/extra']) {
  test(`leaving conversation for ${destination} releases its cached URL`, async () => {
    const owner = lifecycle(), revoked = []
    owner.navigate('/messages/abc')
    const url = await cachedLogo(revoked)
    owner.navigate(destination)
    await settle()
    assert.deepEqual(revoked, [url])
    owner.unmount()
  })
}

test('routing-owner unmount releases the URL once', async () => {
  const owner = lifecycle(), revoked = []
  owner.navigate('/messages/abc')
  const url = await cachedLogo(revoked)
  owner.unmount(); owner.unmount()
  await settle()
  assert.deepEqual(revoked, [url])
})

test('non-Messages transitions keep pathname cleanup; Messages matching follows router semantics', async () => {
  const owner = lifecycle(), revoked = []
  owner.navigate('/services/a')
  const url = await cachedLogo(revoked)
  owner.navigate('/services/b'); await settle()
  assert.deepEqual(revoked, [url])
  owner.navigate('/Messages/abc/'); const next = []
  await cachedLogo(next)
  owner.navigate('/messages'); await settle()
  assert.deepEqual(next, [])
  owner.unmount(); await settle(); assert.deepEqual(next, [url])
})

test('account selection excludes old rows even though route-scoped media remains cached', () => {
  const row = { conversationId: 'a', participantIds: ['old', 'owner'], business: { logoUrl: 'blob:old' } }
  const state = inboxViewReducer(createInboxViewState('old'), { type: 'loadSucceeded', userId: 'old', items: [row] })
  assert.deepEqual(selectInboxView(state, 'new').items, [])
  const next = inboxViewReducer(state, { type: 'loadStarted', userId: 'new' })
  assert.deepEqual(next.items, [])
  assert.equal(inboxViewReducer(next, { type: 'loadSucceeded', userId: 'old', items: [row] }), next)
})
