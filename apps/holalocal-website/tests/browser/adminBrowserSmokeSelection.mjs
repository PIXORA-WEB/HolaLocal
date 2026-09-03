export const ADMIN_BROWSER_SCENARIO_TITLES = Object.freeze([
  'subscription assignment, private boundaries, owner projection, moderator access and responsive UI',
  'route claims, rejection, owner resubmission, approval, privacy and responsive UI',
  'real callable stale, concurrency and payload-bound idempotency',
  'locale chunks are asynchronous, persisted and last selection wins',
])

const [subscriptionTitle, routeClaimsTitle, callableTitle, localeTitle] = ADMIN_BROWSER_SCENARIO_TITLES

function exactEndingPattern(titles) {
  const escaped = titles.map((title) => title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return escaped.length === 1 ? `${escaped[0]}$` : `(?:${escaped.join('|')})$`
}

const lifecycleDefinitions = Object.freeze({
  'lifecycle-a': Object.freeze({
    artifactGroup: 'lifecycle-a', id: 'lifecycle-a', label: 'Lifecycle A', retries: 0,
    scenarioTitles: Object.freeze([subscriptionTitle]),
    selectionPattern: exactEndingPattern([subscriptionTitle]),
  }),
  'lifecycle-b': Object.freeze({
    artifactGroup: 'lifecycle-b', id: 'lifecycle-b', label: 'Lifecycle B', retries: 0,
    scenarioTitles: Object.freeze([routeClaimsTitle]),
    selectionPattern: exactEndingPattern([routeClaimsTitle]),
  }),
  'lifecycle-c': Object.freeze({
    artifactGroup: 'lifecycle-c', id: 'lifecycle-c', label: 'Lifecycle C', retries: 0,
    scenarioTitles: Object.freeze([callableTitle, localeTitle]),
    selectionPattern: exactEndingPattern([callableTitle, localeTitle]),
  }),
})

export const ADMIN_BROWSER_ACCEPTANCE_PLAN = Object.freeze([
  lifecycleDefinitions['lifecycle-a'],
  lifecycleDefinitions['lifecycle-b'],
  lifecycleDefinitions['lifecycle-c'],
])

export function parseAdminBrowserSmokeArguments(args) {
  if (!Array.isArray(args)) throw new TypeError('Protected browser runner arguments must be an array.')
  if (args.length === 0) {
    return Object.freeze({ lifecycleIds: Object.freeze(['lifecycle-a', 'lifecycle-b', 'lifecycle-c']), mode: 'acceptance' })
  }
  if (args.length !== 2 || args[0] !== '--scenario' || args[1] !== 'route-claims') {
    throw new Error('Protected browser runner accepts only --scenario route-claims or no arguments.')
  }
  return Object.freeze({ lifecycleIds: Object.freeze(['lifecycle-b']), mode: 'diagnostic' })
}

export function getAdminBrowserLifecycle(id) {
  const lifecycle = lifecycleDefinitions[id]
  if (!lifecycle) throw new Error('Protected browser runner received an unknown lifecycle.')
  return lifecycle
}

export function adminBrowserPlaywrightArguments(id) {
  const lifecycle = getAdminBrowserLifecycle(id)
  return Object.freeze([
    'test', '--config', 'playwright.admin.config.js', '--grep', lifecycle.selectionPattern,
    `--retries=${lifecycle.retries}`,
  ])
}

export function adminBrowserEmulatorArguments(projectId) {
  return Object.freeze([
    'emulators:exec', '--config', '../../firebase.json', '--project', projectId,
    '--only', 'auth,firestore,storage,functions',
    'node tests/browser/runAdminBrowserSmokeInsideEmulators.mjs',
  ])
}
