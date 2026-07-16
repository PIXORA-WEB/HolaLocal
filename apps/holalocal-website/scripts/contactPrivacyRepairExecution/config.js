import { resolveKnownCredentialProjectIds } from '../testDataCleanupAudit/config.js'

export const CONFIRMATION_PHRASE = 'REMOVE CONFIRMED HIDDEN PUBLIC WEBSITE'
export const PRODUCTION_PROJECT_ID = 'holalocal-491c9'

const PLACEHOLDER_IDS = new Set(['demo', 'test', 'your-project-id', 'project-id', 'firebase-project-id'])
const WRITE_LIKE_FLAGS = /^--(write|fix|migrate|cleanup|execute|run|remove|destroy|purge|delete)(=|$)/

export function parseContactPrivacyExecutionArguments(values) {
  const options = {
    apply: false,
    businessPath: '',
    confirmProject: '',
    confirmationPhrase: '',
    dryRunReport: '',
    emulator: false,
    help: false,
    outputDir: '',
    projectId: '',
  }

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    const next = () => {
      index += 1
      if (index >= values.length) throw new Error(`Missing value for ${value}`)
      return values[index]
    }

    if (value === '--help') options.help = true
    else if (value === '--apply') options.apply = true
    else if (value === '--emulator') options.emulator = true
    else if (value === '--project-id') options.projectId = next()
    else if (value.startsWith('--project-id=')) options.projectId = value.slice(13)
    else if (value === '--confirm-project') options.confirmProject = next()
    else if (value.startsWith('--confirm-project=')) options.confirmProject = value.slice(18)
    else if (value === '--approved-dry-run-report') options.dryRunReport = next()
    else if (value.startsWith('--approved-dry-run-report=')) options.dryRunReport = value.slice(26)
    else if (value === '--business-path') options.businessPath = next()
    else if (value.startsWith('--business-path=')) options.businessPath = value.slice(16)
    else if (value === '--confirm-repair') options.confirmationPhrase = next()
    else if (value.startsWith('--confirm-repair=')) options.confirmationPhrase = value.slice(17)
    else if (value === '--output-dir') options.outputDir = next()
    else if (value.startsWith('--output-dir=')) options.outputDir = value.slice(13)
    else if (WRITE_LIKE_FLAGS.test(value)) throw new Error(`${value} is not supported by this narrow repair tool.`)
    else throw new Error(`Unknown argument: ${value}`)
  }

  return options.help ? options : validateContactPrivacyExecutionOptions(options)
}

export function validateContactPrivacyExecutionOptions(options) {
  if (!options.projectId || typeof options.projectId !== 'string') throw new Error('Missing required --project-id.')
  const projectId = options.projectId.trim()
  if (!/^[a-z][a-z0-9-]{4,62}$/.test(projectId) || PLACEHOLDER_IDS.has(projectId)) {
    throw new Error('Refusing to run with an invalid or placeholder project ID.')
  }
  if (!options.emulator && projectId !== PRODUCTION_PROJECT_ID) {
    throw new Error(`Production contact privacy repair runs are allowlisted only for ${PRODUCTION_PROJECT_ID}.`)
  }
  if (!options.emulator && options.confirmProject !== projectId) {
    throw new Error('Non-emulator repair runs require --confirm-project exactly matching --project-id.')
  }
  if (!options.dryRunReport) throw new Error('Missing required --approved-dry-run-report.')
  if (!/^businesses\/[^/]+$/.test(options.businessPath)) throw new Error('Missing required exact --business-path.')
  if (!options.outputDir || typeof options.outputDir !== 'string') throw new Error('Missing required --output-dir.')
  if (options.apply && options.confirmationPhrase !== CONFIRMATION_PHRASE) {
    throw new Error('Applying the repair requires the exact --confirm-repair phrase.')
  }
  return { ...options, projectId }
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
