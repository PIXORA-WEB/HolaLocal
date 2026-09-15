import { FakeFirestore } from './fakeFirestore.mjs'
import { MEDIA_CUTOVER_CONTROL } from '../src/mediaCutoverControls.js'
export function openCutoverControl() {
  return { schemaVersion: 1, version: 1, updatedAt: new Date(0), provenance: 'synthetic-local-test',
    profileAdmission: true, profileSettlement: true, accountDeletion: true, stagingProcessing: true }
}
// Explicitly opt existing behavior suites into open controls. Production and the
// base FakeFirestore remain default-closed; dedicated tests exercise that default.
export class OpenMediaFirestore extends FakeFirestore {
  constructor(seed = {}) { super({ [MEDIA_CUTOVER_CONTROL]: openCutoverControl(), ...seed }) }
}
