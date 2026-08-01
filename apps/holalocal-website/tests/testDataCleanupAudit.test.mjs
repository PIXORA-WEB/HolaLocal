import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { parseCleanupAuditArguments, validateCleanupAuditOptions, validateExecutionEnvironment } from '../scripts/testDataCleanupAudit/config.js'
import { CLASSIFICATIONS, runTestCleanupAudit } from '../scripts/testDataCleanupAudit/core.js'
import { writeCleanupAuditReports } from '../scripts/testDataCleanupAudit/reportWriter.js'

const TARGETS = [
  'TestCleanupUid000000000001',
  'TestCleanupUid000000000002',
  'TestCleanupUid000000000003',
  'TestCleanupUid000000000004',
]
const PROTECTED = ['ProtectedUid0000000000001', 'ProtectedUid0000000000002']

const baseOptions = {
  confirmProject: 'holalocal-491c9',
  emulator: false,
  outputDir: '/tmp/test-cleanup-audit',
  pageSize: 2,
  projectId: 'holalocal-491c9',
  protectedUids: PROTECTED,
  targetUids: TARGETS,
}

function fixtureSource(overrides = {}) {
  const collections = {
    users: [
      { id: TARGETS[0], path: `users/${TARGETS[0]}`, data: { roles: ['business'], businessId: '', accountStatus: 'active' } },
      { id: TARGETS[1], path: `users/${TARGETS[1]}`, data: { roles: ['business'], businessId: 'biz-target-2', accountStatus: 'active' } },
      { id: PROTECTED[0], path: `users/${PROTECTED[0]}`, data: { roles: ['customer'], accountStatus: 'active' } },
      { id: PROTECTED[1], path: `users/${PROTECTED[1]}`, data: { roles: ['business'], businessId: 'biz-protected', accountStatus: 'active' } },
    ],
    businesses: [
      {
        id: 'biz-target-1a',
        path: 'businesses/biz-target-1a',
        data: { ownerId: TARGETS[0], managerIds: [TARGETS[0]], logoURL: 'https://media.invalid/shared-logo.png?token=secret', status: 'draft' },
      },
      {
        id: 'biz-target-1b',
        path: 'businesses/biz-target-1b',
        data: { ownerId: TARGETS[0], managerIds: [TARGETS[0]], galleryImages: [{ path: 'businesses/biz-target-1b/gallery/one.png' }], status: 'draft' },
      },
      {
        id: 'biz-target-2',
        path: 'businesses/biz-target-2',
        data: { ownerId: TARGETS[1], managerIds: [TARGETS[1], 'externalManager000000000001'], coverImageURL: 'https://media.invalid/cover.png', status: 'active' },
      },
      {
        id: 'biz-protected',
        path: 'businesses/biz-protected',
        data: { ownerId: PROTECTED[1], managerIds: [PROTECTED[1]], logoURL: 'https://media.invalid/shared-logo.png?token=secret', status: 'active' },
      },
    ],
    businessPrivate: [
      { id: 'biz-target-1a', path: 'businessPrivate/biz-target-1a', data: { ownerId: TARGETS[0], managerIds: [TARGETS[0]] } },
      { id: 'biz-target-1b', path: 'businessPrivate/biz-target-1b', data: { ownerId: TARGETS[0], managerIds: [TARGETS[0]] } },
      { id: 'biz-target-2', path: 'businessPrivate/biz-target-2', data: { ownerId: TARGETS[1], managerIds: [TARGETS[1], 'externalManager000000000001'] } },
      { id: 'biz-protected', path: 'businessPrivate/biz-protected', data: { ownerId: PROTECTED[1], managerIds: [PROTECTED[1]] } },
    ],
    conversations: [
      { id: 'conv-target', path: 'conversations/conv-target', data: { businessId: 'biz-target-1a', participantIds: [TARGETS[0], TARGETS[1]], customerId: TARGETS[1] } },
      { id: 'conv-mixed', path: 'conversations/conv-mixed', data: { businessId: 'biz-target-2', participantIds: [TARGETS[1], PROTECTED[0]], customerId: PROTECTED[0] } },
    ],
    reports: [
      { id: 'report-target', path: 'reports/report-target', data: { reporterId: TARGETS[0], targetType: 'business', targetId: 'biz-target-1a' } },
    ],
    businessOwners: [
      { id: TARGETS[0], path: `businessOwners/${TARGETS[0]}`, data: { ownerId: TARGETS[0], businessId: 'biz-target-1a' } },
      { id: PROTECTED[1], path: `businessOwners/${PROTECTED[1]}`, data: { ownerId: PROTECTED[1], businessId: 'biz-protected' } },
    ],
    ...overrides.collections,
  }
  return {
    calls: [],
    async getAuthAccount(uid) {
      this.calls.push(['getAuthAccount', uid])
      return { exists: !overrides.missingAuth?.includes(uid), uid, disabled: false, creationTime: '2026-01-01T00:00:00Z', lastSignInTime: '2026-01-02T00:00:00Z' }
    },
    async getDocument() {
      throw new Error('core should not require exact document reads in fixture')
    },
    async listCollection(collectionName, { pageSize, cursor } = {}) {
      this.calls.push(['listCollection', collectionName])
      const docs = [...(collections[collectionName] ?? [])].sort((a, b) => a.id.localeCompare(b.id))
      const start = cursor ? docs.findIndex((doc) => doc.id === cursor) + 1 : 0
      const page = docs.slice(start, start + pageSize)
      return { docs: page, cursor: page.at(-1)?.id ?? null, done: start + pageSize >= docs.length }
    },
  }
}

describe('test cleanup audit configuration', () => {
  test('rejects target and protected overlap', () => {
    assert.throws(() => validateCleanupAuditOptions({ ...baseOptions, protectedUids: [TARGETS[0], PROTECTED[0]] }), /overlap/)
  })

  test('rejects empty or incomplete target list', () => {
    assert.throws(() => validateCleanupAuditOptions({ ...baseOptions, targetUids: [] }), /At least one target UID/)
    assert.throws(() => validateCleanupAuditOptions({ ...baseOptions, targetUids: TARGETS.slice(0, 3) }), /Exactly four/)
  })

  test('rejects project confirmation mismatch and unsafe flags', () => {
    assert.throws(() => validateCleanupAuditOptions({ ...baseOptions, confirmProject: 'other-project' }), /matching/)
    assert.throws(() => parseCleanupAuditArguments(['--project-id', 'holalocal-491c9', '--write']), /read-only/)
  })

  test('validates emulator and credential project environment', async () => {
    await assert.rejects(() => validateExecutionEnvironment({ ...baseOptions, emulator: true }, { env: {} }), /FIRESTORE_EMULATOR_HOST/)
    await assert.rejects(() => validateExecutionEnvironment(baseOptions, { env: { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' } }), /FIRESTORE_EMULATOR_HOST/)
    await assert.rejects(() => validateExecutionEnvironment(baseOptions, { env: {}, resolveCredentialProjects: async () => [{ source: 'test', projectId: 'other-project' }] }), /mismatch/)
    const ok = await validateExecutionEnvironment(baseOptions, { env: {}, resolveCredentialProjects: async () => [{ source: 'test', projectId: 'holalocal-491c9' }] })
    assert.equal(ok.credentialProjectStatus, 'matched')
  })
})

describe('test cleanup audit classification', () => {
  test('detects protected accounts, mixed conversations, shared media and duplicate target businesses', async () => {
    const source = fixtureSource()
    const report = await runTestCleanupAudit(source, baseOptions, () => '2026-07-10T00:00:00.000Z')
    assert.equal(report.metadata.complete, true)
    assert.equal(report.targetSummaries[0].businessCount, 2)
    assert.equal(report.items.conversations.some((item) => item.classification === CLASSIFICATIONS.PROTECTED), true)
    assert.equal(report.items.mediaReferences.some((item) => item.classification === CLASSIFICATIONS.PROTECTED), true)
    assert.equal(report.items.businesses.some((item) => item.classification === CLASSIFICATIONS.MANUAL), true)
    assert.equal(report.protectedSummary.authAccounts, 2)
  })

  test('marks missing user document and missing auth as ambiguous', async () => {
    const source = fixtureSource({
      missingAuth: [TARGETS[3]],
      collections: { users: [] },
    })
    const report = await runTestCleanupAudit(source, baseOptions, () => '2026-07-10T00:00:00.000Z')
    const target4 = report.targetSummaries.find((summary) => summary.label === 'Test Account 4')
    assert.equal(target4.authExists, false)
    assert.equal(target4.userDocumentExists, false)
    assert.equal(report.items.userDocuments.some((item) => item.uid === TARGETS[3] && item.classification === CLASSIFICATIONS.AMBIGUOUS), true)
  })

  test('redacts output and report avoids personal values', async () => {
    const report = await runTestCleanupAudit(fixtureSource(), baseOptions, () => '2026-07-10T00:00:00.000Z')
    const output = JSON.stringify(report)
    assert.equal(output.includes('token=secret'), false)
    assert.equal(output.includes('@'), false)
    assert.equal(output.includes('600000000'), false)
  })
})

describe('test cleanup audit output and source boundary', () => {
  test('refuses to overwrite reports', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cleanup-audit-'))
    const report = await runTestCleanupAudit(fixtureSource(), baseOptions, () => '2026-07-10T00:00:00.000Z')
    await writeCleanupAuditReports(report, dir)
    await assert.rejects(() => writeCleanupAuditReports(report, dir), /overwrite/)
  })

  test('source does not expose known Firebase or Auth mutation APIs', async () => {
    const files = [
      '../scripts/testDataCleanupAudit/adminSource.js',
      '../scripts/testDataCleanupAudit/cli.js',
      '../scripts/testDataCleanupAudit/core.js',
      '../scripts/testDataCleanupAudit/config.js',
    ]
    const forbiddenEverywhere = /\b(createUser|deleteUser|writeBatch|runTransaction|FieldValue|uploadBytes|deleteObject|getSignedUrl|bucket\.getFiles)\b/
    for (const file of files) {
      const source = await readFile(new URL(file, import.meta.url), 'utf8')
      assert.doesNotMatch(source, forbiddenEverywhere, file)
    }
    const adapterSource = await readFile(new URL('../scripts/testDataCleanupAudit/adminSource.js', import.meta.url), 'utf8')
    assert.doesNotMatch(adapterSource, /\.set\(|\.update\(/)
  })

  test('report files contain no copied credentials or contact values', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cleanup-audit-'))
    const report = await runTestCleanupAudit(fixtureSource(), baseOptions, () => '2026-07-10T00:00:00.000Z')
    await writeCleanupAuditReports(report, dir)
    await writeFile(join(dir, 'probe.txt'), 'probe')
    const text = await readFile(join(dir, 'test-cleanup-dry-run-report.json'), 'utf8')
    assert.equal(/private_key|client_email|access_token|token=secret|600000000/i.test(text), false)
  })
})
