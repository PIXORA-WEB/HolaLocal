# Focused gallery deletion release

Prepared on `fix/gallery-deletion`, based on main `b87342d8119601408fccdd14c97ae3e68cb0e26d`. Not deployed. Original upload/finalization investigation and approved-business maintenance proposal remain separate. No upload, timeout/retry, website runtime, Storage rules, indexes, credentials, or paused reviews/admin changes are included.

## Confirmed diagnosis

Owner's sanitized capture: September 9, 20:48:46 UTC, Firestore `documents:commit`, HTTP 403, `PERMISSION_DENIED`, “Missing or insufficient permissions.” This was a Firestore write rejection, not a failed media callable. Read-only inspection matched deployed Firestore rules exactly to main. The business was `rejected` (Needs changes), its owner account active, owner profile business pointer matched, and all recent upload session principals matched that owner. The failed request's token was not collected; ownership evidence comes from those records and the owner's capture.

The current Delete handler dispatches canonical entries to `manageBusinessMedia(remove-gallery)` and legacy entries to the existing compatibility transaction. The legacy transaction updates `galleryImages`, `galleryImageURLs`, `updatedAt`, and synchronizes business-private ownership/timestamps through the original profile service. It does not change canonical references. Nevertheless, `validBusinessDraftEdit` validates the whole resulting business document, and the old canonical validator accepted only unversioned paths. Server-established `/photos/0/a` or `/logos/logo/b` therefore caused legitimate legacy deletion to fail. Exact deployed rules reproduced `permission-denied` locally before the fix. Generic media error mapping converts that code to the permission message, losing which validation failed; it does not establish that the user lacks ownership. No speculative rerouting of legacy URLs to the canonical-only callable is required.

After the captured attempt, all relevant business fields were unchanged and all six objects still existed: three canonical plus three legacy. This attempt failed entirely before reference removal or cleanup. Earlier read-only snapshots, sanitized capture and post-attempt comparison are retained under `/tmp/gallery-deletion-evidence`; no private identifiers or object bytes are committed.

A separate confirmed canonical deletion bug parses the last path segment as a number. For `/photos/0/a` this becomes NaN, causing a RangeError before removal. Backend tests reproduced it for both A and B. This is not the source of the captured Firestore 403. The bug dates to staging/promotion commit ff683da; the older rules validator originated in 805997ed and was not updated for A/B paths.

## Changes

- `firestore.rules`: recognize backend-established A/B logo/gallery references during owner edits/review submission, retaining business-scoped paths, eight logical slots, no duplicate path/slot variants, lifecycle/ownership checks and immutable canonical fields. Create-validation semantics remain unchanged. Clients still cannot establish, replace, append, clear or transfer canonical references.
- `functions/src/businessMedia.js`: use the existing validated path parser's numeric logical slot for canonical deletion. Authority is rechecked in the transaction, reference removal precedes generation-constrained object deletion, and existing cleanup-result semantics remain unchanged.
- Existing backend/rules regression suites plus `onboardingDeletionChecks.js`, invoked by the existing onboarding browser suite: synthetic data and real isolated services. No duplicate app components, compatibility handlers or media services.

The legacy compatibility flow and generic message mapping are unchanged. Existing partial-cleanup behavior also remains: backend canonical cleanup can return `objectDeletion=failed` after removing authority, and legacy object cleanup errors are swallowed after the transaction. That is not what happened here; the focused backend tests explicitly distinguish this partial outcome. This release does not introduce a cleanup retry policy.

## Verification

Recovered original work before editing. All 144 paused-work fingerprints matched; only the isolated interrupted test's orphaned Firestore/Vite processes were stopped. Original reviews/admin emulators were left running.

- Before fix: canonical A/B deletion tests failed with RangeError; exact old rules failed the legitimate legacy removal with permission-denied (93 existing checks passed, new regression failed).
- After fix: 23 backend tests passed, including A/B removal, preserved neighbours, owner/manager authority, unrelated owner denial, prohibited statuses, cross-business paths and post-commit cleanup failure/idempotent repeat.
- Recovered browser run: 2 tests passed in 53.5 seconds, including actual Auth, Firestore, Functions and Storage emulator integration. Real editor Delete removes canonical and legacy references and objects; reload preserves removal and other images decode; a different authenticated owner is denied by the real callable. No successful deletion/callable/transaction is mocked. Admin only seeds synthetic attached fixtures. Synthetic legacy URL reads are redirected to the fixed demo Storage emulator to exercise the existing strict parser; no production request is made.
- Final rules suite: **95 passed, 0 failed**. Explicit A/B tests reject forged/replaced/appended/removed canonical references, cross-business paths, unauthenticated users, unrelated owners and inactive accounts. Owner legacy deletion remains forbidden for Pending review, Active, Suspended, Archived and Deleted businesses; Draft and Needs changes are permitted.
- Final browser rerun: **2 passed in 53.6 seconds**. Gallery-visible screenshot at 390×844 was inspected: two remaining synthetic images decode, Delete buttons remain usable and there is no horizontal overflow.
- Website and Functions lint, Firebase initialization, 17-locale parity and fresh website build passed during preparation; website runtime source is unchanged. Emulator coverage does not claim production App Check or real-GCS conditional-generation behavior. Production smoke verification remains required after authorized deployment.

## Deployment requirements and order — DO NOT RUN until authorized

Use this exact committed worktree, Node 20, existing project holalocal-491c9. No website deployment is required because no website runtime code changes. Do not use an unscoped Firebase deploy, deploy indexes or Storage rules, or include the separate isolated-cloud bucket-binding change.

From the repository root:

```
npm ci --prefix functions
node functions/node_modules/firebase-tools/lib/bin/firebase.js deploy --project holalocal-491c9 --only firestore:rules
node functions/node_modules/firebase-tools/lib/bin/firebase.js deploy --project holalocal-491c9 --only functions:manageBusinessMedia
```

Rules first restores the existing legacy deletion/profile compatibility with already-uploaded A/B media. The targeted Function then repairs canonical deletion. They are backwards compatible and do not require an atomic website release. The configured Functions predeploy hook builds the shared-contract package; no shared-contract source change is required. Keep existing environment, IAM and Storage configuration. Record each successful deployed ruleset and Function revision; do not infer success from a local build. A future merge of this branch may automatically rebuild Vercel because test files are under its project root; that deployment is unnecessary for functionality and is not currently authorized.

After deployment, the owner should delete one intended legacy image and one intended canonical image from an editable business, then refresh/reopen and confirm other images remain. Inspect matching request results, exact manifest changes and object cleanup read-only. Confirm no new lifecycle permissions were introduced and no unrelated accounts gain access using isolated tests, not production impersonation. Keep the original upload incident open.
