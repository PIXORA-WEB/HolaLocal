const PLACEHOLDER_IDS = new Set(['demo', 'test', 'your-project-id', 'project-id', 'firebase-project-id'])
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const TOKEN_PATTERN = /([?&](?:token|access_token|auth|key|signature)=)[^&\s]+/gi
const URL_PATTERN = /https?:\/\/[^\s)]+/gi
const PRIVATE_PATH_PATTERN = /\/(?:home|Users|var|tmp)\/[^\s)]+/g
const PHONE_PATTERN = /\b(?:\+?\d[\d\s().-]{6,}\d)\b/g

export function parseAuditArguments(values) {
  const options = {
    collectionScope: ['users', 'businesses', 'businessPrivate', 'conversations', 'reports'],
    confirmProject: '',
    confirmStorageBucket: '',
    emulator: false,
    help: false,
    outputDir: '',
    pageSize: 100,
    projectId: '',
    checkStorage: false,
    storageBucket: '',
  }

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    const next = () => {
      index += 1
      if (index >= values.length) throw new Error(`Missing value for ${value}`)
      return values[index]
    }
    if (value === '--help') options.help = true
    else if (value === '--emulator') options.emulator = true
    else if (value === '--check-storage') options.checkStorage = true
    else if (value === '--storage-bucket') options.storageBucket = next()
    else if (value.startsWith('--storage-bucket=')) options.storageBucket = value.slice(17)
    else if (value === '--confirm-storage-bucket') options.confirmStorageBucket = next()
    else if (value.startsWith('--confirm-storage-bucket=')) options.confirmStorageBucket = value.slice(25)
    else if (value === '--project-id') options.projectId = next()
    else if (value.startsWith('--project-id=')) options.projectId = value.slice(13)
    else if (value === '--confirm-project') options.confirmProject = next()
    else if (value.startsWith('--confirm-project=')) options.confirmProject = value.slice(18)
    else if (value === '--output-dir') options.outputDir = next()
    else if (value.startsWith('--output-dir=')) options.outputDir = value.slice(13)
    else if (value === '--page-size') options.pageSize = Number(next())
    else if (value.startsWith('--page-size=')) options.pageSize = Number(value.slice(12))
    else if (value === '--collections') options.collectionScope = next().split(',').map((item) => item.trim()).filter(Boolean)
    else if (value.startsWith('--collections=')) options.collectionScope = value.slice(14).split(',').map((item) => item.trim()).filter(Boolean)
    else if (/^--(apply|write|fix|migrate|cleanup|delete|repair)(=|$)/.test(value)) {
      throw new Error(`${value} is not supported. This audit tool is strictly read-only.`)
    } else throw new Error(`Unknown argument: ${value}`)
  }

  return options.help ? options : validateAuditOptions(options)
}

export function validateAuditOptions(options) {
  if (!options.projectId || typeof options.projectId !== 'string') throw new Error('Missing required --project-id.')
  const projectId = options.projectId.trim()
  if (!/^[a-z][a-z0-9-]{4,62}$/.test(projectId) || PLACEHOLDER_IDS.has(projectId)) {
    throw new Error('Refusing to run with an invalid or placeholder project ID.')
  }
  if (!options.outputDir || typeof options.outputDir !== 'string') throw new Error('Missing required --output-dir.')
  if (!Number.isInteger(options.pageSize) || options.pageSize < 1 || options.pageSize > 500) {
    throw new Error('--page-size must be an integer from 1 to 500.')
  }
  const allowedCollections = new Set(['users', 'businesses', 'businessPrivate', 'conversations', 'reports'])
  if (!Array.isArray(options.collectionScope) || options.collectionScope.length === 0) {
    throw new Error('--collections must include at least one supported collection.')
  }
  for (const collection of options.collectionScope) {
    if (!allowedCollections.has(collection)) throw new Error(`Unsupported collection scope: ${collection}`)
  }
  if (!options.emulator && options.confirmProject !== projectId) {
    throw new Error('Non-emulator audits require --confirm-project exactly matching --project-id.')
  }
  if (options.checkStorage && !options.emulator) {
    if (!options.storageBucket || options.confirmStorageBucket !== options.storageBucket) {
      throw new Error('Non-emulator --check-storage requires --storage-bucket and matching --confirm-storage-bucket.')
    }
    if (!options.storageBucket.startsWith(`${projectId}.`) && options.storageBucket !== `${projectId}.appspot.com`) {
      throw new Error('Storage bucket must visibly belong to the selected project ID.')
    }
  }
  return {
    ...options,
    projectId,
    storageBucket: options.storageBucket.trim(),
    outputDir: options.outputDir,
    collectionScope: [...new Set(options.collectionScope)].sort(),
  }
}

export function safeErrorDetails(error, context = {}) {
  const rawCode = typeof error?.code === 'string' ? error.code : 'unknown'
  const rawMessage = typeof error?.message === 'string' ? error.message : String(error ?? '')
  const message = rawMessage
    .replace(TOKEN_PATTERN, '$1[REDACTED]')
    .replace(URL_PATTERN, '[REDACTED_URL]')
    .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
    .replace(PRIVATE_PATH_PATTERN, '[REDACTED_PATH]')
    .replace(PHONE_PATTERN, '[REDACTED_PHONE]')
    .slice(0, 240)
  return {
    category: context.category ?? 'execution',
    code: rawCode.replace(/[^a-zA-Z0-9_/-]/g, '').slice(0, 80) || 'unknown',
    check: context.check ?? null,
    collection: context.collection ?? null,
    status: context.status ?? 'failed',
    message,
  }
}

export async function resolveKnownCredentialProjectIds(env = process.env, readTextFile = null) {
  const projects = []
  const add = (source, value) => {
    if (typeof value === 'string' && value.trim()) projects.push({ source, projectId: value.trim() })
  }
  add('GCLOUD_PROJECT', env.GCLOUD_PROJECT)
  add('GOOGLE_CLOUD_PROJECT', env.GOOGLE_CLOUD_PROJECT)
  if (env.FIREBASE_CONFIG) {
    try { add('FIREBASE_CONFIG', JSON.parse(env.FIREBASE_CONFIG).projectId) } catch { /* ignored; config validation handles the selected project */ }
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

export async function validateExecutionEnvironment(options, {
  env = process.env,
  readTextFile = null,
  checkFirestoreEmulator = null,
} = {}) {
  if (options.emulator) {
    if (!env.FIRESTORE_EMULATOR_HOST) throw new Error('--emulator requires FIRESTORE_EMULATOR_HOST so it cannot fall back to production.')
    if (options.checkStorage && !(env.FIREBASE_STORAGE_EMULATOR_HOST || env.STORAGE_EMULATOR_HOST)) {
      throw new Error('--check-storage in emulator mode requires FIREBASE_STORAGE_EMULATOR_HOST or STORAGE_EMULATOR_HOST.')
    }
    if (checkFirestoreEmulator) await checkFirestoreEmulator(env.FIRESTORE_EMULATOR_HOST)
    return { credentialProjectStatus: 'emulator-no-credentials-required', credentialProjects: [] }
  }
  if (env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('FIRESTORE_EMULATOR_HOST is set but --emulator was not provided.')
  }
  const credentialProjects = await resolveKnownCredentialProjectIds(env, readTextFile)
  const known = credentialProjects.filter(({ projectId }) => projectId)
  const mismatch = known.find(({ projectId }) => projectId !== options.projectId)
  if (mismatch) throw new Error(`Credential project mismatch from ${mismatch.source}.`)
  return {
    credentialProjectStatus: known.length ? 'matched' : 'unknown-explicit-confirmation-required',
    credentialProjects: known.map(({ source }) => ({ source, projectId: options.projectId })),
  }
}

export function auditHelp() {
  return `Usage:
  npm run audit:firebase-readonly -- --emulator --project-id demo-holalocal-audit --output-dir ../../audit-reports/local
  npm run audit:firebase-readonly -- --project-id <project-id> --confirm-project <project-id> --output-dir ../../audit-reports/<run-id>

Options:
  --project-id <id>          Required. Never inferred from .firebaserc.
  --confirm-project <id>    Required outside --emulator; must exactly match project ID.
  --output-dir <path>       Required local directory for report files.
  --page-size <1-500>       Firestore page size. Default: 100.
  --collections a,b         Optional subset of users,businesses,businessPrivate,conversations,reports.
  --check-storage           Check only referenced Storage object paths. Never crawls buckets.
  --storage-bucket <name>   Required with --check-storage outside emulator.
  --confirm-storage-bucket  Required exact bucket confirmation outside emulator.
  --emulator                Require FIRESTORE_EMULATOR_HOST and use local emulators only.
  --help                    Show this help.

No apply, write, fix, migrate, cleanup, repair or delete mode exists.`
}
