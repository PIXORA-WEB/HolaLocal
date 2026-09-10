# Current update — EU review translation integration

This update supersedes older stage-specific pending/merged statements below. Main verified428cdbc; PR28–32 are merged with reviews/retention disabled. PR33 remains the separate offline monitoring/backlog preparation. PR34 now integrates the tested EU adapter, explicit review runtime endpoint/region, same-language bypass, safe diagnostics and revision/provider cache namespace. Neither PR is merged by this work.

Real EU synthetic provider success:16 requests/1,184 characters; native-language quality remains unreviewed. Runtime service-account permission is NOT established: direct project roles lack Translation permission; effective Policy Troubleshooter returned403. Provider activation blocked pending administrator verification of cloudtranslate.generalModels.predict and serviceusage.services.use, production spend/quota approval and monitoring readiness.

PR33 monitoring must include the17th callable and sanitized translation-failure warnings before activation; Craig's email and staffed hours remain placeholders and no backup responder is available. No notifications configured. Approved-business maintenance remains a proposal. Original upload incident/retry improvements remain separate and unverified; ordinary successful uploads are not retry evidence. Original recovery snapshot and synthetic provider evidence preserved. No temporary Services preview or pending policy implementation imported.

See REVIEW_TRANSLATION_EU_RELEASE.md for exact release gates. Historical sections follow.

---

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
| Review identity, quotas, report retention | Approved and implemented on stacked integration branches; production disabled | PR #29 implements names; quota/retention batch implements 5 combined submissions/edits, 10 reports per rolling 24h, 90-day resolved cleanup and seven-day overdue indication |
| Customer/admin website review UI and translations | Integrated locally; verified locally | Real browser submit/retry/moderation/display checks and released Services/onboarding regressions passed |
| Review demo test infrastructure | Reusable protected emulator and browser harnesses retained | Synthetic local data only; sequential suites and durable logs. No production seeds or media transport changes |
| Duplicate offline package verifier | Superseded in this extraction | Existing verifyDeploymentPackage now checks review modules/exports/default-off gate and archive/lock consistency |
| Broad upload/retry/session candidate | Separate, unmerged | Ordinary successful uploads do not prove failure/retry recovery; require meaningful controlled evidence |
| Cloud media harness and bucket portability | Separate, unverified | Reassess committed investigation branch before reuse; no project or resources created |
| Historical Services preview | Superseded for production by PR #27 | Preserve source in backup/branch; no preview code copied into this backend batch |
| Approved-business maintenance | Proposal only | Separate product decision; no new moderation workflow implemented |

## Contracts and release boundary

Backend review commands, reads and moderation are callable-only: default-deny client rules remain unchanged. Current production activation still refuses all non-demo environments; approved policies alone do not enable it. The author-visible rejection reason and trusted review timestamps already exist in the recovered code; older handovers listing these as absent are superseded. Business availability is checked on reads; account erasure integration is active independently of the review gate and must be regression-tested before any affected finalizer deployment.

The existing package tarball name/version is unchanged. A fresh generic npm install initially reused the old lock integrity and lacked review subpath exports; explicitly installing the freshly packed archive corrected the lock. The authoritative verifier now rejects that mismatch rather than silently accepting cached code.

Approved identity is a separately chosen public name, moderated with each review revision; account name/email are never copied. Approved quotas are 5 review submissions/edits and 10 reports per rolling 24h, with free exact retries and withdrawal; implemented in the quota/retention batch. Open reports stay until handled; resolved-report text, identity and notes must be removed after 90 days, with earlier account erasure. Retention implementation is now in the quota/retention batch, including linked request/audit copies. Open reports are marked overdue after seven days without being closed. Old generated alias and cumulative demo quota policies are not launch defaults. Review-text translation/provider activation and business-maintenance policy are outside this batch.

Historical CUSTOMER_REVIEWS_BATCH*, *_WEBSITE and report/deletion handovers remain in the original backup. Their stage-specific “not run”, missing-contract and launch instructions do not supersede this current status. Only fresh results recorded for the final batch commit establish readiness.

## Historical verification for PR #28 (not the current combined source)

- 57/57 protected Auth/Firestore/Functions/Storage emulator tests passed, including review/report privacy, concurrent idempotency and account cleanup. Initial run had one missing rules-test dependency; clean rerun passed after read-only reuse of installed website test dependencies.
- 328 backend unit tests passed; 26 emulator-only cases skipped outside their protected harness. Focused review/deletion run: 104 passed, five emulator gates skipped.
- 111 shared-contract tests passed. Functions lint and git diff whitespace checks passed.
- Clean deployment artifact imports the installed review package exports; all 16 callables reject while disabled. Archive/lock mismatch negative check passed and original lock restored.
- About 13 GB free after sequential tests; no duplicate website dependency install. All 598 original source hashes still match the durable recovery manifest.
- No website browser result or production review activation is claimed. No Firebase resources created/deployed.

## PR #29 display-name/UI batch (verification at that batch head)

Stacked on unmerged PR #28. Restored customer/admin services/components, routes and 17-locale interface copy into current main's released Services presentation. Removed the synthetic alias chooser from the command boundary: new submissions require an explicit trimmed/NFC-normalized 1–80 code-point name without control/bidi override characters. The moderated revision publishes that name through the existing reviewerAlias field for compatibility. Legacy revisions remain readable, but no new review may omit its name. Pending/rejected edits retain the approved name.

The website stays production-disabled. Retired only paused tests that referenced the superseded servicesTarget helper or the unshipped preview mock; current deep-link/browser and backend summary tests remain authoritative. No design-preview runtime, global CSS overrides, upload/retry/session changes or maintenance policy were imported.

Fresh identity/UI evidence: 57 emulator tests, 329 backend unit passes (26 emulator-only skips), 112 shared-contract passes, 39 customer/admin UI tests, Functions/website lint, 17-locale checks and clean package verification. Real browser: explicit blank name despite private account details, invalid-field focus, drop-after-commit retry with one revision, admin approval, escaping, reload, pending-name preservation and approved rename; mobile/desktop screenshots inspected. Released regression suites: three Services tests and two onboarding/display/deletion tests passed. Full native-language editorial review remains unverified. No production activation or deployment.

## Quota/retention batch — current combined source

Branch `integration/customer-review-quotas-retention`, stacked on PR #29 (`03b489999e6f4df7404972e9915e8878091c4ff9`), which is stacked on unmerged PR #28. Remote main rechecked unchanged at the baseline above. No mixed-workspace files replayed; no upload/retry/maintenance work included.

Approved quotas replace the synthetic cumulative policies in the authoritative callable boundary. The same transactional receipt and customer/business slot continue to enforce deduplication and one current review. The website now keeps withdrawal enabled after a quota error. Resolved reports and their linked submit/resolve receipts/audits expire together; a new explicit report does not reset the old cycle's expiry. Earlier account-erasure cleanup remains authoritative. A bounded hourly cleanup export is added with a separate default-off gate and non-sensitive backlog/count logging.

All requested product choices for this batch are approved, including the seven-day admin indication. Production activation, deployed index availability, scheduler operation/capacity monitoring and native-language editorial checks remain release requirements. Old notes saying quotas/retention are unapproved, synthetic quotas are launch defaults, or PR #28 is the full current source are superseded. See [current batch evidence and release requirements](CUSTOMER_REVIEW_QUOTAS_RETENTION_BATCH.md).

Current combined results: 336 backend unit passes (27 protected skips), 28 real review emulator passes, 112 unchanged shared-contract passes, 95 selected website passes, combined customer/admin browser journeys and five released Services/onboarding regressions. Lint, locale/config/package checks and fresh build passed. New source is reviewable as disabled integration, not approved for production activation. See the batch document for remaining gaps and exact future Firebase scope.


## Release-readiness follow-up — current authority

Branch integration/reviews-release-readiness on PR #30 c748dd254e932370b8a3c7cb60ab7377556b7e2f. The report detail contract/UI now supplies safe public business name/link, with unavailable/deleted fallback. Retired the unused rejectGap sentences in all17 locales; no callers remain. Added offline index-readiness checks and real emulator verification of the scheduled worker wrapper. Current operations and activation instructions are in CUSTOMER_REVIEWS_RELEASE_READINESS.md; older batch deployment paragraphs are historical.

PR #28/#29/#30 heads were rechecked open/mergeable and unchanged. Candidate preserves optional Services integrations and all released main fixes. Pending review work is now operational deployment/index/scheduler verification, separately approved production activation and native-speaker editorial feedback. No unfinished alternative moderation implementation is imported. Protected local review demos remain necessary tests; original fictional Services preview remains backup-only. Keep reviewerAlias compatibility and account-erasure cleanup while gates are closed. Separate admin visual work, cloud media/upload-retry investigation and maintenance proposal remain unmerged.

Fresh follow-up: 29 real review emulator tests and the full customer/admin browser journey passed; 97 selected website tests passed. The browser verified the report business name and keyboard-focusable Services link. Additional rendered-component tests cover escaped names and unavailable no-link rendering. Unit privacy tests cover suspended/deleted/erased/unsafe-contact targets and non-admin denial. Final lint/build/package results are recorded in the readiness document.
