# Customer-review backend foundation — review candidate

This batch reconstructs the paused backend/shared review work on PR #27's main baseline. It does not enable customer reviews in production, add website review UI, change reviewer policy or deploy Firebase. The original workspace and durable recovery backup remain untouched.

## Scope and authoritative ownership

- Shared opt-in contracts: immutable review originals, versioned lifecycle transitions, public projection allowlist, integer rating counters and future translation identity helpers. Existing root exports remain intact.
- Backend commands/read adapters: customer submit/edit/withdraw; admin approve/reject/remove; bounded public/author/admin reads; rating summaries; reporting/resolution. Trusted Auth checks, payload allowlists, optimistic versions and transactional request deduplication remain authoritative.
- Account erasure: existing finalizer and primitives now call bounded review/report cleanup before profile/Auth removal. This runs even when reviews are disabled. No parallel deletion handler was introduced.
- Four additive composite indexes for public reviews, author history, moderation queue and report queue. Existing rules remain default-deny for direct review collection access; no client grant or media rule changed.
- Protected emulator test dependencies and shared-package verification. The standalone paused offline verifier was not retained: its export/gate checks now live in the existing deployment-package verifier. That verifier also detects a rebuilt archive with stale lock integrity, a mismatch reproduced during recovery.

No website, onboarding, Services presentation, business-media transport/retry/session, Storage rule or approved-business-maintenance changes are included.

## Historical production policy boundary at PR #28

This section describes the historical PR #28 baseline, which had no approved identity, quota or retention policies. Current approved implementations and remaining activation requirements are recorded in CUSTOMER_REVIEW_QUOTAS_RETENTION_BATCH.md. The subsequent identity/UI batch implements the approved customer-chosen public name; 5 review submissions/edits and 10 reports per rolling 24h plus 90-day resolved-report retention are now approved but await their separate implementation. The server gate requires both an explicit enable flag and the exact protected local demo configuration; non-demo activation is rejected before Auth/Firestore service construction. The alias chooser is superseded by revision-bound customer names. Remaining cumulative quota values are demo-only, not approved launch enforcement.

A production launch needs a separate reviewed policy implementation, author/customer and admin website flows, mobile/keyboard/privacy verification, copy/translation review and operational decisions. This batch makes no claim that ordinary successful image uploads establish failure/retry correctness; that incident remains separate.

## Deployment boundary and ordering (not authorization)

A merge may trigger the existing Vercel website build, but this batch changes no website source and cannot enable reviews there. Do not run a blanket Firebase deploy.

There is no reason to deploy these disabled review endpoints solely to merge a foundation batch. If an explicitly approved backend staging release is later wanted:

1. Review/deploy the **four additive Firestore indexes** (`firebase deploy --only firestore:indexes --project holalocal-491c9`), retaining all existing index definitions and checking the CLI plan for any proposed deletion. Wait for readiness; the emulator does not establish deployed composite-index availability.
2. Deploy only the **16 review/report/summary callables** plus **finalizeAccountDeletion** as one coordinated backend batch. The finalizer dependency must accompany any eventual review activation so author/report erasure cannot be omitted. The exact finalizer export is `finalizeAccountDeletion` (src/index.js).
3. Keep production review activation off. Verify the disabled gate and regression-check account deletion using an approved isolated environment before any production policy launch. No production deletion test is authorized here.
4. No Firestore rules, Storage rules, media Functions, website flags or translation-provider deployment is required by this disabled foundation.

A future activation release must deploy validated policies/indexes/cleanup before exposing website controls. Its exact command and rollback target must be reviewed at that time; this document does not authorize it.

## Evidence

Fresh execution logs are in `~/Projects/HolaLocal-worktrees/review-evidence`; the original lost /tmp results are not used as proof. Fresh results: 57/57 emulator tests; 328 backend unit passes (26 environment-gated skips); 111 shared-contract passes; Functions lint; clean package import/default-off verification; negative stale-lock rejection; whitespace checks. Exact source commit is supplied by the PR head. Real customer/admin browser checks remain a website-batch requirement, not covered by HTTP or unit tests.
