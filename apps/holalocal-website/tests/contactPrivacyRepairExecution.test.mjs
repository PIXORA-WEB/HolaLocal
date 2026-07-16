import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
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
const publicUpdateTime = '2026-01-01T00:00:00.000Z'

function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
  }
  return value
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')
}

function fieldFingerprint(document, pathText) {
  const value = pathText.split('.').reduce((current, key) => current?.[key], document)
  return value === undefined ? null : fingerprint(value)
}

const defaultBusiness = {
  ownerId: 'owner-1',
  status: 'active',
  verificationStatus: 'unverified',
  contact: { website: privateWebsite, websiteVisible: false, email: '', emailVisible: false },
  name: 'Business',
}

const defaultPrivate = {
  ownerId: 'owner-1',
  contact: { website: privateWebsite, websiteVisible: false },
}

function approvedReport(overrides = {}) {
  return {
    metadata: {
      projectId: 'holalocal-491c9',
      complete: true,
      mode: 'read-only',
    },
    guardrails: {
      expectedTargetCount: 1,
      actualTargetCount: 1,
      maxMutations: 1,
      proposedDocumentMutationCount: 1,
      safeToSubmitForWriteApproval: true,
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
      publicUpdateTime,
      documentFingerprints: {
        publicBusiness: fingerprint(defaultBusiness),
        privateBusiness: fingerprint(defaultPrivate),
      },
      preChangeFieldFingerprints: {
        'businesses.contact.website': fieldFingerprint(defaultBusiness, 'contact.website'),
        'businesses.contact.websiteVisible': fieldFingerprint(defaultBusiness, 'contact.websiteVisible'),
        'businessPrivate.contact.website': fieldFingerprint(defaultPrivate, 'contact.website'),
        'businesses.ownerId': fieldFingerprint(defaultBusiness, 'ownerId'),
        'businessPrivate.ownerId': fieldFingerprint(defaultPrivate, 'ownerId'),
      },
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
    [businessPath]: structuredClone(defaultBusiness),
    [privatePath]: structuredClone(defaultPrivate),
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
        updateTime: documents[documentPath] !== undefined ? `${documentPath}-precondition` : null,
        updateTimeString: documents[documentPath] !== undefined ? publicUpdateTime : null,
      })
    },
    async clearHiddenPublicWebsite(documentPath, precondition) {
      updates.push({
        path: documentPath,
        payload: { 'contact.website': 'delete' },
        mutatedFields: ['contact.website'],
        precondition,
      })
      documents[documentPath] = {
        ...documents[documentPath],
        contact: Object.fromEntries(
          Object.entries(documents[documentPath].contact).filter(([key]) => key !== 'website'),
        ),
      }
      return Object.freeze({ status: 'updated', mutatedFields: ['contact.website'] })
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
    '--project-id', 'other-project',
    '--confirm-project', 'other-project',
    '--approved-dry-run-report', '/private/report.json',
    '--business-path', businessPath,
    '--output-dir', '/private/out',
  ]), /allowlisted/)
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
  assert.throws(() => verifyApprovedContactPrivacyDryRun(
    approvedReport({ guardrails: { ...approvedReport().guardrails, actualTargetCount: 2 } }),
    options(),
  ), /actual-target-count-mismatch/)
  assert.throws(() => verifyApprovedContactPrivacyDryRun(
    approvedReport({ guardrails: { ...approvedReport().guardrails, proposedDocumentMutationCount: 2 } }),
    options(),
  ), /unexpected-mutation-count/)
  assert.throws(() => verifyApprovedContactPrivacyDryRun(
    approvedReport({ guardrails: { ...approvedReport().guardrails, maxMutations: 0 } }),
    options(),
  ), /mutation-ceiling-too-low/)
  assert.throws(() => verifyApprovedContactPrivacyDryRun(
    approvedReport({ target: { ...approvedReport().target, documentFingerprints: {} } }),
    options(),
  ), /missing-public-fingerprint/)
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
  assert.deepEqual(report.plannedOperation.checkedFields, [
    'contact.website',
    'contact.websiteVisible',
    'businessPrivate.contact.website',
    'ownerId',
    'businessPrivate.ownerId',
  ])
  assert.deepEqual(report.plannedOperation.mutatedFields, ['contact.website'])
  assert.deepEqual(report.plannedOperation.mutation, { 'contact.website': 'delete' })
  assert.equal(JSON.stringify(report).includes(privateWebsite), false)
  assert.equal(humanSummary(report).includes(privateWebsite), false)
  assert.match(humanSummary(report), /Checked fields: contact\.website, contact\.websiteVisible/)
  assert.match(humanSummary(report), /Mutated fields: contact\.website/)
})

test('apply deletes only the hidden public website projection', async () => {
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
  assert.deepEqual(source.updates, [{
    path: businessPath,
    payload: { 'contact.website': 'delete' },
    mutatedFields: ['contact.website'],
    precondition: { lastUpdateTime: `${businessPath}-precondition` },
  }])
  assert.equal('website' in source.documents[businessPath].contact, false)
  assert.equal(source.documents[businessPath].contact.websiteVisible, before.contact.websiteVisible)
  assert.deepEqual(report.plannedOperation.checkedFields, [
    'contact.website',
    'contact.websiteVisible',
    'businessPrivate.contact.website',
    'ownerId',
    'businessPrivate.ownerId',
  ])
  assert.deepEqual(report.plannedOperation.mutatedFields, ['contact.website'])
  assert.deepEqual(report.executedOperations, [{ status: 'updated', mutatedFields: ['contact.website'] }])
  assert.equal(source.documents[businessPath].status, before.status)
  assert.equal(source.documents[businessPath].verificationStatus, before.verificationStatus)
  assert.equal(source.documents[businessPath].contact.email, before.contact.email)
  assert.deepEqual(source.documents[privatePath], beforePrivate)
})

test('already-repaired state is blocked as drift with zero mutations', async () => {
  const source = fakeSource({
    [businessPath]: {
      ...defaultBusiness,
      contact: { websiteVisible: false, email: '', emailVisible: false },
    },
  })
  const report = await runContactPrivacyRepairExecution({
    approvedReport: approvedReport(),
    options: options({ apply: true, confirmationPhrase: CONFIRMATION_PHRASE }),
    source,
    now: () => '2026-01-01T00:00:00.000Z',
  })
  assert.equal(report.metadata.status, 'blocked-drift')
  assert.ok(report.drift.includes('publicWebsitePresent-drift'))
  assert.ok(report.drift.includes('businesses.contact.website-fingerprint-drift'))
  assert.equal(report.executedOperations.length, 0)
  assert.equal(source.updates.length, 0)
})

test('execution refuses state drift, missing private website, visible state and owner mismatch', async () => {
  for (const [label, fixtures, expected] of [
    ['missing private website', { [privatePath]: { ownerId: 'owner-1', contact: { website: '' } } }, 'privateWebsitePresent-drift'],
    ['visible website', { [businessPath]: { ownerId: 'owner-1', contact: { website: privateWebsite, websiteVisible: true } } }, 'websiteVisibilityHidden-drift'],
    ['websiteVisible fingerprint drift', {
      [businessPath]: {
        ...defaultBusiness,
        contact: { ...defaultBusiness.contact, websiteVisible: null },
      },
    }, 'businesses.contact.websiteVisible-fingerprint-drift'],
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
    publicUpdateTime,
    documentFingerprints: approvedReport().target.documentFingerprints,
    preChangeFieldFingerprints: approvedReport().target.preChangeFieldFingerprints,
  }), [])
  assert.ok(currentStateDrift(approvedReport({
    target: { ...approvedReport().target, documentFingerprints: { ...approvedReport().target.documentFingerprints, publicBusiness: 'wrong' } },
  }), {
    businessPath,
    privatePath,
    publicBusinessExists: true,
    privateBusinessExists: true,
    publicWebsitePresent: true,
    privateWebsitePresent: true,
    websiteVisibilityHidden: true,
    publicPrivateOwnerMatch: true,
    publicPrivateWebsiteMatch: true,
    publicUpdateTime,
    documentFingerprints: approvedReport().target.documentFingerprints,
    preChangeFieldFingerprints: approvedReport().target.preChangeFieldFingerprints,
  }).includes('public-business-fingerprint-drift'))
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
    /deleteDoc|\.doc\([^)]*\)\.delete\(|deleteUser|getAuth|getStorage|bucket\(/,
    /upload\(|save\(|copy\(|move\(|getSignedUrl|download\(/,
    /collection\(|listDocuments|listCollections|where\(/,
    /child_process|execFile|spawn|firebase\s+firestore|firebase\s+database/,
  ]
  for (const file of files) {
    const sourceText = await readFile(new URL(file, import.meta.url), 'utf8')
    for (const pattern of prohibited) assert.doesNotMatch(sourceText, pattern, `${file} ${pattern}`)
  }
})
