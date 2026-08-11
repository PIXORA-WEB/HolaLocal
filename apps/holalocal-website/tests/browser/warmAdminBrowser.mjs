import {
  TEST_BUSINESS_ID,
  TEST_PASSWORD,
  TEST_PROJECT_ID,
  TEST_USERS,
} from './fixtures.js'

const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST
const functionsOrigin = `http://127.0.0.1:5001/${TEST_PROJECT_ID}/europe-west1`
const apiKey = process.env.VITE_FIREBASE_API_KEY
const attempts = 3
const requestTimeoutMs = 45_000

if (!authHost || !apiKey || process.env.GCLOUD_PROJECT !== TEST_PROJECT_ID) {
  throw new Error('Admin browser warm-up requires the isolated Firebase emulator environment.')
}

async function retryReadiness(label, operation) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 250))
      }
    }
  }
  throw new Error(`Emulator readiness failed for ${label} after ${attempts} attempts.`, {
    cause: lastError,
  })
}

async function signIn(user) {
  const response = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: TEST_PASSWORD, returnSecureToken: true }),
      signal: AbortSignal.timeout(requestTimeoutMs),
    },
  )
  const result = await response.json()
  if (!response.ok || typeof result.idToken !== 'string') {
    throw new Error(`Auth emulator rejected warm-up identity ${user.uid}.`)
  }
  return result.idToken
}

async function callReadOnly(name, token, data) {
  const response = await fetch(`${functionsOrigin}/${name}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ data }),
    signal: AbortSignal.timeout(requestTimeoutMs),
  })
  const result = await response.json()
  if (!response.ok || result.error) {
    throw new Error(`Callable emulator readiness failed for ${name}.`)
  }
  return result.result
}

const adminToken = await retryReadiness('admin authentication', () => signIn(TEST_USERS.admin))
const ownerToken = await retryReadiness('owner authentication', () => signIn(TEST_USERS.owner))

// Keep these sequential: the purpose is to initialize the exact read-only workers
// used during page startup without creating a cold-worker concurrency storm.
for (const [name, token, data] of [
  ['getAdminBusinessReview', adminToken, { businessId: TEST_BUSINESS_ID }],
  ['listPublicBusinesses', adminToken, { maxResults: 60 }],
  ['getOwnerSubscriptionStatus', ownerToken, { businessId: TEST_BUSINESS_ID }],
  ['getOwnerBusinessInsights', ownerToken, { businessId: TEST_BUSINESS_ID }],
]) {
  await retryReadiness(name, () => callReadOnly(name, token, data))
}

console.log('Verified admin browser Auth and read-only callable emulator readiness.')
