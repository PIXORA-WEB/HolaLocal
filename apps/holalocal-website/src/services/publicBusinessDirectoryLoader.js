import { withTimeout } from '../utils/withTimeout.js'

export const PUBLIC_DIRECTORY_CALLABLE_TIMEOUT_MS = 12_000
export const PUBLIC_DIRECTORY_TIMEOUT_CODE = 'public-directory-timeout'

export async function loadPublicBusinessDirectory({
  callPublicBusinesses,
  fallbackBusiness,
  maxResults,
  presentBusiness,
  timeoutMs = PUBLIC_DIRECTORY_CALLABLE_TIMEOUT_MS,
}) {
  const result = await withTimeout(
    () => callPublicBusinesses({ maxResults }),
    timeoutMs,
    { timeoutCode: PUBLIC_DIRECTORY_TIMEOUT_CODE },
  )
  const businesses = Array.isArray(result?.data?.businesses)
    ? result.data.businesses.filter((business) => business?.businessId && business?.name)
    : []

  return Promise.all(businesses.map(async (business) => {
    try {
      return await presentBusiness(business)
    } catch {
      return fallbackBusiness(business)
    }
  }))
}
