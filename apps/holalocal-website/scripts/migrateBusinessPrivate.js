/**
 * Backfills missing businessPrivate/{businessId} documents.
 *
 * Authentication uses Firebase Admin Application Default Credentials. Examples:
 *   npm run migrate:business-private -- --project=your-project-id
 *   npm run migrate:business-private -- --project=your-project-id --apply --confirm=MIGRATE_BUSINESS_PRIVATE
 *
 * Dry-run is always the default. The script never deletes or modifies fields in
 * businesses/{businessId}; public contact cleanup must be a separate migration.
 */
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { FieldPath, FieldValue, getFirestore } from 'firebase-admin/firestore'

const APPLY_CONFIRMATION = 'MIGRATE_BUSINESS_PRIVATE'
const DEFAULT_BATCH_SIZE = 100

function readArguments(argumentsList) {
  const options = {
    apply: false,
    batchSize: DEFAULT_BATCH_SIZE,
    confirmation: '',
    limit: Number.POSITIVE_INFINITY,
    projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || '',
  }

  for (const argument of argumentsList) {
    if (argument === '--apply') options.apply = true
    else if (argument.startsWith('--confirm=')) options.confirmation = argument.slice(10)
    else if (argument.startsWith('--project=')) options.projectId = argument.slice(10)
    else if (argument.startsWith('--batch-size=')) options.batchSize = Number(argument.slice(13))
    else if (argument.startsWith('--limit=')) options.limit = Number(argument.slice(8))
    else if (argument === '--help') options.help = true
    else throw new Error(`Unknown argument: ${argument}`)
  }

  if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 500) {
    throw new Error('--batch-size must be an integer from 1 to 500.')
  }
  if (!(options.limit === Number.POSITIVE_INFINITY || (Number.isInteger(options.limit) && options.limit > 0))) {
    throw new Error('--limit must be a positive integer.')
  }
  if (options.apply && options.confirmation !== APPLY_CONFIRMATION) {
    throw new Error(`Apply mode requires --confirm=${APPLY_CONFIRMATION}.`)
  }
  return options
}

function printHelp() {
  console.log(`Usage:
  npm run migrate:business-private -- --project=<firebase-project-id>
  npm run migrate:business-private -- --project=<firebase-project-id> --apply --confirm=${APPLY_CONFIRMATION}

Options:
  --apply             Create missing documents. Omit for dry-run.
  --confirm=...       Required exact confirmation token in apply mode.
  --batch-size=100    Businesses read per page (1-500).
  --limit=<number>    Stop after inspecting this many businesses.
  --project=<id>      Firebase project ID; otherwise uses ADC environment variables.
  --help              Show this help.`)
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null)
}

function stringValue(...values) {
  const value = firstDefined(...values)
  return typeof value === 'string' ? value.trim() : ''
}

function contactFromBusiness(business) {
  const contact = business.contact && typeof business.contact === 'object' ? business.contact : {}
  return {
    phone: stringValue(contact.phone, business.phone),
    phoneVisible: firstDefined(contact.phoneVisible, business.phoneVisible) === true,
    email: stringValue(contact.email, business.email),
    emailVisible: firstDefined(contact.emailVisible, business.emailVisible) === true,
    whatsappNumber: stringValue(
      contact.whatsappNumber,
      contact.whatsapp,
      business.whatsappNumber,
      business.whatsapp,
    ),
    whatsappVisible: firstDefined(contact.whatsappVisible, business.whatsappVisible) === true,
    website: stringValue(contact.website, business.website),
    preferredContactMethod: stringValue(
      contact.preferredContactMethod,
      business.preferredContactMethod,
    ) || 'holalocal',
    allowCallbackRequests:
      firstDefined(contact.allowCallbackRequests, business.allowCallbackRequests) === true,
  }
}

function contactSummary(contact) {
  const present = ['phone', 'email', 'whatsappNumber', 'website'].filter((field) => Boolean(contact[field]))
  const visible = [
    contact.phoneVisible && 'phone',
    contact.emailVisible && 'email',
    contact.whatsappVisible && 'whatsapp',
  ].filter(Boolean)
  return `contact fields: ${present.join(', ') || 'none'}; public: ${visible.join(', ') || 'none'}; callback: ${contact.allowCallbackRequests ? 'yes' : 'no'}`
}

async function createIfStillMissing(database, businessSnapshot, contact) {
  const privateRef = database.collection('businessPrivate').doc(businessSnapshot.id)
  return database.runTransaction(async (transaction) => {
    const currentPrivate = await transaction.get(privateRef)
    if (currentPrivate.exists) return false

    const business = businessSnapshot.data()
    transaction.create(privateRef, {
      ownerId: business.ownerId,
      managerIds: Array.isArray(business.managerIds)
        ? business.managerIds
        : [business.ownerId],
      contact,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    return true
  })
}

async function run() {
  const options = readArguments(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }
  if (!options.projectId) {
    throw new Error('Provide --project=<id> or set GOOGLE_CLOUD_PROJECT/GCLOUD_PROJECT.')
  }

  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault(), projectId: options.projectId })
  }
  const database = getFirestore()
  const mode = options.apply ? 'APPLY' : 'DRY RUN'
  console.log(`[${mode}] Project: ${options.projectId}`)
  console.log(`[${mode}] Public business documents will not be changed.`)

  let cursor = null
  let inspected = 0
  let missing = 0
  let created = 0
  let skippedAfterRecheck = 0
  let invalid = 0

  while (inspected < options.limit) {
    const pageSize = Math.min(options.batchSize, options.limit - inspected)
    let businessesQuery = database
      .collection('businesses')
      .orderBy(FieldPath.documentId())
      .limit(pageSize)
    if (cursor) businessesQuery = businessesQuery.startAfter(cursor)

    const businessesPage = await businessesQuery.get()
    if (businessesPage.empty) break

    const privateSnapshots = await database.getAll(
      ...businessesPage.docs.map((business) => database.collection('businessPrivate').doc(business.id)),
    )

    for (let index = 0; index < businessesPage.docs.length; index += 1) {
      const businessSnapshot = businessesPage.docs[index]
      inspected += 1
      if (privateSnapshots[index].exists) continue

      missing += 1
      const business = businessSnapshot.data()
      if (typeof business.ownerId !== 'string' || !business.ownerId.trim()) {
        invalid += 1
        console.warn(`[${mode}] ${businessSnapshot.id}: skipped because ownerId is missing or invalid`)
        continue
      }
      const contact = contactFromBusiness(business)
      console.log(`[${mode}] ${businessSnapshot.id}: missing businessPrivate; ${contactSummary(contact)}`)

      if (options.apply) {
        const wasCreated = await createIfStillMissing(database, businessSnapshot, contact)
        if (wasCreated) {
          created += 1
          console.log(`[APPLY] ${businessSnapshot.id}: created`)
        } else {
          skippedAfterRecheck += 1
          console.log(`[APPLY] ${businessSnapshot.id}: already created by another process; skipped`)
        }
      }
    }

    cursor = businessesPage.docs.at(-1)
    if (businessesPage.size < pageSize) break
  }

  console.log(`[${mode}] Complete. Inspected: ${inspected}; missing: ${missing}; invalid: ${invalid}; created: ${created}; race-safe skips: ${skippedAfterRecheck}.`)
  if (!options.apply && missing > 0) {
    console.log(`[DRY RUN] Re-run with --apply --confirm=${APPLY_CONFIRMATION} after reviewing this output.`)
  }
}

run().catch((error) => {
  console.error(`[migration] ${error.message}`)
  process.exitCode = 1
})
