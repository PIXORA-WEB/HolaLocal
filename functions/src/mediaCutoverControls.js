import { HttpsError } from 'firebase-functions/v2/https'

export const MEDIA_CUTOVER_CONTROL = 'mediaCutoverControls/current'
export const MEDIA_CUTOVER_HOLDS = 'mediaCutoverHolds'
const scopes = ['profileAdmission', 'profileSettlement', 'accountDeletion', 'stagingProcessing']
const stamp = value => Number.isFinite(value?.toMillis?.() ?? (value instanceof Date ? value.getTime() : NaN))
const provenance = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 500

// No cached open decision. Call inside the transaction which admits or completes
// work. A control update cannot undo an already-dispatched external operation.
export async function assertMediaCutover(transaction, db, scope, uid = null) {
  if (!scopes.includes(scope)) throw new HttpsError('failed-precondition', 'media-cutover-closed')
  const control = (await transaction.get(db.doc(MEDIA_CUTOVER_CONTROL))).data()
  if (control?.schemaVersion !== 1 || !Number.isSafeInteger(control.version) || control.version < 1
    || !stamp(control.updatedAt) || !provenance(control.provenance)
    || !scopes.every(key => typeof control[key] === 'boolean') || control[scope] !== true) {
    throw new HttpsError('failed-precondition', 'media-cutover-closed')
  }
  if (uid != null) {
    if (typeof uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new HttpsError('failed-precondition', 'media-cutover-held')
    const snapshot = await transaction.get(db.doc(`${MEDIA_CUTOVER_HOLDS}/${uid}`))
    if (snapshot.exists) {
      const hold = snapshot.data()
      // A release is reserved for a future authorized evidence workflow. No
      // endpoint here creates/releases/deletes holds. Malformed releases block.
      if (hold?.schemaVersion !== 1 || hold.uid !== uid || hold.state !== 'released'
        || !Number.isSafeInteger(hold.version) || hold.version < 2
        || !provenance(hold.reason) || !provenance(hold.provenance)
        || !provenance(hold.releaseEvidence) || !stamp(hold.createdAt)
        || !stamp(hold.updatedAt) || !stamp(hold.releasedAt)) {
        throw new HttpsError('failed-precondition', 'media-cutover-held')
      }
    }
  }
}

export async function checkMediaCutover({ db, scope, uid = null }) {
  if (!db) throw new HttpsError('failed-precondition', 'media-cutover-closed')
  return db.runTransaction(transaction => assertMediaCutover(transaction, db, scope, uid))
}
