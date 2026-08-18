import { getStorage } from 'firebase-admin/storage'
import { HttpsError } from 'firebase-functions/v2/https'

export const CANONICAL_MEDIA_MAX_BYTES = 5 * 1024 * 1024
export const CANONICAL_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const TOKEN_KEY = 'firebaseStorageDownloadTokens'
const SESSION_KEY = 'holalocalUploadSession'
const PROMOTION_CONTEXT_KEY = 'holalocal-media-request'

function exactInteger(value, label) {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^[1-9][0-9]*$/.test(String(value))) {
    throw new HttpsError('invalid-argument', label)
  }
  return String(value)
}

function customMetadata(metadata) {
  const value = metadata?.metadata
  if (value == null) return {}
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpsError('failed-precondition', 'media-forbidden-metadata')
  }
  return value
}

export function uploadSessionMarker(metadata) {
  const marker = customMetadata(metadata)[SESSION_KEY]
  return typeof marker === 'string' ? marker : null
}

export function verifyCanonicalImageMetadata(metadata, {
  path, generation, requireTokenFree = false, allowUploadSession = false,
}) {
  if (!metadata || metadata.name !== path || String(metadata.generation) !== String(generation)) {
    throw new HttpsError('failed-precondition', 'media-generation-mismatch')
  }
  if (!CANONICAL_MEDIA_TYPES.has(metadata.contentType)) {
    throw new HttpsError('failed-precondition', 'media-invalid-content-type')
  }
  const size = Number(metadata.size)
  if (!Number.isInteger(size) || size < 0 || size >= CANONICAL_MEDIA_MAX_BYTES) {
    throw new HttpsError('failed-precondition', 'media-invalid-size')
  }
  const keys = Object.keys(customMetadata(metadata))
  const allowed = new Set([TOKEN_KEY, ...(allowUploadSession ? [SESSION_KEY] : [])])
  if (keys.some((key) => !allowed.has(key))
    || (requireTokenFree && keys.some((key) => key === TOKEN_KEY))
    || (!allowUploadSession && requireTokenFree && keys.length !== 0)) {
    throw new HttpsError('failed-precondition', 'media-forbidden-metadata')
  }
  return metadata
}

function promotionContext(metadata) {
  return metadata?.contexts?.custom?.[PROMOTION_CONTEXT_KEY]?.value ?? null
}

function defaultBucket() {
  return getStorage().bucket()
}

async function readExact(bucket, path, generation) {
  const [metadata] = await bucket.file(path, { generation }).getMetadata()
  return metadata
}

export async function cleanStagingGeneration({
  path, generation, bucket = defaultBucket(), readMetadata = readExact,
}) {
  const expectedGeneration = exactInteger(generation, 'invalid-media-generation')
  const before = verifyCanonicalImageMetadata(
    await readMetadata(bucket, path, expectedGeneration),
    { path, generation: expectedGeneration, allowUploadSession: true },
  )
  const metadata = customMetadata(before)
  if (Object.hasOwn(metadata, TOKEN_KEY)) {
    const cleaned = Object.fromEntries(Object.entries(metadata).filter(([key]) => key !== TOKEN_KEY))
    try {
      await bucket.file(path, {
        generation: expectedGeneration,
        preconditionOpts: {
          ifGenerationMatch: expectedGeneration,
          ifMetagenerationMatch: String(before.metageneration),
        },
      }).setMetadata({ metadata: { ...cleaned, [TOKEN_KEY]: null } })
    } catch (error) {
      if (Number(error?.code) !== 412) throw error

      verifyCanonicalImageMetadata(
        await readMetadata(bucket, path, expectedGeneration),
        {
          path,
          generation: expectedGeneration,
          requireTokenFree: true,
          allowUploadSession: true,
        },
      )
    }
  }
  const after = verifyCanonicalImageMetadata(
    await readMetadata(bucket, path, expectedGeneration),
    { path, generation: expectedGeneration, requireTokenFree: true, allowUploadSession: true },
  )
  if (Number(after.metageneration) < Number(before.metageneration)) {
    throw new HttpsError('failed-precondition', 'media-metageneration-regressed')
  }
  return after
}

function rawRewrite(sourceFile, destinationFile, query, body) {
  return new Promise((resolve, reject) => {
    sourceFile.request({
      method: 'POST',
      uri: `/rewriteTo/b/${destinationFile.bucket.name}/o/${encodeURIComponent(destinationFile.name)}`,
      qs: query,
      json: body,
    }, (error, response) => error ? reject(error) : resolve(response))
  })
}

export async function promoteCleanGeneration({
  stagingPath,
  stagingGeneration,
  stagingMetageneration,
  canonicalPath,
  expectedCanonicalGeneration,
  bucket = defaultBucket(),
  rewrite = rawRewrite,
  readMetadata = readExact,
  promotionId,
}) {
  const sourceGeneration = exactInteger(stagingGeneration, 'invalid-media-generation')
  const sourceMetageneration = exactInteger(stagingMetageneration, 'invalid-media-metageneration')
  const destinationGeneration = expectedCanonicalGeneration === 0 || expectedCanonicalGeneration === '0'
    ? '0' : exactInteger(expectedCanonicalGeneration, 'invalid-canonical-generation')
  const source = verifyCanonicalImageMetadata(
    await readMetadata(bucket, stagingPath, sourceGeneration),
    { path: stagingPath, generation: sourceGeneration, requireTokenFree: true, allowUploadSession: true },
  )
  if (String(source.metageneration) !== sourceMetageneration) {
    throw new HttpsError('failed-precondition', 'media-metageneration-mismatch')
  }
  if (typeof promotionId !== 'string' || !/^[A-Za-z0-9-]{16,80}$/.test(promotionId)) {
    throw new HttpsError('invalid-argument', 'invalid-media-promotion-id')
  }
  let response
  try {
    response = await rewrite(
      bucket.file(stagingPath, { generation: sourceGeneration }),
      bucket.file(canonicalPath),
      {
        sourceGeneration,
        ifSourceGenerationMatch: sourceGeneration,
        ifSourceMetagenerationMatch: sourceMetageneration,
        ifGenerationMatch: destinationGeneration,
      },
      {
        contentType: source.contentType,
        metadata: {},
        contexts: { custom: { [PROMOTION_CONTEXT_KEY]: { value: promotionId } } },
      },
    )
  } catch (error) {
    if (Number(error?.code) !== 412) throw error
    const [candidate] = await bucket.file(canonicalPath).getMetadata()
    verifyCanonicalImageMetadata(candidate, {
      path: canonicalPath, generation: candidate.generation, requireTokenFree: true,
    })
    if (promotionContext(candidate) !== promotionId) throw error
    return { generation: String(candidate.generation), metadata: candidate, recovered: true }
  }
  if (response?.done === false) {
    throw new HttpsError('internal', 'media-rewrite-incomplete')
  }
  const promotedGeneration = String(response?.resource?.generation ?? '')
  if (!/^[1-9][0-9]*$/.test(promotedGeneration)) {
    throw new HttpsError('internal', 'media-promotion-result-invalid')
  }
  const destination = verifyCanonicalImageMetadata(
    await readMetadata(bucket, canonicalPath, promotedGeneration),
    { path: canonicalPath, generation: promotedGeneration, requireTokenFree: true },
  )
  if (promotionContext(destination) !== promotionId) {
    throw new HttpsError('internal', 'media-promotion-context-missing')
  }
  return { generation: promotedGeneration, metadata: destination }
}

export async function clearPromotionContext({ path, generation, bucket = defaultBucket(), readMetadata = readExact }) {
  const expectedGeneration = exactInteger(generation, 'invalid-media-generation')
  const before = verifyCanonicalImageMetadata(
    await readMetadata(bucket, path, expectedGeneration),
    { path, generation: expectedGeneration, requireTokenFree: true },
  )
  if (!promotionContext(before)) return before
  await bucket.file(path, {
    generation: expectedGeneration,
    preconditionOpts: {
      ifGenerationMatch: expectedGeneration,
      ifMetagenerationMatch: String(before.metageneration),
    },
  }).setMetadata({ contexts: { custom: null } })
  const after = verifyCanonicalImageMetadata(
    await readMetadata(bucket, path, expectedGeneration),
    { path, generation: expectedGeneration, requireTokenFree: true },
  )
  if (promotionContext(after)) throw new HttpsError('failed-precondition', 'media-promotion-context-remains')
  return after
}

export async function deleteExactGeneration({ path, generation, bucket = defaultBucket() }) {
  const expectedGeneration = exactInteger(generation, 'invalid-media-generation')
  await bucket.file(path, {
    generation: expectedGeneration,
    preconditionOpts: { ifGenerationMatch: expectedGeneration },
  }).delete({ ignoreNotFound: true })
}

export async function exactGenerationExists({ path, generation, bucket = defaultBucket() }) {
  const expectedGeneration = exactInteger(generation, 'invalid-media-generation')
  try {
    const metadata = await readExact(bucket, path, expectedGeneration)
    if (metadata?.name !== path || String(metadata?.generation) !== expectedGeneration) {
      throw new HttpsError('failed-precondition', 'media-generation-mismatch')
    }
    return true
  } catch (error) {
    if (Number(error?.code) === 404) return false
    throw error
  }
}

export const CANONICAL_MEDIA_TOKEN_KEY = TOKEN_KEY
export const CANONICAL_MEDIA_UPLOAD_SESSION_KEY = SESSION_KEY
export const CANONICAL_MEDIA_PROMOTION_CONTEXT_KEY = PROMOTION_CONTEXT_KEY
