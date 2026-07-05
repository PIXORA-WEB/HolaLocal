/** Audits and optionally removes private contact values from public business documents. */
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { FieldPath, FieldValue, getFirestore } from 'firebase-admin/firestore'

const CONFIRMATION = 'CLEAN_PUBLIC_BUSINESS_CONTACTS'
const LEGACY_FIELDS = ['phone', 'email', 'whatsapp', 'whatsappNumber']

function readArguments(values) {
  const options = { apply: false, confirmation: '', help: false, limit: Infinity, projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || '' }
  for (const value of values) {
    if (value === '--apply') options.apply = true
    else if (value === '--help') options.help = true
    else if (value.startsWith('--confirm=')) options.confirmation = value.slice(10)
    else if (value.startsWith('--limit=')) options.limit = Number(value.slice(8))
    else if (value.startsWith('--project=')) options.projectId = value.slice(10)
    else throw new Error(`Unknown argument: ${value}`)
  }
  if (!(options.limit === Infinity || (Number.isInteger(options.limit) && options.limit > 0))) throw new Error('--limit must be a positive integer.')
  if (options.apply && options.confirmation !== CONFIRMATION) throw new Error(`Apply mode requires --confirm=${CONFIRMATION}.`)
  return options
}

function printHelp() {
  console.log(`Usage:
  npm run audit:public-contacts -- --project=<firebase-project-id>
  npm run audit:public-contacts -- --project=<firebase-project-id> --apply --confirm=${CONFIRMATION}

Options:
  --apply             Remove hidden values from public documents. Omit for dry-run.
  --confirm=...       Required exact confirmation token in apply mode.
  --limit=<number>    Stop after inspecting this many businesses.
  --project=<id>      Firebase project ID; otherwise uses ADC environment variables.
  --help              Show this help.`)
}

function cleanupPlan(business) {
  const contact = business.contact && typeof business.contact === 'object' ? business.contact : {}
  const hidden = [
    contact.phoneVisible !== true && contact.phone && 'contact.phone',
    contact.emailVisible !== true && contact.email && 'contact.email',
    contact.whatsappVisible !== true && contact.whatsappNumber && 'contact.whatsappNumber',
  ].filter((field) => typeof field === 'string')
  const legacy = LEGACY_FIELDS.filter((field) => typeof business[field] === 'string' && business[field].trim())
  return { contact, fields: [...hidden, ...legacy], legacy }
}

function safePublicContact(contact) {
  return {
    phone: contact.phoneVisible === true ? String(contact.phone ?? '').trim() : '', phoneVisible: contact.phoneVisible === true,
    email: contact.emailVisible === true ? String(contact.email ?? '').trim() : '', emailVisible: contact.emailVisible === true,
    whatsappNumber: contact.whatsappVisible === true ? String(contact.whatsappNumber ?? '').trim() : '', whatsappVisible: contact.whatsappVisible === true,
    website: String(contact.website ?? '').trim(),
    preferredContactMethod: ['holalocal', 'phone', 'email', 'whatsapp'].includes(contact.preferredContactMethod) ? contact.preferredContactMethod : 'holalocal',
    allowCallbackRequests: contact.allowCallbackRequests === true,
  }
}

async function run() {
  const options = readArguments(process.argv.slice(2))
  if (options.help) return printHelp()
  if (!options.projectId) throw new Error('Provide --project=<id> or set GOOGLE_CLOUD_PROJECT/GCLOUD_PROJECT.')
  if (getApps().length === 0) initializeApp({ credential: applicationDefault(), projectId: options.projectId })
  const database = getFirestore()
  const mode = options.apply ? 'APPLY' : 'DRY RUN'
  let cursor = null; let inspected = 0; let requiringCleanup = 0; let cleaned = 0; let skipped = 0
  while (inspected < options.limit) {
    const pageSize = Math.min(100, options.limit - inspected)
    let query = database.collection('businesses').orderBy(FieldPath.documentId()).limit(pageSize)
    if (cursor) query = query.startAfter(cursor)
    const page = await query.get()
    if (page.empty) break
    for (const snapshot of page.docs) {
      inspected += 1
      const plan = cleanupPlan(snapshot.data())
      if (plan.fields.length === 0) continue
      requiringCleanup += 1
      const privateSnapshot = await database.collection('businessPrivate').doc(snapshot.id).get()
      if (!privateSnapshot.exists) {
        skipped += 1
        console.warn(`[${mode}] ${snapshot.id}: skipped; private copy missing; fields: ${plan.fields.join(', ')}`)
        continue
      }
      console.log(`[${mode}] ${snapshot.id}: fields requiring cleanup: ${plan.fields.join(', ')}`)
      if (options.apply) {
        const updates = { contact: safePublicContact(plan.contact), updatedAt: FieldValue.serverTimestamp() }
        for (const field of plan.legacy) updates[field] = FieldValue.delete()
        await snapshot.ref.update(updates)
        cleaned += 1
      }
    }
    cursor = page.docs.at(-1)
    if (page.size < pageSize) break
  }
  console.log(`[${mode}] Complete. Inspected: ${inspected}; requiring cleanup: ${requiringCleanup}; cleaned: ${cleaned}; skipped without private copy: ${skipped}.`)
}

run().catch((error) => { console.error(`[public-contact-audit] ${error.message}`); process.exitCode = 1 })
