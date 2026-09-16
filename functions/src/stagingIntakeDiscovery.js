import { createHash } from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { parseStagingMediaPath } from '@holalocal/firebase-contract'
import { stagingEventIdentity, DEFERRED_STAGING_EVENTS } from './stagingMediaDeferral.js'
import { MEDIA_SESSION_COLLECTION, profileSessionId, businessSessionId, hasUnsettledProfilePromotion } from './mediaUploadSessions.js'
import { MEDIA_CUTOVER_HOLDS } from './mediaCutoverControls.js'

export const STAGING_DISCOVERY_COLLECTION = 'mediaStagingDiscoveryCandidates'
export const DISCOVERY_HISTORY_LIMIT = 4
export const DISCOVERY_PAGE_SIZE = 25
export const DISCOVERY_PROTOCOL = 'staging-live-inventory-v1'
const INTAKE_STATES = Object.freeze(['absent', 'unknown-or-conflicting', 'pending',
  'completed-settled', 'completed-transferred', 'completed-protected', 'completed-unclassified'])
const markerPattern = /^[A-Za-z0-9-]{16,80}$/
const uidPattern = /^[A-Za-z0-9_-]{1,128}$/
const tokenValid = token => token === null || (typeof token === 'string' && token.length > 0 && token.length <= 4096)
const fail = reason => { throw new Error(reason) }

function validateScope(scope, inventory) {
  if (!scope || scope.schemaVersion !== 1 || scope.mode !== 'observe-only'
    || typeof scope.bucket !== 'string' || !/^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/.test(scope.bucket)
    || !['users/', 'businesses/'].includes(scope.prefix)
    || inventory?.protocol !== DISCOVERY_PROTOCOL || typeof inventory.listPage !== 'function') {
    fail('discovery-scope-invalid')
  }
}
export function discoveryProgressPath(scope) {
  const id = createHash('sha256').update(JSON.stringify([scope.bucket, scope.prefix, DISCOVERY_PROTOCOL])).digest('hex')
  return `maintenanceProgress/stagingDiscovery_${id}`
}
function validateProgress(row, scope) {
  if (row && (row.schemaVersion !== 1 || row.bucket !== scope.bucket || row.prefix !== scope.prefix
    || row.protocol !== DISCOVERY_PROTOCOL || !Number.isSafeInteger(row.revision) || row.revision < 1
    || !Number.isSafeInteger(row.cycle) || row.cycle < 1 || !tokenValid(row.pageToken))) fail('discovery-progress-invalid')
}
function validatePage(page, scope, token) {
  if (!page || page.protocol !== DISCOVERY_PROTOCOL || page.bucket !== scope.bucket
    || page.prefix !== scope.prefix || page.inventoryMode !== 'live-only'
    || !Array.isArray(page.items) || page.items.length > DISCOVERY_PAGE_SIZE
    || !tokenValid(page.nextPageToken) || (page.nextPageToken !== null && page.nextPageToken === token)) {
    fail('discovery-inventory-unsupported')
  }
  const identities = new Set(), names = new Set()
  return page.items.map(item => {
    if (!item || item.bucket !== scope.bucket || typeof item.name !== 'string'
      || item.name.length > 1024 || !item.name.startsWith(scope.prefix)
      || typeof item.generation !== 'string' || !/^[1-9][0-9]*$/.test(item.generation)
      || item.generation.length > 30 || (item.metadata != null
        && (typeof item.metadata !== 'object' || Array.isArray(item.metadata)))) fail('discovery-object-invalid')
    const id = stagingEventIdentity(item)
    if (identities.has(id) || names.has(item.name)) fail('discovery-inventory-duplicate')
    identities.add(id); names.add(item.name)
    const value = item.metadata?.holalocalUploadSession
    const markerStatus = value == null ? 'missing' : typeof value === 'string' && markerPattern.test(value) ? 'valid' : 'invalid'
    return { id, object: { bucket: item.bucket, name: item.name, generation: item.generation },
      marker: markerStatus === 'valid' ? value : null, markerStatus, parsed: parseStagingMediaPath(item.name) }
  })
}
function intakeSummary(row, object, marker) {
  if (!row) return 'absent'
  if (row.schemaVersion !== 1 || row.object?.bucket !== object.bucket || row.object?.name !== object.name
    || String(row.object?.generation) !== object.generation
    || (row.object?.metadata?.holalocalUploadSession ?? null) !== marker) return 'unknown-or-conflicting'
  if (row.state === 'pending') return 'pending'
  if (row.state !== 'completed') return 'unknown-or-conflicting'
  const disposition = row.evidence?.schemaVersion === 1 ? row.evidence.disposition : null
  return ['settled', 'transferred', 'protected', 'unclassified'].includes(disposition)
    ? `completed-${disposition}` : 'completed-unclassified'
}

function bindingKey(value) {
  if (!value || typeof value.sessionId !== 'string' || value.sessionId.length > 1024
    || !markerPattern.test(value.requestId ?? '') || !uidPattern.test(value.principalUid ?? '')
    || !Number.isSafeInteger(value.sessionVersion) || value.sessionVersion < 1
    || !/^[1-9][0-9]{0,29}$/.test(value.stagingGeneration ?? '')
    || (value.destination != null && (typeof value.destination.path !== 'string'
      || value.destination.path.length > 1024 || !/^[1-9][0-9]{0,29}$/.test(value.destination.generation)))) {
    fail('discovery-history-incompatible')
  }
  return JSON.stringify([value.sessionId, value.requestId, value.sessionVersion,
    value.principalUid, value.stagingGeneration, value.destination?.path ?? null,
    value.destination?.generation ?? null])
}

// Bounded historical observations, never current authority or settlement evidence.
// Entries are first-seen exact bindings; saturation preserves them and latches overflow.
function preserveEvidence(prior, observation) {
  const old = prior?.history
  if (prior?.schemaVersion === 1 && old != null) fail('discovery-history-incompatible')
  if (prior?.schemaVersion === 2 && (!old || old.schemaVersion !== 1
    || !Array.isArray(old.bindings) || old.bindings.length > DISCOVERY_HISTORY_LIMIT
    || ['overflow', 'conflict', 'priorHistoryUnknown', 'protectionObserved', 'cleanupObserved',
      'holdObserved', 'nullableBucketObserved'].some(key => typeof old[key] !== 'boolean')
    || !Array.isArray(old.intakeStates) || old.intakeStates.length > INTAKE_STATES.length
    || old.intakeStates.some(state => !INTAKE_STATES.includes(state))
    || new Set(old.intakeStates).size !== old.intakeStates.length)) fail('discovery-history-incompatible')
  if (old) for (const entry of old.bindings) {
    bindingKey(entry.dependency)
    if (typeof entry.protectionObserved !== 'boolean' || typeof entry.cleanupObserved !== 'boolean') fail('discovery-history-incompatible')
  }
  const history = old ? { ...old, bindings: old.bindings.map(entry => ({ ...entry })), intakeStates: [...old.intakeStates] } : {
    schemaVersion: 1, bindings: [], intakeStates: [], overflow: false, conflict: false,
    priorHistoryUnknown: !!prior, protectionObserved: false, cleanupObserved: false,
    holdObserved: false, nullableBucketObserved: false,
  }
  // Upgrade only the surviving latest observation; erased legacy history is unknowable.
  for (const value of [!old && prior?.observation, observation].filter(Boolean)) {
    history.protectionObserved ||= value.promotion === 'protected'
    history.cleanupObserved ||= value.cleanup === 'pending-observed'
    history.holdObserved ||= value.hold === 'record-present'
    history.nullableBucketObserved ||= value.nullableIntake === 'present-unresolved-bucket'
    if (!INTAKE_STATES.includes(value.exactIntake)) fail('discovery-history-incompatible')
    if (!history.intakeStates.includes(value.exactIntake)) history.intakeStates.push(value.exactIntake)
    history.conflict ||= value.markerChanged === true
      || ['marker-mismatch', 'generation-or-path-mismatch', 'session-ambiguous'].includes(value.binding)
    if (value.dependency) {
      const key = bindingKey(value.dependency)
      const existing = history.bindings.find(entry => bindingKey(entry.dependency) === key)
      if (existing) {
        existing.protectionObserved ||= value.promotion === 'protected'
        existing.cleanupObserved ||= value.cleanup === 'pending-observed'
      } else {
        history.conflict ||= history.bindings.length > 0
        if (history.bindings.length < DISCOVERY_HISTORY_LIMIT) history.bindings.push({ dependency: value.dependency,
          protectionObserved: value.promotion === 'protected', cleanupObserved: value.cleanup === 'pending-observed' })
        else { history.overflow = true; history.conflict = true }
      }
    } else if (history.bindings.length) history.conflict = true
  }
  return history
}

// No default database, bucket, credentials, mutation adapter, export or scheduler.
// listPage supplies exact-generation metadata in an explicit bounded page envelope.
// This protocol is an adapter contract, not proof of provider inventory completeness.
export async function discoverStagingIntakePage({ db, scope, inventory }) {
  validateScope(scope, inventory)
  if (!db?.runTransaction || !db?.doc) fail('discovery-database-required')
  const progressRef = db.doc(discoveryProgressPath(scope))
  const observed = (await progressRef.get()).data()
  validateProgress(observed, scope)
  const token = observed?.pageToken ?? null
  const requestStartedAt = new Date()
  let page
  try { page = await inventory.listPage({ bucket: scope.bucket, prefix: scope.prefix,
    pageToken: token, maxResults: DISCOVERY_PAGE_SIZE, inventoryMode: 'live-only' }) }
  catch { fail('discovery-inventory-unavailable') }
  const receivedAt = new Date()
  const items = validatePage(page, scope, token)
  return db.runTransaction(async transaction => {
    const current = (await transaction.get(progressRef)).data()
    validateProgress(current, scope)
    if ((current?.revision ?? 0) !== (observed?.revision ?? 0)) return { status: 'stale', recorded: 0 }
    const writes = []
    let skipped = 0
    for (const item of items) {
      if (!item.parsed) { skipped++; continue }
      const ref = db.doc(`${STAGING_DISCOVERY_COLLECTION}/${item.id}`)
      const prior = (await transaction.get(ref)).data()
      if (prior && (![1, 2].includes(prior.schemaVersion) || prior.state !== 'observation-only'
        || !Number.isSafeInteger(prior.version) || prior.version < 1
        || prior.object?.bucket !== item.object.bucket || prior.object?.name !== item.object.name
        || prior.object?.generation !== item.object.generation)) fail('discovery-candidate-incompatible')
      const exact = (await transaction.get(db.doc(`${DEFERRED_STAGING_EVENTS}/${item.id}`))).data()
      // A null bucket was historically resolved by a default runtime bucket. We
      // have no proof which one; observe it separately, never merge identities.
      const nullableId = stagingEventIdentity({ ...item.object, bucket: null })
      const nullable = (await transaction.get(db.doc(`${DEFERRED_STAGING_EVENTS}/${nullableId}`))).exists
      const sessionId = item.parsed.kind === 'profile' ? profileSessionId(item.parsed.uid)
        : businessSessionId(item.parsed.businessId, item.parsed.kind, item.parsed.slot ?? null)
      const session = (await transaction.get(db.doc(`${MEDIA_SESSION_COLLECTION}/${sessionId}`))).data()
      let binding = !session ? 'session-absent' : item.markerStatus !== 'valid' ? 'marker-unavailable'
        : session.requestId !== item.marker ? 'marker-mismatch'
          : session.stagingPath !== item.object.name || String(session.stagingGeneration) !== item.object.generation ? 'generation-or-path-mismatch'
            : !Number.isSafeInteger(session.version) || session.version < 1
              || !uidPattern.test(session.principalUid ?? '') || session.kind !== item.parsed.kind
              || (item.parsed.kind === 'profile' && session.principalUid !== item.parsed.uid)
              || (item.parsed.kind !== 'profile' && session.businessId !== item.parsed.businessId)
              || (item.parsed.kind === 'gallery' && session.slot !== item.parsed.slot)
              ? 'session-ambiguous' : 'verified'
      const markerChanged = prior?.observation?.markerChanged === true || !!prior && (prior.marker !== item.marker || prior.markerStatus !== item.markerStatus)
      if (markerChanged) binding = 'marker-changed'
      const principal = item.parsed.kind === 'profile' ? item.parsed.uid : binding === 'verified' ? session.principalUid : null
      const held = principal ? (await transaction.get(db.doc(`${MEDIA_CUTOVER_HOLDS}/${principal}`))).exists : null
      const observation = {
        binding, markerChanged, exactIntake: intakeSummary(exact, item.object, item.marker),
        nullableIntake: nullable ? 'present-unresolved-bucket' : 'absent',
        hold: held === null ? 'unknown' : held ? 'record-present' : 'no-record-observed',
        promotion: hasUnsettledProfilePromotion(session) ? 'protected' : 'not-established',
        cleanup: session?.cleanupPending === true ? 'pending-observed' : 'not-established',
        // Only a proven binding supplies an attributed principal/incarnation.
        dependency: binding === 'verified' ? { sessionId, requestId: session.requestId,
          sessionVersion: session.version, principalUid: session.principalUid,
          stagingGeneration: item.object.generation,
          // Optional checkpoint identity, observed only; never inferred from a latest object.
          destination: typeof session.canonicalPath === 'string' && session.canonicalPath.length <= 1024
            && /^[1-9][0-9]{0,29}$/.test(String(session.promotedGeneration))
            ? { path: session.canonicalPath, generation: String(session.promotedGeneration) } : null } : null,
        scanRevision: (observed?.revision ?? 0) + 1,
        requestStartedAt, receivedAt, recordedAt: FieldValue.serverTimestamp(),
      }
      const history = preserveEvidence(prior, observation)
      writes.push({ ref, row: { schemaVersion: 2, version: (prior?.version ?? 0) + 1,
        state: 'observation-only', executable: false, object: item.object,
        marker: prior ? prior.marker : item.marker, markerStatus: prior ? prior.markerStatus : item.markerStatus,
        provenance: 'explicit-local-inventory-core', firstObservedAt: prior?.firstObservedAt ?? FieldValue.serverTimestamp(),
        observation, history } })
    }
    // No writes occur before all dependency reads. Candidates and checkpoint are
    // atomic: a failed commit cannot skip any page item. Duplicate pages are safe.
    for (const {ref,row} of writes) transaction.set(ref, row)
    const end = page.nextPageToken === null
    transaction.set(progressRef, { schemaVersion: 1, bucket: scope.bucket, prefix: scope.prefix,
      protocol: DISCOVERY_PROTOCOL, revision: (observed?.revision ?? 0) + 1,
      cycle: (observed?.cycle ?? 1) + (end ? 1 : 0), pageToken: page.nextPageToken,
      cycleStartedAt: observed?.pageToken ? observed.cycleStartedAt : requestStartedAt,
      page: { requestStartedAt, receivedAt, recordedAt: FieldValue.serverTimestamp(),
        observed: items.length, recorded: writes.length, skippedUnrecognized: skipped, endObserved: end },
    })
    return { status: 'recorded', recorded: writes.length, skipped, endObserved: end }
  })
}
