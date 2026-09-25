export const actionLocales = ['en', 'es', 'fr', 'de', 'nl', 'pt', 'pl', 'ro', 'cs', 'sk', 'hu', 'uk', 'it', 'sv', 'da', 'fi', 'no']
const operations = { verifyEmail: 'VERIFY_EMAIL', resetPassword: 'PASSWORD_RESET', recoverEmail: 'RECOVER_EMAIL' }
export function actionLocale(value) {
  const code = typeof value === 'string' ? value.toLowerCase().split('-')[0] : ''
  return actionLocales.includes(code) ? code : undefined
}
export function safeActionContinue(value) {
  if (typeof value !== 'string' || !value.startsWith('https://www.holalocal.es/') || [...value].some(char => char === '\\' || char.charCodeAt(0) <= 32)) return '/login'
  try {
    // Validate the original encoding before URLSearchParams can normalize it.
    // Discard decoded text: only the original URL is parsed for navigation.
    decodeURIComponent(value)
    const url = new URL(value)
    if (url.origin !== 'https://www.holalocal.es' || url.username || url.password) return '/login'
    const path = decodeURIComponent(url.pathname)
    if (path.startsWith('//') || path.includes('\\') || /^\/auth\/action\/?$/i.test(path)) return '/login'
    for (const key of ['mode', 'oobCode', 'apiKey', 'continueUrl']) url.searchParams.delete(key)
    return `${url.pathname}${url.search}${url.hash}`
  } catch { return '/login' }
}
export function parseEmailAction(search, expectedApiKey) {
  const params = new URLSearchParams(search)
  const mode = params.get('mode'), code = params.get('oobCode'), apiKey = params.get('apiKey')
  const malformed = /%(?![\da-f]{2})/i.test(search) || search.length > 16000 ||
    ['mode', 'oobCode', 'apiKey', 'continueUrl', 'lang'].some(key => params.getAll(key).length > 1)
  if (malformed || !Object.hasOwn(operations, mode) || !code || code.length > 4096 || !/^[\w-]+$/.test(code) || !expectedApiKey || apiKey !== expectedApiKey) return { error: 'invalid', locale: actionLocale(params.get('lang')) }
  return { mode, code, locale: actionLocale(params.get('lang')), destination: safeActionContinue(params.get('continueUrl')) }
}
export function actionError(error) {
  if (['auth/expired-action-code', 'auth/invalid-action-code', 'auth/user-disabled', 'auth/user-not-found'].includes(error?.code)) return 'invalid'
  if (['auth/weak-password', 'auth/password-does-not-meet-requirements', 'auth/missing-password'].includes(error?.code)) return 'weak'
  if (['auth/network-request-failed', 'auth/too-many-requests', 'auth/internal-error'].includes(error?.code)) return 'temporary'
  return 'failure'
}
// One instance per URL lifetime; StrictMode effect replay subscribes to the same operation.
// No global action cache. SDK mutations cannot be aborted once issued; detached listeners
// and pre-mutation liveness checks prevent old operations from publishing into a new page.
export function createEmailActionController(request, sdk) {
  let state = { phase: request.error ? 'error' : 'loading', error: request.error }, started = false, submitting = false
  let refresh = sdk.refresh
  const listeners = new Set()
  const publish = next => { state = next; for (const listener of listeners) listener(state) }
  const live = () => listeners.size > 0
  return {
    setRefresh(callback) { refresh = callback },
    subscribe(listener) { listeners.add(listener); listener(state); return () => listeners.delete(listener) },
    async start() {
      if (started || request.error) return
      started = true
      try {
        const user = sdk.currentUser()
        if (request.mode === 'resetPassword') {
          await sdk.verifyReset(request.code)
          if (live()) publish({ phase: 'form' })
          return
        }
        const info = await sdk.check(request.code)
        if (info.operation !== operations[request.mode]) throw { code: 'auth/invalid-action-code' }
        if (!live()) return
        await sdk.apply(request.code)
        if (!live()) return
        let refreshWarning = false
        if (request.mode === 'verifyEmail' && user && sdk.currentUser() === user) {
          try { await refresh(user) } catch { refreshWarning = true }
        }
        if (live()) publish({ phase: 'success', refreshWarning })
      } catch (error) { if (live()) publish({ phase: 'error', error: actionError(error) }) }
    },
    async confirm(password, confirmation) {
      if (!live() || submitting || state.phase !== 'form') return
      if (password.length < 8) { publish({ phase: 'form', error: 'weak' }); return }
      if (password !== confirmation) { publish({ phase: 'form', error: 'mismatch' }); return }
      submitting = true
      publish({ phase: 'form', busy: true })
      try {
        await sdk.confirm(request.code, password)
        if (live()) publish({ phase: 'success' })
      } catch (error) {
        const category = actionError(error)
        if (live()) publish({ phase: category === 'invalid' ? 'error' : 'form', error: category })
      } finally { submitting = false }
    },
  }
}
