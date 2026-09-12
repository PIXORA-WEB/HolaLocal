> Disclosure integration complete locally: authoritative privacy content and review submission notice cover approved review/EU handling in all17 languages; affected tests/browser/lint/build pass. Cloud launch checks and notification receipt remain pending. No new policy, consent-version change, production configuration or activation. See REVIEWS_FINAL_LAUNCH_PACKAGE.md.

> Current coordinated authority: [REVIEWS_FINAL_LAUNCH_PACKAGE.md](REVIEWS_FINAL_LAUNCH_PACKAGE.md). Earlier isolated deployment scopes and unresolved contact/budget placeholders below are historical where superseded. PR33–36 remain unmerged; operational deployment and activation remain unapproved.

> Current update, 10 September 2026: EUR30/month net Translation actual-spend alert is configured at 100% for hello@holalocal.es; it is not a cap. Daily/minute quotas remain unapproved. Isolated erasure-recovery and retention safeguards plus expanded offline monitoring are prepared, not deployed. See [UNATTENDED_SAFEGUARDS_RELEASE.md](UNATTENDED_SAFEGUARDS_RELEASE.md), which supersedes older budget and safeguard-preparation statements below. Reviews, retention and recovery remain disabled; upload/retry and maintenance proposals remain separate.

# Activation preparation update

Separate prepare/reviews-production-activation branch now prepares project-scoped default-off production gate support. PR33/34 heads are preserved; none merged. See REVIEWS_LAUNCH_CHECKLIST.md for coordinated launch, missing recipient/budget/access permissions, cloud acceptance, actual privacy-disclosure gap and rollback. Business registration/submission/approval are independent of review gates. Native editorial polish is not a blanket launch blocker. No flags, IAM, notifications or production records changed.

# Combined PR33/34 status — current authority

Main verified428cdbc08617d53e3498ffb5593e7200807dfa7c. PR33 monitoring head4a74c0d5012d6c31946156f3eb6318fd1501c7e0 is incorporated into PR34 locally; only this inventory conflicted and was consolidated. Merge PR33 first using a merge commit (not squash/rebase), then PR34 using a merge commit, after final approval. Verify final source tree matches the combined candidate before Firebase deployment. No runtime conflict or policy change.

Monitoring now covers17 callables/two count metrics/eight disabled policies, including text/structured sanitized translation warnings. No recipients configured: Craig, Europe/Madrid; actual email and staffed hours needed; no backup. Translation EU provider synthetic probe16/16 passed,1,184 characters. Runtime access is separate: deployed shared account1097633279895-compute@developer.gserviceaccount.com lacks direct Translation roles; effective access not established (troubleshooter403). Conditional minimum access proposal is in REVIEW_TRANSLATION_RUNTIME_ACCESS.md. No grants made.

Reviews, retention and provider selection remain disabled. Upload/retry incident and maintenance proposal remain separate; original recovery and provider evidence preserved. The sections below retain the detailed file inventory; earlier claims that translation is unimplemented are superseded by this update and REVIEW_TRANSLATION_EU_RELEASE.md.

# Paused work — current authority

Updated10September2026 against freshly fetched main `428cdbc08617d53e3498ffb5593e7200807dfa7c` (PR32), deployed READY to both HolaLocal domains. This branch contains local operations preparation/documentation only; no activation or cloud-resource creation authorized. Recheck main before any later integration.

## Preservation and exact inventory

Original mixed workspace remains at d9c776f on fix/my-business-dashboard-layout. All598 original source hashes still match the readable recovery manifest at `/home/cevans2k11/Backups/HolaLocal/recovery-20260910T082707Z`; archive and Git history bundle retained. The previously reported144 files mean **45 modified tracked +99 untracked files**, NOT the598-file recovery fingerprint. Filename-level comparison in PAUSED_FILE_RECONCILIATION.json:57 identical to main,50 different,37 absent. Different is not automatically pending: it includes superseded designs and older policy contracts. No mixed files reset or discarded. Stale /tmp worktree registrations are historical/prunable but have not been removed.

## Dispositions

| Feature | Current disposition | Remaining action |
| --- | --- | --- |
| Onboarding/location/token/save/status/recommended-image eligibility | IntegratedPR25; selected original files now identical | Preserve main. No broad candidate replay. |
| Media display and deletion | IntegratedPR25/26, scoped Firebase deletion deploy complete | Legacy production deletion/reopen passed; canonical deletion emulator-verified. Original upload incident separate. |
| Services deep links and approved design | IntegratedPR27 | Approved preview/automated release evidence accepted; real-listing visual feedback pending eligible business. |
| Customer reviews/moderation/identity/quotas/retention/contracts/indexes/erasure | IntegratedPR28–31 and deployed disabled | Both gates closed; erasure integration active. Do not restore original synthetic aliases/quotas or bypass compatibility. |
| Review route rewrites | Integrated/deployedPR32 | All3 real direct/reload checks passed390/1440. |
| Callable transport IAM | Scoped16-service correction applied, code unchanged | Normal browser preflight/disabled/auth-denial checks passed; future deployment drift checks required. Scheduler authenticated. |
| Scheduled retention | Deployed, cleanup gate closed | Natural Scheduler200 verified; actual enabled cloud cleanup + alerts/recipient/operational ownership remain pending. |
| Review UI languages |17 locale controls integrated, source/automated checks passed | Native editorial review pending. Automatic public review-text translation is implemented in combined PR34 with explicit EU endpoint, same-language bypass and safe diagnostics; production remains disabled. Native editorial/provider runtime checks remain outstanding. |
| Admin visual work | Main already contains administration workspace redesign (1aea9ee ancestor), current AdminLayout matches mixed version | No distinct uncommitted admin-layout visual patch remains to integrate. Fictional AdminReviewPreview is backup-only; do not treat it as approved runtime. |
| Broad upload/retry improvements | Useful hypotheses, unverified, excluded | See UPLOAD_RETRY_DISPOSITION.md individual changes/evidence requirements. |
| Cloud gallery harness/portable bucket binding | Retained historical branch3111da9, not integrated | Fresh extraction needed for real cloud tests; do not merge stale runtime or enable resources without scoped approval. |
| Tests/package/compatibility | Current authoritative verifiers and protected demos retained | Demo harnesses are legitimate isolated tests, not temporary production previews. Keep reviewerAlias field compatibility, withTimeout and generation protections. |
| Historical documents | Documentation-only | Batch-stage claims are historical; this status plus REVIEWS_OPERATIONS.md supersede old deployment/approval instructions. |
| Approved-business maintenance | Proposal only | No new editing/moderation policy implemented. Separate product task. |

## Verified retired scope

Current runtime has no design-preview directory/import/productionGuard, servicesTarget helper, or verifyCustomerReviewOfflinePackage duplicate. All are preserved in the original recovery source. PR27 authoritative Services components/styles supersede512 lines of old global Services styling present in the mixed file: do not layer it back. Current verifyDeploymentPackage owns package validation; current Services target resolution owns direct links. Admin/demo browser launchers remain test infrastructure behind protected emulator configuration; their names containing Preview are not grounds for deletion. No fresh runtime deletions were necessary in this main-based branch.

## Translation requirement and safe next implementation

CustomerReviews renders review.originalText directly. useTranslation updates labels, date/number formatting; shared customerReviewTranslation.js only defines revision/language/provider-aware keys and source metadata. It has no translation callable/cache caller. Google provider adapter already exists for messaging; reuse the provider abstraction instead of creating a competing provider, but keep message permissions/storage separate.

Remaining contract: automatic published-review translation when website language changes; retain original text and a clear original/translated toggle, safe fallback, stale-response suppression on rapid language switches, revision/provider/language cache invalidation, and immediate rechecking of business/review visibility before returning cached text. Only moderated public text may go to the provider; never names, private/pending/rejected text, reports or notes. Include withdrawal/removal/account-erasure cache cleanup. Detect source language when unknown rather than assuming site language is the author's language. Review provider costs/disclosure/access before cloud activation. No provider/service resources enabled here. Earlier “translation outside batch” notes did not constitute user approval to drop the requirement.

## Next order

1. Review this operations preparation and settle actual recipient/hours, missing backup coverage and budget; cloud alert delivery/enabled cleanup still need authorized isolated verification.
2. Complete automatic review-text translation on a separate tested candidate before claiming the original reviews scope finished or requesting public activation.
3. Extract only justified media reliability changes with controlled lost-response/real Storage evidence; keep original incident open.
4. Consolidate remaining historical cloud harness as test-only infrastructure, preserving safety guards; obtain editorial/real-listing feedback when available.
5. Approved-business maintenance remains separate; then full website audit after these decisions/integrations.

No production activation, notification or review test records created. This document supersedes old unmerged-stack, no-cloud-resources and unapproved-policy statements; detailed historical test counts remain in their batch reports and durable review-evidence, not rerun or reclassified as fresh results.

## Fresh checks for this preparation

Offline monitoring generator:2 tests pass (closed defaults, explicit same-project channel references, scoped error/heartbeat configuration). Preserved gallery-config extraction:8 isolation tests pass; this does NOT execute cloud uploads or establish metadata parity. Real OwnStatus/i18next17-language rendering confirms changed labels and unchanged review text; initial diagnostic entry resolution failed and was corrected before the successful run. No runtime behaviour was changed to hide that missing requirement. Node syntax/whitespace checks pass; no fresh full build or heavy emulator rerun is needed for this scripts/docs-only source. Dependencies reused temporarily; no installation.

## Current optional Analytics batch — 12 September 2026

Main verified at87d5fbd (PR43). A separate explicit-consent Analytics candidate now supersedes any proposal to replace Firebase Analytics. Default collection remains off pending Google web-stream/automatic-event configuration verification and release approval. No review gates, Firebase deployments, monitoring destinations/budget or quotas change. See ANALYTICS_CONSENT_RELEASE.md for the exact payload, cookie handling, separate business-counter implications and approval prerequisites. PR44 remains draft; its obsolete no-consent-interface statement is being removed in all17 languages, without publishing incomplete legal details. No company/age/address policy invented; the operator is confirmed as Craig Evans personally and the publishable address question remains pending.

The complete local EU runtime Translation image448eb8b902342ea2e7cc04f03942f9733641a3fc9473143366cfddc6bd04d972 and its evidence are preserved. No cloud test or activation is implied by Analytics work. Original mixed workspace and recovery backup remain untouched.

### Analytics acceptance, 12 September 2026
PR45: user-corrected served-tag configuration verified; real Google ingestion completed within approved cap (6/8 page views, six204s, zero retries), signed-in/out acceptance and withdrawal passed. Production unchanged at87d5fbd. Final release must set only Production Analytics readiness true after approval; visitor choice remains mandatory. Report visibility/phone editorial checks are distinguished from transport success. See ANALYTICS_CONSENT_RELEASE.md. PR44 and reviews launch remain separate; original mixed source/backups untouched.

Analytics reporting follow-up: user saw zero Realtime users/page views within the test window. HTTP204 is only endpoint acceptance; end-to-end reporting remains blocked. No further ingestion. Await read-only property/stream/report/data-filter checks. PR45 remains draft/unmerged; do not release based solely on transport success.
Read-only follow-up: property543456383/stream15161063452 matchG-FKFR4SFML9; sole Internal Traffic filter is Testing, Realtime All Users. Live Firebase remote config also matches; no forwarding-body omission found. Reporting cause unconfirmed; headless/synthetic filtering only a hypothesis. Next check is processed existing data, not another test. Keep release on hold.

### Analytics manual acceptance complete — release recommendation pending approval
The additional approved check observed1 /events page_view under remembered consent. Reject persisted through an accidental refresh and no further collect request appeared. Report visibility is confirmed separately; earlier3-view count remains unexplained. Recommend PR45 website-only consent-enabled release for final approval, preserving known207.56kB/200kB budget failure. No merge/deployment, new automated traffic or review/Translation activation performed. See the current decision at the top of ANALYTICS_CONSENT_RELEASE.md.
