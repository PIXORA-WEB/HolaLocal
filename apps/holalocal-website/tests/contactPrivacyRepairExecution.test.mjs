import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  CONFIRMATION_PHRASE,
  parseContactPrivacyExecutionArguments,
  validateExecutionEnvironment,
} from '../scripts/contactPrivacyRepairExecution/config.js'
import {
  currentStateDrift,
  runContactPrivacyRepairExecution,
  verifyApprovedContactPrivacyDryRun,
} from '../scripts/contactPrivacyRepairExecution/core.js'
import {
  humanSummary,
  writeContactPrivacyExecutionReports,
} from '../scripts/contactPrivacyRepairExecution/reportWriter.js'

const businessPath = 'businesses/business-1'
const privatePath = 'businessPrivate/business-1'
const privateWebsite = 'https://private.example.invalid/path?token=secret'

function approvedReport(overrides = {}) {
  return {
    metadata: {
      projectId: 'holalocal-491c9',
      complete: true,
      mode: 'read-only',
    },
    target: {
      businessPath,
      privatePath,
      publicBusinessExists: true,
      privateBusinessExists: true,
      publicWebsitePresent: true,
      websiteVisibilityHidden: true,
      privateWebsitePresent: true,
      privateWebsiteMatchesPublic: true,
      preservationRequired: false,
      publicFieldToRemoveLater: `${businessPath}.contact.website`,
    },
    findings: [],
    ...overrides,
  }
}

function options(overrides = {}) {
  return {
    apply: false,
    businessPath,
    confirmationPhrase: '',
    dryRunReport: '/private/report.json',
    emulator: false,
    outputDir: '/private/out',
    projectId: 'holalocal-491c9',
    ...overrides,
  }
}

function fakeSource(fixtures = {}) {
  const documents = {
    [businessPath]: {
      ownerId: 'owner-1',
      status: 'active',
      verificationStatus: 'unverified',
      contact: { website: privateWebsite, websiteVisible: false, email: '', emailVisible: false },
      name: 'Business',
    },
    [privatePath]: {
      ownerId: 'owner-1',
      contact: { website: privateWebsite, websiteVisible: false },
    },
    ...fixtures,
  }
  const updates = []
  return {
    updates,
    documents,
    async getDocument(documentPath) {
      return Object.freeze({
        path: documentPath,
        exists: documents[documentPath] !== undefined,
        data: documents[documentPath] ?? null,
      })
    },
    async clearHiddenPublicWebsite(documentPath) {
      updates.push({ path: documentPath, fields: ['contact.website', 'contact.websiteVisible'] })
      documents[documentPath] = {
        ...documents[documentPath],
        contact: { ...documents[documentPath].contact, website: '', websiteVisible: false },
      }
      return Object.freeze({ status: 'updated', fields: ['contact.website', 'contact.websiteVisible'] })
    },
  }
}

test('execution config defaults to dry-run and fails closed for project and confirmation errors', async () => {
  const dryRun = parseContactPrivacyExecutionArguments([
    '--project-id', 'holalocal-491c9',
    '--confirm-project', 'holalocal-491c9',
    '--approved-dry-run-report', '/private/report.json',
    '--business-path', businessPath,
    '--output-dir', '/private/out',
  ])
  assert.equal(dryRun.apply, false)
  assert.throws(() => parseContactPrivacyExecutionArguments([
    '--project-id', 'holalocal-491c9',
    '--confirm-project', 'wrong-project',
    '--approved-dry-run-report', '/private/report.json',
    '--business-path', businessPath,
    '--output-dir', '/private/out',
  ]), /confirm-project/)
  assert.throws(() => parseContactPrivacyExecutionArguments([
    '--apply',
    '--project-id', 'holalocal-491c9',
    '--confirm-project', 'holalocal-491c9',
    '--approved-dry-run-report', '/private/report.json',
    '--business-path', businessPath,
    '--output-dir', '/private/out',
  ]), /confirm-repair/)
  assert.doesNotThrow(() => parseContactPrivacyExecutionArguments([
    '--apply',
    '--project-id', 'holalocal-491c9',
    '--confirm-project', 'holalocal-491c9',
    '--approved-dry-run-report', '/private/report.json',
    '--business-path', businessPath,
    '--output-dir', '/private/out',
    '--confirm-repair', CONFIRMATION_PHRASE,
  ]))
  await assert.rejects(() => validateExecutionEnvironment({
    emulator: false,
    projectId: 'holalocal-491c9',
  }, {
    env: {},
    resolveCredentialProjects: async () => [{ source: 'mock', projectId: 'other-project' }],
  }), /Credential project mismatch/)
})

test('approved dry-run verification rejects mismatched or non-narrow reports', () => {
  assert.equal(verifyApprovedContactPrivacyDryRun(approvedReport(), options()), true)
  assert.throws(() => verifyApprovedContactPrivacyDryRun(
    approvedReport({ target: { ...approvedReport().target, preservationRequired: true } }),
    options(),
  ), /private-preservation-required/)
  assert.throws(() => verifyApprovedContactPrivacyDryRun(approvedReport(), options({ businessPath: 'businesses/other' })), /business-path-mismatch/)
})

test('dry-run revalidates state and does not write', async () => {
  const source = fakeSource()
  const report = await runContactPrivacyRepairExecution({
    approvedReport: approvedReport(),
    options: options(),
    source,
    now: () => '2026-01-01T00:00:00.000Z',
  })
  assert.equal(report.metadata.status, 'dry-run')
  assert.equal(report.executedOperations.length, 0)
  assert.equal(source.updates.length, 0)
  assert.equal(JSON.stringify(report).includes(privateWebsite), false)
  assert.equal(humanSummary(report).includes(privateWebsite), false)
})

test('apply changes only the hidden public website projection', async () => {
  const source = fakeSource()
  const before = structuredClone(source.documents[businessPath])
  const beforePrivate = structuredClone(source.documents[privatePath])
  const report = await runContactPrivacyRepairExecution({
    approvedReport: approvedReport(),
    options: options({ apply: true, confirmationPhrase: CONFIRMATION_PHRASE }),
    source,
    now: () => '2026-01-01T00:00:00.000Z',
  })
  assert.equal(report.metadata.status, 'complete')
  assert.deepEqual(source.updates, [{ path: businessPath, fields: ['contact.website', 'contact.websiteVisible'] }])
  assert.equal(source.documents[businessPath].contact.website, '')
  assert.equal(source.documents[businessPath].contact.websiteVisible, false)
  assert.equal(source.documents[businessPath].status, before.status)
  assert.equal(source.documents[businessPath].verificationStatus, before.verificationStatus)
  assert.equal(source.documents[businessPath].contact.email, before.contact.email)
  assert.deepEqual(source.documents[privatePath], beforePrivate)
})

test('execution refuses state drift, missing private website, visible state and owner mismatch', async () => {
  for (const [label, fixtures, expected] of [
    ['missing private website', { [privatePath]: { ownerId: 'owner-1', contact: { website: '' } } }, 'privateWebsitePresent-drift'],
    ['visible website', { [businessPath]: { ownerId: 'owner-1', contact: { website: privateWebsite, websiteVisible: true } } }, 'websiteVisibilityHidden-drift'],
    ['owner mismatch', { [privatePath]: { ownerId: 'owner-2', contact: { website: privateWebsite } } }, 'publicPrivateOwnerMatch-drift'],
  ]) {
    const report = await runContactPrivacyRepairExecution({
      approvedReport: approvedReport(),
      options: options({ apply: true, confirmationPhrase: CONFIRMATION_PHRASE }),
      source: fakeSource(fixtures),
      now: () => '2026-01-01T00:00:00.000Z',
    })
    assert.equal(report.metadata.status, 'blocked-drift', label)
    assert.ok(report.drift.includes(expected), label)
    assert.equal(report.executedOperations.length, 0, label)
  }
  assert.deepEqual(currentStateDrift(approvedReport(), {
    businessPath,
    privatePath,
    publicBusinessExists: true,
    privateBusinessExists: true,
    publicWebsitePresent: true,
    privateWebsitePresent: true,
    websiteVisibilityHidden: true,
    publicPrivateOwnerMatch: true,
    publicPrivateWebsiteMatch: true,
  }), [])
})

test('execution report writer refuses overwrite and redacts sensitive values', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'contact-privacy-execution-'))
  try {
    const report = await runContactPrivacyRepairExecution({
      approvedReport: approvedReport(),
      options: options(),
      source: fakeSource(),
      now: () => '2026-01-01T00:00:00.000Z',
    })
    const written = await writeContactPrivacyExecutionReports(dir, report)
    assert.equal((await readFile(written.jsonPath, 'utf8')).includes(privateWebsite), false)
    await assert.rejects(() => writeContactPrivacyExecutionReports(dir, report), /EEXIST/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('execution source does not expose Storage, Authentication or document-delete APIs', async () => {
  const files = [
    '../scripts/contactPrivacyRepairExecution/adminSource.js',
    '../scripts/contactPrivacyRepairExecution/cli.js',
    '../scripts/contactPrivacyRepairExecution/core.js',
    '../scripts/contactPrivacyRepairExecution/config.js',
  ]
  const prohibited = [
    /deleteDoc|\.delete\(|deleteUser|getAuth|getStorage|bucket\(/,
    /upload\(|save\(|copy\(|move\(|getSignedUrl|download\(/,
    /collection\(|listDocuments|listCollections|where\(/,
    /child_process|execFile|spawn|firebase\s+firestore|firebase\s+database/,
  ]
  for (const file of files) {
    const sourceText = await readFile(new URL(file, import.meta.url), 'utf8')
    for (const pattern of prohibited) assert.doesNotMatch(sourceText, pattern, `${file} ${pattern}`)
  }
})
