# HolaLocal Firebase read-only audit

Phase 1A Batch 3 adds a strictly read-only audit tool for future Firebase data
inspection. The tool is not approved for production execution until a separate
explicit instruction names the target project and run. It is not a migration,
cleanup, repair, or rule-tightening utility. Running it is not authorisation to
migrate data.

## What it audits

The audit reads `users`, `businesses`, `businessPrivate`, `conversations`, and
`reports`. It checks schema shape, ownership pointers, duplicate business
candidates, public/private contact safety, language and service-area
normalisation, media metadata references, conversation/report references, and
derived/transitional field risk.

It never reads message bodies and never exports report details, evidence,
contact values, email addresses, tokens, passwords, credentials, signed URLs,
or business descriptions.

## What it never writes

The implementation contains no apply, write, fix, migrate, cleanup, repair, or
delete mode. It uses Firestore list/get style reads and optional Storage object
metadata existence checks for already referenced paths only. It does not crawl
Storage buckets, download files, create `businessOwners/{uid}`, update
documents, change rules, create indexes, or deploy anything.

## Node and credentials

Use Node `v20.20.2`. Non-emulator runs use Firebase Admin Application Default
Credentials from the operator environment. The selected project is always the
CLI `--project-id`; it is never inferred from `.firebaserc`, `GCLOUD_PROJECT`,
`GOOGLE_CLOUD_PROJECT`, `FIREBASE_CONFIG`, or credential metadata. When known
credential project metadata conflicts with `--project-id`, the tool refuses to
run. Unknown credential metadata is allowed only after the explicit
`--confirm-project` match.

Credentials must stay outside the repository; service-account JSON files are
ignored by `.gitignore` and must not be copied into the project. The tool does
not print credential JSON, private keys, tokens, client emails, or full
credential paths.

## Emulator usage

Use emulator mode for development and tests:

```bash
cd apps/holalocal-website
npx firebase emulators:exec --config ../../firebase.json --project demo-holalocal-audit --only firestore,storage \
  "npm run audit:firebase-readonly -- --emulator --project-id demo-holalocal-audit --output-dir ../../audit-reports/local"
```

`--emulator` requires `FIRESTORE_EMULATOR_HOST`; it will not fall back to
production if the emulator is unavailable. If `FIRESTORE_EMULATOR_HOST` is set
without `--emulator`, the tool refuses to run. Emulator credentials are not
required. `--check-storage` in emulator mode also requires
`FIREBASE_STORAGE_EMULATOR_HOST` or `STORAGE_EMULATOR_HOST`.

For an already-running emulator:

```bash
cd apps/holalocal-website
npm run audit:firebase-readonly -- \
  --emulator \
  --project-id demo-holalocal-audit \
  --output-dir ../../audit-reports/local
```

## Future production command shape

Do not run this without separate explicit authorisation:

```bash
cd apps/holalocal-website
npm run audit:firebase-readonly -- \
  --project-id <production-project-id> \
  --confirm-project <production-project-id> \
  --output-dir ../../audit-reports/<approved-run-id> \
  --page-size 100
```

The confirmation value must exactly match the selected project ID. The tool
never infers the project from `.firebaserc`, and placeholder IDs are refused.
Do not place a real production project ID in documentation or committed scripts.

## Storage checks

Storage checks are disabled by default. With `--check-storage`, the tool checks
only object paths already referenced by audited Firestore media metadata. It
does not list buckets, crawl prefixes, download object contents, copy/move/save
files, delete files, or create signed URLs.

Outside emulator mode, `--check-storage` requires both `--storage-bucket` and
matching `--confirm-storage-bucket`; the bucket name must visibly belong to the
selected project. Permission errors are reported as unreadable checks rather
than as proof that an object is missing.

## Output

The tool writes two local files only to the configured output directory:

- `firebase-audit-summary.txt`
- `firebase-audit-report.json`

Generated reports belong under `audit-reports/`, which is ignored by Git.
Tests use temporary directories. Existing report files are not overwritten; use
a fresh output directory for each run. The output directory must not be a
symlink. Temporary files are created inside the selected output directory and
removed when report writing fails where practical.

## Privacy and redaction

The JSON report contains document paths, issue codes, severities, categories,
field names, booleans, aggregate counts, duplicate groups, and reference
relationships. It does not contain contact values, emails, message text, report
details, business descriptions, credentials, access tokens, or signed download
URLs.

Reports are confidential operational data. Document paths can identify users,
businesses, reports, or conversations and must be stored and shared accordingly.
Errors are sanitised before reaching console output, the human summary, or the
JSON report.

## Exit codes and partial reports

- Exit `0`: all selected collections were scanned and report files were written.
  Data findings may still be present.
- Exit non-zero: configuration failure, emulator/connection failure, collection
  scan failure, report-write failure, or internal tool failure.

When a collection scan fails after partial progress, the JSON report marks
`metadata.complete` as `false`, the summary says the audit is incomplete, and
`migrationReadiness` is `incomplete-audit-no-readiness-conclusion`.

## Reads and cost

The audit performs paginated reads over each selected collection. Firestore read
cost is proportional to the number of listed documents. Optional
`--check-storage` checks only Storage object paths already present in media
metadata; it does not list or crawl buckets. Production audits are not free.

The tool keeps compact maps of selected user IDs, business IDs, owner IDs,
relationship IDs, small metadata, issue objects, and duplicate groups so it can
perform cross-collection checks. Memory usage is therefore proportional to the
number of users, businesses, relationships, and issues, not constant. Sensitive
field values that must be fetched to detect presence are reduced to presence
sentinels before they are stored by the audit engine.

## Interpreting results

Issue codes are stable and machine-readable. Each emitted code has severity and
category metadata. Duplicate groups include a deterministic non-binding
ranking score and reasons to help later review, but the tool does not choose a
final winner. Candidate ranking does not promote legacy `isActive`,
`isVerified`, `isPremium`, `subscriptionTier`, completion flags, or ID format as
authority. A technically successful run does not mean the data is migration
ready. Any duplicate resolution, ownership mapping, trusted creation, rule
tightening, migration, or legacy cleanup requires separate approval.
