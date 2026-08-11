import {
  deleteObject,
  connectStorageEmulator,
  getBlob,
  getDownloadURL,
  getStorage,
  ref as storageReference,
  uploadBytes,
} from 'firebase/storage'
import { createApplicationError } from '../utils/frontendErrors.js'
import { getFirebaseApp } from './config.js'
import {
  connectFirebaseEmulatorOnce,
  FIREBASE_EMULATOR_ENDPOINTS,
  shouldUseFirebaseEmulators,
} from './emulatorMode.js'

const storage = getStorage(getFirebaseApp())
if (shouldUseFirebaseEmulators()) {
  const { host, port } = FIREBASE_EMULATOR_ENDPOINTS.storage
  connectFirebaseEmulatorOnce(storage, () => connectStorageEmulator(storage, host, port))
}
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function validateImageFile(file, maxSizeBytes = 5 * 1024 * 1024) {
  if (!file || !allowedImageTypes.has(file.type)) {
    throw createApplicationError('media-invalid-type')
  }
  if (file.size > maxSizeBytes) {
    throw createApplicationError('media-too-large')
  }
}

export async function uploadCanonicalImageFile(storagePath, file) {
  validateImageFile(file)
  if (file.size >= 5 * 1024 * 1024) throw createApplicationError('media-too-large')
  const reference = storageReference(storage, storagePath)
  await uploadBytes(reference, file, { contentType: file.type })
  return { contentType: file.type, size: file.size, storagePath }
}

export async function getStoragePresentationUrl(storagePath) {
  return getDownloadURL(storageReference(storage, storagePath))
}

export async function getPrivateImageBlob(storagePath, maxDownloadSizeBytes = 5 * 1024 * 1024) {
  return getBlob(storageReference(storage, storagePath), maxDownloadSizeBytes)
}

export async function uploadImageFile(directory, file) {
  validateImageFile(file)
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const uniqueId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const storagePath = `${directory}/${uniqueId}.${extension}`
  const reference = storageReference(storage, storagePath)
  const snapshot = await uploadBytes(reference, file, {
    contentType: file.type,
    customMetadata: { originalName: file.name },
  })
  return {
    contentType: file.type,
    downloadUrl: await getDownloadURL(snapshot.ref),
    originalName: file.name,
    size: file.size,
    storagePath,
  }
}

export async function deleteImageFile(storagePath) {
  if (storagePath) await deleteObject(storageReference(storage, storagePath))
}

export { storage }
