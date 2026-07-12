import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { parseExecutionArguments, validateExecutionOptions } from '../scripts/testDataCleanupExecution/config.js'
import { buildAllowlist, runCleanupExecution, verifyApprovedDryRunReport } from '../scripts/testDataCleanupExecution/core.js'
import { writeExecutionReports } from '../scripts/testDataCleanupExecution/reportWriter.js'
import { CLASSIFICATIONS, runTestCleanupAudit } from '../scripts/testDataCleanupAudit/core.js'

const TARGETS = [
  'TestCleanupUid000000000001',
  'TestCleanupUid000000000002',
  'TestCleanupUid000000000003',
  'TestCleanupUid000000000004',
]
const PROTECTED = ['ProtectedUid0000000000001', 'ProtectedUid0000000000002']

const options = {
  approvedReportPath: '/tmp/approved.json',
  confirmProject: 'holalocal-491c9',
  confirmationPhrase: '',
  emulator: false,
  outputDir: '/tmp/execution',
  pageSize: 100,
  projectId: 'holalocal-491c9',
  protectedUids: PROTECTED,
  targetUids: TARGETS,
}

function sourceFixture({ failPath = '', protectedDrift = false } = {}) {
  const deleteLog = []
  const collections = {
    users: [
      ...TARGETS.map((uid) => ({ id: uid, path: `users/${uid}`, data: { roles: ['customer'], accountStatus: 'active' } })),
      ...PROTECTED.map((uid, index) => ({ id: uid, path: `users/${uid}`, data: { roles: index ? ['business'] : ['customer'], businessId: index ? 'biz-protected' : '', accountStatus: 'active' } })),
    ],
    businesses: [
      { id: 'biz-target-1', path: 'businesses/biz-target-1', data: { ownerId: TARGETS[0], managerIds: [TARGETS[0]] } },
      { id: 'biz-target-2', path: 'businesses/biz-target-2', data: { ownerId: TARGETS[1], managerIds: [TARGETS[1]] } },
      { id: 'biz-target-3', path: 'businesses/biz-target-3', data: { ownerId: TARGETS[2], managerIds: [TARGETS[2]], profilePhoto: { path: 'businesses/biz-target-3/logo.png' } } },
      { id: 'biz-target-4', path: 'businesses/biz-target-4', data: { ownerId: TARGETS[3], managerIds: protectedDrift ? [TARGETS[3], PROTECTED[0]] : [TARGETS[3]] } },
      { id: 'biz-protected', path: 'businesses/biz-protected', data: { ownerId: PROTECTED[1], managerIds: [PROTECTED[1]] } },
    ],
    businessPrivate: [
      { id: 'biz-target-1', path: 'businessPrivate/biz-target-1', data: { ownerId: TARGETS[0], managerIds: [TARGETS[0]] } },
      { id: 'biz-target-2', path: 'businessPrivate/biz-target-2', data: { ownerId: TARGETS[1], managerIds: [TARGETS[1]] } },
      { id: 'biz-target-3', path: 'businessPrivate/biz-target-3', data: { ownerId: TARGETS[2], managerIds: [TARGETS[2]] } },
      { id: 'biz-protected', path: 'businessPrivate/biz-protected', data: { ownerId: PROTECTED[1], managerIds: [PROTECTED[1]] } },
    ],
    conversations: [
      { id: 'conv-target', path: 'conversations/conv-target', data: { businessId: 'biz-target-3', participantIds: [TARGETS[2], TARGETS[3]], customerId: TARGETS[3] } },
    ],
    reports: [],
    businessOwners: [],
  }
  return {
    deleteLog,
    async getAuthAccount(uid) {
      return { exists: uid === TARGETS[0] || uid === TARGETS[3] || PROTECTED.includes(uid), uid, disabled: false }
    },
    async listCollection(collectionName, { cursor, pageSize }) {
      const docs = [...collections[collectionName]].sort((a, b) => a.id.localeCompare(b.id))
      const start = cursor ? docs.findIndex((document) => document.id === cursor) + 1 : 0
      const page = docs.slice(start, start + pageSize)
      return { docs: page, cursor: page.at(-1)?.id ?? null, done: start + pageSize >= docs.length }
    },
    async getDocument(collectionName, id) {
      return collections[collectionName].find((document) => document.id === id) ?? { exists: false, id, path: `${collectionName}/${id}`, data: null }
    },
    async deleteDocument(path) {
      if (path === failPath) throw new Error('planned failure with someone@example.invalid')
      deleteLog.push(['doc', path])
      return { path, status: 'deleted' }
    },
    async deleteAuthAccount(uid) {
      deleteLog.push(['auth', uid])
      return { uid, status: uid === TARGETS[1] || uid === TARGETS[2] ? 'already-absent' : 'deleted' }
    },
  }
}

async function approvedReport() {
  return runTestCleanupAudit(sourceFixture(), options, () => '2026-07-10T00:00:00.000Z')
}

describe('cleanup execution configuration', () => {
  test('defaults to dry-run and enforces confirmation phrase for apply', () => {
    const parsed = parseExecutionArguments([
      '--project-id', 'holalocal-491c9',
      '--confirm-project', 'holalocal-491c9',
      '--target-uids', TARGETS.join(','),
      '--protected-uids', PROTECTED.join(','),
      '--approved-dry-run-report', '/tmp/report.json',
      '--output-dir', '/tmp/out',
    ])
    assert.equal(parsed.apply, false)
    assert.throws(() => validateExecutionOptions({ ...options, apply: true, confirmationPhrase: 'wrong' }), /confirmation phrase/)
  })

  test('rejects target/protected overlap', () => {
    assert.throws(() => validateExecutionOptions({ ...options, protectedUids: [TARGETS[0], PROTECTED[0]] }), /overlap/)
  })
})

describe('cleanup execution safeguards', () => {
  test('verifies approved dry-run shape and builds exact allowlist', async () => {
    const report = await approvedReport()
    assert.equal(verifyApprovedDryRunReport(report, options), true)
    const allowlist = buildAllowlist(report)
    assert.equal(allowlist.userDocuments.length, 4)
    assert.equal(allowlist.businesses.length, 4)
    assert.equal(allowlist.businessPrivate.length, 3)
    assert.equal(allowlist.conversations.length, 1)
    assert.equal(allowlist.authAccounts.length, 2)
  })

  test('dry-run default does not delete anything', async () => {
    const source = sourceFixture()
    const report = await runCleanupExecution(source, { ...options, apply: false }, await approvedReport(), () => '2026-07-10T00:00:00.000Z')
    assert.equal(report.metadata.status, 'dry-run')
    assert.equal(source.deleteLog.length, 0)
  })

  test('blocks production-state drift and protected references', async () => {
    const source = sourceFixture({ protectedDrift: true })
    const report = await runCleanupExecution(source, { ...options, apply: false }, await approvedReport(), () => '2026-07-10T00:00:00.000Z')
    assert.equal(report.metadata.status, 'blocked-drift')
    assert.ok(report.drift.length > 0)
  })

  test('apply deletes only exact allowlist in order and handles missing auth', async () => {
    const source = sourceFixture()
    const report = await runCleanupExecution(source, { ...options, apply: true }, await approvedReport(), () => '2026-07-10T00:00:00.000Z')
    assert.equal(report.metadata.status, 'complete')
    assert.deepEqual(source.deleteLog.map(([kind]) => kind).slice(-2), ['auth', 'auth'])
    assert.equal(source.deleteLog.some(([, value]) => value.includes('biz-protected')), false)
  })

  test('stops after the first deletion failure and redacts output', async () => {
    const source = sourceFixture({ failPath: 'businessPrivate/biz-target-2' })
    const report = await runCleanupExecution(source, { ...options, apply: true }, await approvedReport(), () => '2026-07-10T00:00:00.000Z')
    assert.equal(report.metadata.status, 'failed')
    assert.equal(report.failedStep.group, 'businessPrivate')
    assert.equal(JSON.stringify(report).includes('someone@example.invalid'), false)
    assert.equal(source.deleteLog.some(([, value]) => value === 'businesses/biz-target-1'), false)
  })
})

describe('cleanup execution output and source safety', () => {
  test('refuses to overwrite reports', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cleanup-exec-'))
    const report = await runCleanupExecution(sourceFixture(), { ...options, apply: false }, await approvedReport(), () => '2026-07-10T00:00:00.000Z')
    await writeExecutionReports(report, dir)
    await assert.rejects(() => writeExecutionReports(report, dir), /overwrite/)
  })

  test('does not reference Storage deletion APIs', async () => {
    const files = [
      '../scripts/testDataCleanupExecution/adminSource.js',
      '../scripts/testDataCleanupExecution/cli.js',
      '../scripts/testDataCleanupExecution/core.js',
      '../scripts/testDataCleanupExecution/config.js',
    ]
    const forbidden = /\b(getStorage|bucket\(|deleteObject|uploadBytes|getSignedUrl|\.file\(|\.save\(|\.move\(|\.copy\()\b/
    for (const file of files) {
      const source = await readFile(new URL(file, import.meta.url), 'utf8')
      assert.doesNotMatch(source, forbidden, file)
    }
  })
})
