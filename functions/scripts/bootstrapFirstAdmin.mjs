import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const TARGET_EMAIL = 'hello@holalocal.es'

function parseArguments(argv) {
  const result = { apply: false, expectedUid: '', projectId: '' }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--apply') result.apply = true
    else if (argument === '--project-id') result.projectId = argv[++index] ?? ''
    else if (argument === '--expected-uid') result.expectedUid = argv[++index] ?? ''
    else throw new Error(`Unknown argument: ${argument}`)
  }
  return result
}

export async function bootstrapFirstAdmin({
  apply = false,
  expectedUid = '',
  projectId,
  auth = null,
} = {}) {
  if (!projectId?.trim()) throw new Error('An explicit --project-id is required.')
  const authClient = auth ?? getAuth(getApps()[0] ?? initializeApp({
    credential: applicationDefault(),
    projectId: projectId.trim(),
  }))
  let user
  try {
    user = await authClient.getUserByEmail(TARGET_EMAIL)
  } catch (error) {
    if (error?.code === 'auth/user-not-found') {
      throw new Error(`${TARGET_EMAIL} does not exist; aborting.`, { cause: error })
    }
    throw error
  }
  if (user.email !== TARGET_EMAIL) throw new Error('Authentication returned a different email; aborting.')
  if (user.emailVerified !== true) throw new Error(`${TARGET_EMAIL} is not verified; aborting.`)
  const existingClaims = user.customClaims ?? {}
  console.log(JSON.stringify({ uid: user.uid, email: user.email, existingClaims }, null, 2))
  if (!apply) return { applied: false, dryRun: true, uid: user.uid, claims: existingClaims }
  if (!expectedUid || expectedUid !== user.uid) throw new Error('--expected-uid must exactly match the displayed UID.')
  if (existingClaims.admin === true) {
    return { applied: false, alreadyConfigured: true, uid: user.uid, claims: existingClaims }
  }
  await authClient.setCustomUserClaims(user.uid, { ...existingClaims, admin: true })
  const confirmed = await authClient.getUser(user.uid)
  if (confirmed.customClaims?.admin !== true) throw new Error('Admin claim confirmation failed.')
  return { applied: true, uid: user.uid, claims: confirmed.customClaims }
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  const result = await bootstrapFirstAdmin(options)
  console.log(JSON.stringify(result, null, 2))
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
