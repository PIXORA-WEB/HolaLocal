import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  parseContactPrivacyRepairArguments,
  validateExecutionEnvironment,
} from '../scripts/contactPrivacyRepairAudit/config.js'
import {
  businessPathFromAuditReport,
  runContactPrivacyRepairAudit,
} from '../scripts/contactPrivacyRepairAudit/core.js'
import {
  humanSummary,
  writeContactPrivacyRepairReports,
} from '../scripts/contactPrivacyRepairAudit/reportWriter.js'

const sensitiveWebsite = 'https://private.example.invalid/path?token=secret-token'

function source(fixtures) {
  return Object.freeze({
    async getDocument(documentPath) {
      const data = fixtures[documentPath]
      return Object.freeze({
        path: documentPath,
        exists: data !== undefined,
        data: data ?? null,
        updateTime: data !== undefined ? `${documentPath}-update-time` : null,
        updateTimeString: data !== undefined ? `2026-01-01T00:00:00.000Z:${documentPath}` : null,
      })
    },
  })
}

test('contact privacy repair config fails closed', async () => {
  assert.throws(() => parseContactPrivacyRepairArguments([
    '--project-id', 'holalocal-491c9',
    '--confirm-project', 'wrong-project',
    '--business-id', 'business-1',
    '--expected-target-count', '1',
    '--max-mutations', '1',
    '--output-dir', '/tmp/out',
  ]), /confirm-project/)
  assert.throws(() => parseContactPrivacyRepairArguments([
    '--project-id', 'other-project',
    '--confirm-project', 'other-project',
    '--business-id', 'business-1',
    '--expected-target-count', '1',
    '--max-mutations', '1',
    '--output-dir', '/tmp/out',
  ]), /allowlisted/)
  assert.throws(() => parseContactPrivacyRepairArguments([
    '--project-id', 'holalocal-491c9',
    '--confirm-project', 'holalocal-491c9',
    '--business-id', 'business-1',
    '--max-mutations', '1',
    '--output-dir', '/tmp/out',
  ]), /expected-target-count/)
  assert.throws(() => parseContactPrivacyRepairArguments([
    '--project-id', 'your-project-id',
    '--confirm-project', 'your-project-id',
    '--business-id', 'business-1',
    '--expected-target-count', '1',
    '--max-mutations', '1',
    '--output-dir', '/tmp/out',
  ]), /placeholder/)
  assert.throws(() => parseContactPrivacyRepairArguments([
    '--project-id', 'holalocal-491c9',
    '--confirm-project', 'holalocal-491c9',
    '--business-id', 'business-1',
    '--expected-target-count', '1',
    '--max-mutations', '1',
    '--output-dir', '/tmp/out',
    '--apply',
  ]), /read-only/)
  await assert.rejects(() => validateExecutionEnvironment({
    emulator: false,
    projectId: 'holalocal-491c9',
  }, {
    env: { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' },
    resolveCredentialProjects: async () => [],
  }), /--emulator/)
  await assert.rejects(() => validateExecutionEnvironment({
    emulator: false,
    projectId: 'holalocal-491c9',
  }, {
    env: {},
    resolveCredentialProjects: async () => [{ source: 'mock', projectId: 'other-project' }],
  }), /Credential project mismatch/)
})

test('audit report extraction locates exactly one hidden website issue', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'contact-privacy-report-'))
  try {
    const reportPath = path.join(dir, 'firebase-audit-report.json')
    await writeFile(reportPath, JSON.stringify({
      issues: [
        { code: 'AUDIT_PUBLIC_CONTACT_VALUE_HIDDEN', field: 'contact.website', documentPath: 'businesses/business-1' },
      ],
    }))
    assert.equal(await businessPathFromAuditReport(reportPath), 'businesses/business-1')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('dry run reports preservation requirements without contact values', async () => {
  const report = await runContactPrivacyRepairAudit({
    projectId: 'holalocal-491c9',
    businessId: 'business-1',
    expectedTargetCount: 1,
    maxMutations: 1,
    source: source({
      'businesses/business-1': {
        ownerId: 'owner-1',
        contact: { website: sensitiveWebsite, websiteVisible: false },
      },
      'businessPrivate/business-1': {
        ownerId: 'owner-1',
        contact: { website: '', websiteVisible: false },
      },
    }),
  })
  assert.equal(report.target.publicWebsitePresent, true)
  assert.equal(report.target.websiteVisibilityHidden, true)
  assert.equal(report.target.privateWebsitePresent, false)
  assert.equal(report.target.preservationRequired, true)
  assert.equal(report.guardrails.proposedDocumentMutationCount, 0)
  assert.equal(report.guardrails.safeToSubmitForWriteApproval, false)
  assert.equal(JSON.stringify(report).includes(sensitiveWebsite), false)
  assert.equal(humanSummary(report).includes(sensitiveWebsite), false)
})

test('dry run recognizes already preserved private website without exposing it', async () => {
  const report = await runContactPrivacyRepairAudit({
    projectId: 'holalocal-491c9',
    businessId: 'business-1',
    expectedTargetCount: 1,
    maxMutations: 1,
    source: source({
      'businesses/business-1': {
        ownerId: 'owner-1',
        contact: { website: sensitiveWebsite, websiteVisible: false },
      },
      'businessPrivate/business-1': {
        ownerId: 'owner-1',
        contact: { website: sensitiveWebsite, websiteVisible: false },
      },
    }),
  })
  assert.equal(report.target.privateWebsitePresent, true)
  assert.equal(report.target.privateWebsiteMatchesPublic, true)
  assert.equal(report.target.preservationRequired, false)
  assert.equal(report.guardrails.proposedDocumentMutationCount, 1)
  assert.equal(report.guardrails.safeToSubmitForWriteApproval, true)
  assert.ok(report.target.documentFingerprints.publicBusiness)
  assert.ok(report.target.preChangeFieldFingerprints['businesses.contact.website'])
  assert.equal(JSON.stringify(report).includes('secret-token'), false)
})

test('dry run rejects target-count mismatch, mutation ceiling, and idempotent repaired state can be zero', async () => {
  await assert.rejects(() => runContactPrivacyRepairAudit({
    projectId: 'holalocal-491c9',
    businessId: 'business-1',
    expectedTargetCount: 2,
    maxMutations: 1,
    source: source({
      'businesses/business-1': { ownerId: 'owner-1', contact: { website: sensitiveWebsite, websiteVisible: false } },
      'businessPrivate/business-1': { ownerId: 'owner-1', contact: { website: sensitiveWebsite, websiteVisible: false } },
    }),
  }), /Expected 2/)
  await assert.rejects(() => runContactPrivacyRepairAudit({
    projectId: 'holalocal-491c9',
    businessId: 'business-1',
    expectedTargetCount: 1,
    maxMutations: 0,
    source: source({
      'businesses/business-1': { ownerId: 'owner-1', contact: { website: sensitiveWebsite, websiteVisible: false } },
      'businessPrivate/business-1': { ownerId: 'owner-1', contact: { website: sensitiveWebsite, websiteVisible: false } },
    }),
  }), /exceeds maximum/)
  const repaired = await runContactPrivacyRepairAudit({
    projectId: 'holalocal-491c9',
    businessId: 'business-1',
    expectedTargetCount: 1,
    maxMutations: 1,
    source: source({
      'businesses/business-1': { ownerId: 'owner-1', contact: { website: '', websiteVisible: false } },
      'businessPrivate/business-1': { ownerId: 'owner-1', contact: { website: sensitiveWebsite, websiteVisible: false } },
    }),
  })
  assert.equal(repaired.guardrails.proposedDocumentMutationCount, 0)
  assert.ok(repaired.checks.drift.includes('public-website-already-absent'))
})

test('report writer refuses to overwrite existing reports', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'contact-privacy-output-'))
  try {
    const report = await runContactPrivacyRepairAudit({
      projectId: 'holalocal-491c9',
      businessId: 'business-1',
      expectedTargetCount: 1,
      maxMutations: 1,
      source: source({
        'businesses/business-1': { ownerId: 'owner-1', contact: { website: sensitiveWebsite } },
        'businessPrivate/business-1': { ownerId: 'owner-1', contact: {} },
      }),
    })
    const written = await writeContactPrivacyRepairReports(dir, report)
    assert.equal((await readFile(written.jsonPath, 'utf8')).includes(sensitiveWebsite), false)
    await assert.rejects(() => writeContactPrivacyRepairReports(dir, report), /EEXIST/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('source and audit modules do not expose Firebase write, delete, Storage or shell APIs', async () => {
  const files = [
    '../scripts/contactPrivacyRepairAudit/adminSource.js',
    '../scripts/contactPrivacyRepairAudit/cli.js',
    '../scripts/contactPrivacyRepairAudit/core.js',
    '../scripts/contactPrivacyRepairAudit/config.js',
  ]
  const prohibited = [
    /setDoc|updateDoc|deleteDoc|writeBatch|runTransaction/,
    /transaction\.(set|update|delete)|batch\.(set|update|delete|commit)/,
    /(?:doc|ref|snapshot)\.(set|update|delete|create)\(/,
    /getStorage|bucket\(|upload\(|save\(|copy\(|move\(|getSignedUrl|download\(/,
    /child_process|execFile|spawn|firebase\s+firestore|firebase\s+database/,
  ]
  for (const file of files) {
    const sourceText = await readFile(new URL(file, import.meta.url), 'utf8')
    for (const pattern of prohibited) assert.doesNotMatch(sourceText, pattern, `${file} ${pattern}`)
  }
})
