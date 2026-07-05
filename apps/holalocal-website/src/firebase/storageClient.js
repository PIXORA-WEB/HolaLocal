import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref as storageReference,
  uploadBytes,
} from 'firebase/storage'
import { getFirebaseApp } from './config.js'

const storage = getStorage(getFirebaseApp())
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function validateImageFile(file, maxSizeBytes = 5 * 1024 * 1024) {
  if (!file || !allowedImageTypes.has(file.type)) throw new Error('Choose a JPG, PNG, or WebP image.')
  if (file.size > maxSizeBytes) {
    throw new Error(`Image must be smaller than ${Math.round(maxSizeBytes / 1024 / 1024)} MB.`)
  }
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
