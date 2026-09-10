# Paused work — current integration status

Updated 10 September 2026. Baseline: remote main `33d7ea7a4d12f42d2bda466cee4c5a3fcd1f6074` (PR #27). No production merge or Firebase deployment authorized for this batch.

## Preservation

Original mixed workspace is untouched: 45 modified tracked files and 99 untracked files. Durable verified backup: `/home/cevans2k11/Backups/HolaLocal/recovery-20260910T082707Z` (598 source files plus verified Git bundle). Historical `/tmp` worktrees, logs and snapshot were lost; their pass reports are historical evidence only. New worktree: `~/Projects/HolaLocal-worktrees/customer-reviews-backend`; durable execution logs: sibling `review-evidence`.

## Batch dispositions

| Work | Status | Required next step |
| --- | --- | --- |
| Narrow onboarding, location removal, token/navigation, save feedback, recommended media eligibility | Integrated through PR #25 | Preserve current main; do not replay mixed files |
| Image display and gallery deletion | Integrated through PR #25/#26 | Canonical deletion remains emulator-verified; production legacy removal/reopen previously confirmed |
| Services deep links and approved design | Integrated through PR #27 | Real-listing visual feedback pending an approved business; owner accepted preview/automated checks |
| Customer-review backend/shared/moderation/reporting/account erasure | Prepared and locally verified; awaiting batch review/merge approval | Package, unit and protected emulator results must refer to this exact source |
| Review production identity, quotas, report retention | Awaiting product decisions | No choice approved; first identity question presented, others to follow individually |
| Customer/admin website review UI and translations | Pending coordinated follow-up | Integrate into current Services/routes; do not replace with stale paused versions; browser/mobile/accessibility tests required |
| Review demo test infrastructure | Included only where needed by backend tests | No production seed/preview activation; complete actual browser flow in website batch |
| Duplicate offline package verifier | Superseded in this extraction | Existing verifyDeploymentPackage now checks review modules/exports/default-off gate and archive/lock consistency |
| Broad upload/retry/session candidate | Separate, unmerged | Ordinary successful uploads do not prove failure/retry recovery; require meaningful controlled evidence |
| Cloud media harness and bucket portability | Separate, unverified | Reassess committed investigation branch before reuse; no project or resources created |
| Historical Services preview | Superseded for production by PR #27 | Preserve source in backup/branch; no preview code copied into this backend batch |
| Approved-business maintenance | Proposal only | Separate product decision; no new moderation workflow implemented |

## Contracts and release boundary

Backend review commands, reads and moderation are callable-only: default-deny client rules remain unchanged. Current production activation refuses synthetic demo policies. The author-visible rejection reason and trusted review timestamps already exist in the recovered code; older handovers listing these as absent are superseded. Business availability is checked on reads; account erasure integration is active independently of the review gate and must be regression-tested before any affected finalizer deployment.

The existing package tarball name/version is unchanged. A fresh generic npm install initially reused the old lock integrity and lacked review subpath exports; explicitly installing the freshly packed archive corrected the lock. The authoritative verifier now rejects that mismatch rather than silently accepting cached code.

Pending identity is a generated per-review alias versus customer-selected display name. Quotas and retention are not approved. Demo aliases/limits MUST NOT become production defaults. Review-text translation/provider activation and business-maintenance policy are outside this batch.

Historical CUSTOMER_REVIEWS_BATCH*, *_WEBSITE and report/deletion handovers remain in the original backup. Their stage-specific “not run”, missing-contract and launch instructions do not supersede this current status. Only fresh results recorded for the final batch commit establish readiness.

## Fresh backend batch verification

- 57/57 protected Auth/Firestore/Functions/Storage emulator tests passed, including review/report privacy, concurrent idempotency and account cleanup. Initial run had one missing rules-test dependency; clean rerun passed after read-only reuse of installed website test dependencies.
- 328 backend unit tests passed; 26 emulator-only cases skipped outside their protected harness. Focused review/deletion run: 104 passed, five emulator gates skipped.
- 111 shared-contract tests passed. Functions lint and git diff whitespace checks passed.
- Clean deployment artifact imports the installed review package exports; all 16 callables reject while disabled. Archive/lock mismatch negative check passed and original lock restored.
- About 13 GB free after sequential tests; no duplicate website dependency install. All 598 original source hashes still match the durable recovery manifest.
- No website browser result or production review activation is claimed. No Firebase resources created/deployed.
