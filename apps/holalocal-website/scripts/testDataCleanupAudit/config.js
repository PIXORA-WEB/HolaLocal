const PLACEHOLDER_IDS = new Set(['demo', 'test', 'your-project-id', 'project-id', 'firebase-project-id'])
const WRITE_LIKE_FLAGS = /^--(apply|write|fix|migrate|cleanup|execute|run|remove|destroy|purge)(=|$)/
const UID_PATTERN = /^[A-Za-z0-9]{20,40}$/

export const DEFAULT_PAGE_SIZE = 100

export function parseCleanupAuditArguments(values) {
  const options = {
    confirmProject: '',
    emulator: false,
    help: false,
    outputDir: '',
    pageSize: DEFAULT_PAGE_SIZE,
    projectId: '',
    protectedUids: [],
    targetUids: [],
  }

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    const next = () => {
      index += 1
      if (index >= values.length) throw new Error(`Missing value for ${value}`)
      return values[index]
    }
    const addList = (target, raw) => {
      target.push(...String(raw).split(',').map((item) => item.trim()).filter(Boolean))
    }

    if (value === '--help') options.help = true
    else if (value === '--emulator') options.emulator = true
    else if (value === '--project-id') options.projectId = next()
    else if (value.startsWith('--project-id=')) options.projectId = value.slice(13)
    else if (value === '--confirm-project') options.confirmProject = next()
    else if (value.startsWith('--confirm-project=')) options.confirmProject = value.slice(18)
    else if (value === '--target-uid') addList(options.targetUids, next())
    else if (value.startsWith('--target-uid=')) addList(options.targetUids, value.slice(13))
    else if (value === '--target-uids') addList(options.targetUids, next())
    else if (value.startsWith('--target-uids=')) addList(options.targetUids, value.slice(14))
    else if (value === '--protected-uid') addList(options.protectedUids, next())
    else if (value.startsWith('--protected-uid=')) addList(options.protectedUids, value.slice(16))
    else if (value === '--protected-uids') addList(options.protectedUids, next())
    else if (value.startsWith('--protected-uids=')) addList(options.protectedUids, value.slice(17))
    else if (value === '--output-dir') options.outputDir = next()
    else if (value.startsWith('--output-dir=')) options.outputDir = value.slice(13)
    else if (value === '--page-size') options.pageSize = Number(next())
    else if (value.startsWith('--page-size=')) options.pageSize = Number(value.slice(12))
    else if (WRITE_LIKE_FLAGS.test(value)) throw new Error(`${value} is not supported. This tool is strictly read-only.`)
    else throw new Error(`Unknown argument: ${value}`)
  }

  return options.help ? options : validateCleanupAuditOptions(options)
}

export function validateCleanupAuditOptions(options) {
  if (!options.projectId || typeof options.projectId !== 'string') throw new Error('Missing required --project-id.')
  const projectId = options.projectId.trim()
  if (!/^[a-z][a-z0-9-]{4,62}$/.test(projectId) || PLACEHOLDER_IDS.has(projectId)) {
    throw new Error('Refusing to run with an invalid or placeholder project ID.')
  }
  if (!options.emulator && options.confirmProject !== projectId) {
    throw new Error('Non-emulator dry runs require --confirm-project exactly matching --project-id.')
  }
  if (!options.outputDir || typeof options.outputDir !== 'string') throw new Error('Missing required --output-dir.')
  if (!Number.isInteger(options.pageSize) || options.pageSize < 1 || options.pageSize > 500) {
    throw new Error('--page-size must be an integer from 1 to 500.')
  }
  const targetUids = uniqueUids(options.targetUids, 'target')
  const protectedUids = uniqueUids(options.protectedUids, 'protected')
  if (targetUids.length === 0) throw new Error('At least one target UID is required.')
  if (targetUids.length !== 4) throw new Error('Exactly four target UIDs are required.')
  if (protectedUids.length !== 2) throw new Error('Exactly two protected UIDs are required.')
  const overlap = targetUids.find((uid) => protectedUids.includes(uid))
  if (overlap) throw new Error('Target and protected UID lists must not overlap.')

  return {
    ...options,
    outputDir: options.outputDir,
    pageSize: options.pageSize,
    projectId,
    protectedUids,
    targetUids,
  }
}

function uniqueUids(values, label) {
  if (!Array.isArray(values)) throw new Error(`${label} UIDs must be an array.`)
  const trimmed = values.map((value) => String(value).trim()).filter(Boolean)
  for (const uid of trimmed) {
    if (!UID_PATTERN.test(uid)) throw new Error(`Invalid ${label} UID format.`)
  }
  return [...new Set(trimmed)].sort()
}

export async function validateExecutionEnvironment(options, {
  env = process.env,
  readTextFile = null,
  resolveCredentialProjects = resolveKnownCredentialProjectIds,
} = {}) {
  if (options.emulator) {
    if (!env.FIRESTORE_EMULATOR_HOST) throw new Error('--emulator requires FIRESTORE_EMULATOR_HOST.')
    return { credentialProjectStatus: 'emulator-no-credentials-required' }
  }
  if (env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is set but --emulator was not provided.')
  if (env.FIREBASE_STORAGE_EMULATOR_HOST) throw new Error('FIREBASE_STORAGE_EMULATOR_HOST is set but --emulator was not provided.')

  const credentialProjects = await resolveCredentialProjects(env, readTextFile)
  const known = credentialProjects.filter(({ projectId }) => projectId)
  const mismatch = known.find(({ projectId }) => projectId !== options.projectId)
  if (mismatch) throw new Error(`Credential project mismatch from ${mismatch.source}.`)
  return { credentialProjectStatus: known.length ? 'matched' : 'unknown-explicit-confirmation-required' }
}

export async function resolveKnownCredentialProjectIds(env = process.env, readTextFile = null) {
  const projects = []
  const add = (source, value) => {
    if (typeof value === 'string' && value.trim()) projects.push({ source, projectId: value.trim() })
  }
  add('GCLOUD_PROJECT', env.GCLOUD_PROJECT)
  add('GOOGLE_CLOUD_PROJECT', env.GOOGLE_CLOUD_PROJECT)
  if (env.FIREBASE_CONFIG) {
    try { add('FIREBASE_CONFIG', JSON.parse(env.FIREBASE_CONFIG).projectId) } catch { /* ignored */ }
  }
  if (env.GOOGLE_APPLICATION_CREDENTIALS && readTextFile) {
    try {
      const parsed = JSON.parse(await readTextFile(env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'))
      add('GOOGLE_APPLICATION_CREDENTIALS', parsed.project_id)
    } catch {
      projects.push({ source: 'GOOGLE_APPLICATION_CREDENTIALS', projectId: null })
    }
  }
  return projects
}

export function safeErrorDetails(error) {
  const rawMessage = typeof error?.message === 'string' ? error.message : String(error ?? '')
  return rawMessage
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/https?:\/\/[^\s)]+/gi, '[REDACTED_URL]')
    .replace(/\b(?:\+?\d[\d\s().-]{6,}\d)\b/g, '[REDACTED_PHONE]')
    .replace(/([?&](?:token|access_token|auth|key|signature)=)[^&\s]+/gi, '$1[REDACTED]')
    .slice(0, 240)
}

export function cleanupAuditHelp() {
  return `Usage:
  npm run audit:test-cleanup-readonly -- --project-id <project-id> --confirm-project <project-id> --target-uid <uid> --target-uid <uid> --target-uid <uid> --target-uid <uid> --protected-uid <uid> --protected-uid <uid> --output-dir <private-dir>

Options:
  --project-id <id>       Required. Never inferred.
  --confirm-project <id> Required outside --emulator; must exactly match.
  --target-uid <uid>     Required four times, or comma-separated via --target-uids.
  --protected-uid <uid>  Required twice, or comma-separated via --protected-uids.
  --output-dir <path>    Required private report directory.
  --page-size <1-500>    Firestore page size. Default: 100.
  --emulator             Requires FIRESTORE_EMULATOR_HOST.

No apply, write, migrate, execute, cleanup, remove, purge or destructive mode exists.`
}
