import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { parseAuditArguments, safeErrorDetails, validateExecutionEnvironment } from '../scripts/firebaseAudit/config.js'
import { createFixtureSource, runFirebaseAudit } from '../scripts/firebaseAudit/auditCore.js'
import { AUDIT_ISSUE_CODES, AUDIT_ISSUE_METADATA } from '../scripts/firebaseAudit/issueCodes.js'
import { humanSummary, writeAuditReports } from '../scripts/firebaseAudit/reportWriter.js'

const timestamp = { seconds: 1, nanoseconds: 0 }
const safeContact = {
  phone: '', phoneVisible: false, email: '', emailVisible: false,
  whatsappNumber: '', whatsappVisible: false, website: '',
  preferredContactMethod: 'holalocal', allowCallbackRequests: false,
}

function canonicalUser(overrides = {}) {
  return {
    uid: 'customer', displayName: 'Customer', email: 'redacted@example.invalid',
    emailVerified: true, roles: ['customer'], preferredLocale: 'en',
    accountStatus: 'active', termsAccepted: true, termsAcceptedAt: timestamp,
    termsVersion: '1.0', privacyAccepted: true, privacyAcceptedAt: timestamp,
    privacyVersion: '1.0', createdAt: timestamp, updatedAt: timestamp,
    businessId: null, deletionRequestedAt: null, ...overrides,
  }
}

function canonicalBusiness(overrides = {}) {
  return {
    ownerId: 'owner', managerIds: ['owner'], name: 'Canonical Business',
    nameNormalized: 'canonical business', slug: 'canonical-business',
    tagline: 'redacted tagline', description: 'redacted description',
    primaryCategoryId: 'Cleaning', categoryIds: ['Cleaning'],
    serviceAreas: ['marbella'], customServiceAreas: {},
    serviceRadiusKm: 20, languages: ['en'], languageLabels: {},
    primaryLanguage: 'en', location: { locality: 'Marbella', region: 'Málaga', countryCode: 'ES' },
    contact: safeContact, status: 'draft', verificationStatus: 'unverified',
    subscription: { status: 'none', tier: 'free' }, ratingAverage: 0, ratingCount: 0,
    galleryImages: [], galleryCount: 0, createdAt: timestamp, updatedAt: timestamp,
    ...overrides,
  }
}

function fixtures() {
  return {
    users: {
      customer: canonicalUser(),
      owner: canonicalUser({ uid: 'owner', roles: ['business'], accountType: 'business', businessId: 'biz-auto', preferredLocale: 'es' }),
      legacyUser: canonicalUser({
        uid: 'legacyUser', roles: ['business', 'business'], accountType: 'customer',
        businessId: 'missing-business', preferredLocale: 'xx-unknown',
        preferredLanguage: 'English', isVerified: true, isPremium: true,
        termsAccepted: false, privacyVersion: '0.9',
      }),
      pointerMismatch: canonicalUser({ uid: 'pointerMismatch', roles: ['business'], businessId: 'biz-auto' }),
      noPointer: canonicalUser({ uid: 'noPointer', roles: ['business'], businessId: null }),
    },
    businesses: {
      'biz-auto': canonicalBusiness({
        ownerId: 'owner', profilePhoto: { path: 'businesses/biz-auto/logo.png', downloadUrl: 'https://redacted.invalid/logo.png' },
      }),
      owner: canonicalBusiness({
        ownerId: 'owner', status: 'active', publishedAt: null, verificationStatus: 'verified',
        verifiedAt: null, businessName: 'Legacy Business', mainCategory: 'Plumbing',
        isActive: true, isVerified: true, isPremium: true, subscriptionTier: 'paid',
        contact: { ...safeContact, phone: '600000000', phoneVisible: false, preferredContactMethod: 'phone' },
        phone: '600000000', email: 'private@example.invalid', website: 'https://private.invalid',
        languages: ['English', 'Custom Tongue'], primaryLanguage: 'fr',
        serviceAreas: ['custom:area:custom-coast:0abc1230def456', 'Legacy Area'],
        customServiceAreas: {}, categoryIds: ['Unknown Category'], galleryCount: 3,
      }),
      sparseLegacy: { ownerId: 'missing-owner', businessName: 'Sparse Legacy', mainCategory: 'Cleaning', isActive: true },
    },
    businessPrivate: {
      'biz-auto': {
        ownerId: 'owner', managerIds: ['owner'], contact: { ...safeContact },
        createdAt: timestamp, updatedAt: timestamp,
      },
      orphan: { ownerId: 'ghost', managerIds: ['ghost'], contact: {}, createdAt: timestamp, updatedAt: timestamp },
      owner: { ownerId: 'other', managerIds: ['other'], contact: {}, createdAt: timestamp, updatedAt: timestamp },
    },
    conversations: {
      good: { businessId: 'biz-auto', customerId: 'customer', participantIds: ['customer', 'owner'], status: 'active' },
      missingBusiness: { businessId: 'missing-business', customerId: 'ghost', participantIds: ['ghost'], status: 'invalid' },
      duplicateBusiness: { businessId: 'owner', customerId: 'customer', participantIds: ['customer'], status: 'active' },
    },
    reports: {
      missingTarget: { reporterId: 'ghost', targetType: 'business', targetId: 'missing-business', status: 'open', priority: 'normal' },
      invalidShape: { reporterId: 'customer', targetType: 'user', targetId: 'owner', status: 'unknown', priority: 'extreme' },
    },
  }
}

const options = {
  projectId: 'demo-holalocal-audit',
  outputDir: '/tmp/unused',
  pageSize: 2,
  emulator: true,
  checkStorage: true,
  collectionScope: ['businessPrivate', 'businesses', 'conversations', 'reports', 'users'],
}

async function report() {
  return runFirebaseAudit(createFixtureSource(fixtures(), { existing: [] }), options, () => '2026-07-09T00:00:00.000Z')
}

describe('safety controls', () => {
  test('missing, mismatched and placeholder project IDs fail closed', () => {
    assert.throws(() => parseAuditArguments(['--emulator', '--output-dir', '/tmp/audit']), /project-id/)
    assert.throws(() => parseAuditArguments(['--project-id', 'your-project-id', '--output-dir', '/tmp/audit']), /placeholder/)
    assert.throws(() => parseAuditArguments(['--project-id', 'real-project-123', '--confirm-project', 'other-project', '--output-dir', '/tmp/audit']), /confirm-project/)
  })

  test('emulator mode succeeds without confirmation and write-like flags are rejected', () => {
    const parsed = parseAuditArguments(['--emulator', '--project-id', 'demo-holalocal-audit', '--output-dir', '/tmp/audit', '--page-size', '10'])
    assert.equal(parsed.emulator, true)
    assert.throws(() => parseAuditArguments(['--emulator', '--project-id', 'demo-holalocal-audit', '--output-dir', '/tmp/audit', '--apply']), /read-only/)
  })

  test('execution validation rejects unsafe environment combinations before reads', async () => {
    const base = parseAuditArguments(['--project-id', 'real-project-123', '--confirm-project', 'real-project-123', '--output-dir', '/tmp/audit'])
    await assert.rejects(() => validateExecutionEnvironment(base, {
      env: { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' },
    }), /FIRESTORE_EMULATOR_HOST/)
    await assert.rejects(() => validateExecutionEnvironment({ ...base, emulator: true }, { env: {} }), /requires FIRESTORE_EMULATOR_HOST/)
    await assert.rejects(() => validateExecutionEnvironment({ ...base, emulator: true, checkStorage: true }, {
      env: { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' },
    }), /storage/i)
    await assert.rejects(() => validateExecutionEnvironment(base, {
      env: { GOOGLE_CLOUD_PROJECT: 'other-project-123' },
    }), /Credential project mismatch/)
    const valid = await validateExecutionEnvironment(base, {
      env: { GOOGLE_CLOUD_PROJECT: 'real-project-123' },
    })
    assert.equal(valid.credentialProjectStatus, 'matched')
  })

  test('credential file project metadata is checked without exposing paths', async () => {
    const base = parseAuditArguments(['--project-id', 'real-project-123', '--confirm-project', 'real-project-123', '--output-dir', '/tmp/audit'])
    await assert.rejects(() => validateExecutionEnvironment(base, {
      env: { GOOGLE_APPLICATION_CREDENTIALS: '/private/path/service-account.json' },
      readTextFile: async () => JSON.stringify({ project_id: 'other-project-123', client_email: 'secret@example.invalid' }),
    }), (error) => {
      assert.match(error.message, /Credential project mismatch/)
      assert.doesNotMatch(error.message, /private|secret@example/)
      return true
    })
    const unknown = await validateExecutionEnvironment(base, { env: {} })
    assert.equal(unknown.credentialProjectStatus, 'unknown-explicit-confirmation-required')
  })

  test('audit source does not reference known Firebase write APIs', async () => {
    const files = [
      '../scripts/firebaseAudit/adminSource.js',
      '../scripts/firebaseAudit/cli.js',
      '../scripts/firebaseAudit/auditCore.js',
      '../scripts/firebaseAudit/config.js',
    ]
    const forbidden = /\b(setDoc|updateDoc|deleteDoc|writeBatch|runTransaction|FieldValue|uploadBytes|deleteObject|getSignedUrl|download|copy|move|save|bucket\.getFiles|\.list)\b/
    for (const file of files) {
      const source = await readFile(new URL(file, import.meta.url), 'utf8')
      assert.doesNotMatch(source, forbidden, file)
    }
  })

  test('admin source keeps Firestore snapshots inside the adapter boundary', async () => {
    const source = await readFile(new URL('../scripts/firebaseAudit/adminSource.js', import.meta.url), 'utf8')
    assert.doesNotMatch(source, /cursor:\s*snapshot\.docs/)
    assert.doesNotMatch(source, /docSnapshot\.ref/)
    assert.match(source, /cursor:\s*docs\.at\(-1\)\?\.id/)
  })

  test('CLI exits non-zero on configuration failure without reading', () => {
    const result = spawnSync(process.execPath, [new URL('../scripts/firebaseAudit/cli.js', import.meta.url).pathname, '--project-id', 'your-project-id', '--output-dir', '/tmp/audit'], {
      cwd: new URL('../', import.meta.url).pathname,
      encoding: 'utf8',
    })
    assert.notEqual(result.status, 0)
  })
})

describe('fixture audit coverage', () => {
  test('audit engine works through a deliberately narrow read-only source', async () => {
    const calls = []
    const source = Object.freeze({
      listCollection: async (collectionName, { pageSize, cursor }) => {
        calls.push({ collectionName, pageSize, cursor })
        return { docs: [], cursor: null, done: true }
      },
      unsupportedWrite: () => { throw new Error('must not be called') },
    })
    const result = await runFirebaseAudit(source, { ...options, checkStorage: false }, () => '2026-07-09T00:00:00.000Z')
    assert.equal(result.metadata.complete, true)
    assert.equal(calls.length, options.collectionScope.length)
  })

  test('emits defined issue codes for users, businesses, contacts, languages and references', async () => {
    const result = await report()
    const codes = new Set(result.issues.map(({ code }) => code))
    for (const code of [
      AUDIT_ISSUE_CODES.AUDIT_USER_BUSINESS_POINTER_MISSING,
      AUDIT_ISSUE_CODES.AUDIT_USER_BUSINESS_POINTER_INVALID,
      AUDIT_ISSUE_CODES.AUDIT_USER_BUSINESS_POINTER_OWNER_MISMATCH,
      AUDIT_ISSUE_CODES.AUDIT_USER_DUPLICATE_ROLES,
      AUDIT_ISSUE_CODES.AUDIT_USER_LEGACY_TRUST_FIELD,
      AUDIT_ISSUE_CODES.AUDIT_BUSINESS_LEGACY_UID_ID,
      AUDIT_ISSUE_CODES.AUDIT_OWNER_MULTIPLE_BUSINESSES,
      AUDIT_ISSUE_CODES.AUDIT_BUSINESS_CANONICAL_LEGACY_CONFLICT,
      AUDIT_ISSUE_CODES.AUDIT_BUSINESS_LEGACY_TRUST_FIELD,
      AUDIT_ISSUE_CODES.AUDIT_BUSINESS_PUBLICATION_TIMESTAMP_MISSING,
      AUDIT_ISSUE_CODES.AUDIT_BUSINESS_VERIFICATION_TIMESTAMP_MISSING,
      AUDIT_ISSUE_CODES.AUDIT_PUBLIC_CONTACT_VALUE_HIDDEN,
      AUDIT_ISSUE_CODES.AUDIT_LEGACY_PUBLIC_CONTACT,
      AUDIT_ISSUE_CODES.AUDIT_BUSINESS_PRIVATE_ORPHAN,
      AUDIT_ISSUE_CODES.AUDIT_LANGUAGE_UNKNOWN,
      AUDIT_ISSUE_CODES.AUDIT_PRIMARY_LANGUAGE_INVALID,
      AUDIT_ISSUE_CODES.AUDIT_CATEGORY_UNKNOWN,
      AUDIT_ISSUE_CODES.AUDIT_CONVERSATION_BUSINESS_MISSING,
      AUDIT_ISSUE_CODES.AUDIT_REPORT_TARGET_MISSING,
      AUDIT_ISSUE_CODES.AUDIT_STORAGE_REFERENCE_MISSING,
    ]) assert.equal(codes.has(code), true, code)
    for (const issue of result.issues) assert.ok(AUDIT_ISSUE_METADATA[issue.code], issue.code)
  })

  test('output is deterministic valid JSON and redacts PII-like values', async () => {
    const first = await report()
    const second = await report()
    assert.deepEqual(first.issues, second.issues)
    const output = JSON.stringify(first)
    for (const secret of ['600000000', 'private@example.invalid', 'redacted@example.invalid', 'https://private.invalid', 'redacted description']) {
      assert.equal(output.includes(secret), false, secret)
    }
    assert.doesNotThrow(() => JSON.parse(output))
    assert.equal(first.metadata.readOnly, true)
  })

  test('sensitive errors are sanitised in reports and summaries', async () => {
    const toxic = 'failed for private@example.invalid phone 600000000 url https://example.invalid/path?token=secret using /home/user/service-account.json'
    const source = {
      async listCollection(collectionName) {
        if (collectionName === 'businesses') throw new Error(toxic)
        return { docs: [], cursor: null, done: true }
      },
    }
    const result = await runFirebaseAudit(source, { ...options, checkStorage: false }, () => '2026-07-09T00:00:00.000Z')
    assert.equal(result.metadata.complete, false)
    assert.equal(result.summary.migrationReadiness, 'incomplete-audit-no-readiness-conclusion')
    const output = `${JSON.stringify(result)}\n${humanSummary(result)}\n${JSON.stringify(safeErrorDetails(new Error(toxic)))}`
    for (const secret of ['private@example.invalid', '600000000', 'token=secret', '/home/user/service-account.json']) {
      assert.equal(output.includes(secret), false, secret)
    }
  })

  test('pagination covers zero, one, boundary, plus-one and unusual IDs without duplicates', async () => {
    const makeSource = (ids) => createFixtureSource({ users: Object.fromEntries(ids.map((id) => [id, canonicalUser({ uid: id })])) })
    for (const [ids, pageSize] of [
      [[], 1],
      [['one'], 1],
      [['a', 'b'], 2],
      [['a', 'b', 'c'], 2],
      [['z-last', 'A-upper', 'm-mid', 'id.with.dot'], 1],
    ]) {
      const result = await runFirebaseAudit(makeSource(ids), {
        ...options,
        checkStorage: false,
        collectionScope: ['users'],
        pageSize,
      }, () => '2026-07-09T00:00:00.000Z')
      assert.equal(result.counts.collections.users, ids.length)
      assert.equal(result.metadata.complete, true)
    }
  })

  test('later page failure produces an incomplete partial report', async () => {
    const result = await runFirebaseAudit(createFixtureSource({
      users: {
        a: canonicalUser({ uid: 'a' }),
        b: canonicalUser({ uid: 'b' }),
        c: canonicalUser({ uid: 'c' }),
      },
    }, { failCollection: 'users', failAfter: 2, failMessage: 'permission denied for secret@example.invalid' }), {
      ...options,
      checkStorage: false,
      collectionScope: ['users'],
      pageSize: 2,
    }, () => '2026-07-09T00:00:00.000Z')
    assert.equal(result.metadata.complete, false)
    assert.equal(result.counts.collections.users, 2)
    assert.equal(JSON.stringify(result).includes('secret@example.invalid'), false)
  })

  test('storage checks are disabled by default and check referenced paths only', async () => {
    const checked = []
    const source = createFixtureSource(fixtures(), { existing: [] })
    source.storageObjectExists = async (path) => {
      checked.push(path)
      return false
    }
    const withoutStorage = await runFirebaseAudit(source, { ...options, checkStorage: false }, () => '2026-07-09T00:00:00.000Z')
    assert.equal(withoutStorage.counts.storageReferenceChecks, 0)
    const withStorage = await runFirebaseAudit(source, { ...options, checkStorage: true }, () => '2026-07-09T00:00:00.000Z')
    assert.deepEqual(checked, ['businesses/biz-auto/logo.png'])
    assert.equal(withStorage.counts.storageReferenceChecks, 1)
  })

  test('duplicate ranking is deterministic and does not prefer UID IDs by format', async () => {
    const first = await report()
    const reversedFixtures = fixtures()
    reversedFixtures.businesses = {
      owner: reversedFixtures.businesses.owner,
      'biz-auto': reversedFixtures.businesses['biz-auto'],
      sparseLegacy: reversedFixtures.businesses.sparseLegacy,
    }
    const second = await runFirebaseAudit(createFixtureSource(reversedFixtures, { existing: [] }), options, () => '2026-07-09T00:00:00.000Z')
    assert.deepEqual(first.duplicateBusinessGroups, second.duplicateBusinessGroups)
    const candidate = first.duplicateBusinessGroups[0].candidates.find(({ businessPath }) => businessPath === 'businesses/owner')
    assert.equal(candidate.candidateRankingReasons.includes('id-equals-owner'), false)
  })

  test('human summary is aggregate-only and report files stay in configured output path', async () => {
    const result = await report()
    const dir = await mkdtemp(join(tmpdir(), 'holalocal-audit-'))
    try {
      const paths = await writeAuditReports(result, dir)
      assert.equal(paths.jsonPath.startsWith(dir), true)
      assert.equal(paths.summaryPath.startsWith(dir), true)
      const summary = humanSummary(result)
      assert.match(summary, /Document counts:/)
      assert.doesNotMatch(summary, /600000000|private@example|redacted description/)
      const written = await readFile(paths.jsonPath, 'utf8')
      assert.equal(JSON.parse(written).metadata.readOnly, true)
      await assert.rejects(() => writeAuditReports(result, dir), /Refusing to overwrite/)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('report writer rejects symlinked output directories', async () => {
    const result = await report()
    const dir = await mkdtemp(join(tmpdir(), 'holalocal-audit-'))
    const target = join(dir, 'target')
    const link = join(dir, 'link')
    try {
      await writeFile(target, 'not a directory')
      await symlink(target, link)
      await assert.rejects(() => writeAuditReports(result, link), /symlink/)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
