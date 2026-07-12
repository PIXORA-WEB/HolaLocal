import { resolveKnownCredentialProjectIds } from '../testDataCleanupAudit/config.js'

const PLACEHOLDER_IDS = new Set(['demo', 'test', 'your-project-id', 'project-id', 'firebase-project-id'])
const WRITE_LIKE_FLAGS = /^--(apply|write|fix|migrate|cleanup|execute|run|remove|destroy|purge|repair)(=|$)/

export function parseContactPrivacyRepairArguments(values) {
  const options = {
    auditReport: '',
    businessId: '',
    confirmProject: '',
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
    else if (value === '--emulator') options.emulator = true
    else if (value === '--project-id') options.projectId = next()
    else if (value.startsWith('--project-id=')) options.projectId = value.slice(13)
    else if (value === '--confirm-project') options.confirmProject = next()
    else if (value.startsWith('--confirm-project=')) options.confirmProject = value.slice(18)
    else if (value === '--audit-report') options.auditReport = next()
    else if (value.startsWith('--audit-report=')) options.auditReport = value.slice(15)
    else if (value === '--business-id') options.businessId = next()
    else if (value.startsWith('--business-id=')) options.businessId = value.slice(14)
    else if (value === '--output-dir') options.outputDir = next()
    else if (value.startsWith('--output-dir=')) options.outputDir = value.slice(13)
    else if (WRITE_LIKE_FLAGS.test(value)) throw new Error(`${value} is not supported. This tool is read-only.`)
    else throw new Error(`Unknown argument: ${value}`)
  }

  return options.help ? options : validateContactPrivacyRepairOptions(options)
}

export function validateContactPrivacyRepairOptions(options) {
  if (!options.projectId || typeof options.projectId !== 'string') throw new Error('Missing required --project-id.')
  const projectId = options.projectId.trim()
  if (!/^[a-z][a-z0-9-]{4,62}$/.test(projectId) || PLACEHOLDER_IDS.has(projectId)) {
    throw new Error('Refusing to run with an invalid or placeholder project ID.')
  }
  if (!options.emulator && options.confirmProject !== projectId) {
    throw new Error('Non-emulator dry runs require --confirm-project exactly matching --project-id.')
  }
  if (!options.auditReport && !options.businessId) {
    throw new Error('Provide --audit-report or --business-id for the narrow privacy check.')
  }
  if (!options.outputDir || typeof options.outputDir !== 'string') throw new Error('Missing required --output-dir.')
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
