# Retention integration — disabled release candidate

Baseline main: 203895227b41c03b87e8edc4a33f57134055a4b8. PR44 dependency: 27d9075608f29c93298a91a69c51892dc650cda3. Original recovery work and backups are preserved. No production changes have been made. This document supersedes the earlier backend-only preparation instructions.

## Three retained batches and authoritative integration

1. c08edbbce960f1290ba232224772c726ebc738b9: acknowledgment evidence and explicitly reviewed exceptions. New completed account erasures receive a due-now assessment once, assigned to the existing finalizing administrator. No historical records are backdated or migrated. Integration moves the assessment into private acknowledgmentRetention/{uid}; the owner's existing deletion-status document does not expose exception notes. Cleanup removes the four-field historical acknowledgment evidence and its private decision only after explicit release, completed checkpoints and absence of a user profile. Terminal request identity/checkpoints remain for retry safety; these are not declared exempt from all future retention review.
2. 9d1f48452cecec242f1917895e1052444acacab0: business-report handling and 90-day retention. Resolution records handling of the report only. It never approves, rejects, suspends or changes a business. Trusted resolvedAt/resolutionVersion establish eligibility; retries do not reset the clock. Open reports, legacy reports without trusted dates, attachments and unknown schemas are preserved for assessment. Supported expired records are removed entirely, including identifying text/links and resolution notes. Customer-review reports are unaffected.
3. e975b7a20fd4918e370646b2477a82cb54419cf9: conversation retention and specifically assessed message erasure. Any existing Auth account, including disabled accounts, retains history; there is no recent-login rule. Whole-history removal requires both accounts absent, completed erasure receipts and an explicit released needs assessment. Each action removes at most ten messages per conversation. Selected text erasure requires an already-authorised participant account-erasure request and preserves the retry tombstone while removing text, translation and matching last-message preview. It does not automatically scan messages. Standalone privacy requests still require individual handling; requesting account deletion is not imposed as a condition of making such a request.

The integration extends the existing Admin Account deletions page, existing service and AccessibleDialog. One reusable RetentionControls component handles the three kinds through one strict shared callable contract. No replacement admin page, duplicate save handler or CSS override layer. Copy is present in all 17 locales; automated parity and layout checks are not native-language certification.

## Exceptions and execution

Every preservation decision has a specific reason, authenticated responsible administrator, next review date and ending condition. A date becoming overdue highlights the review; it never renews the hold or permits deletion. An administrator must explicitly release it when the need ends. Legacy/invalid decisions fail closed.

RECORD_RETENTION_CLEANUP_ENABLED must remain false. Missing also means false. Client payloads cannot override it. Metadata assessment and report-resolution actions remain available when cleanup is closed; destructive selection and text erasure do not.

There is deliberately no new schedule. Existing admin permissions, a 20-record cursor queue, explicit confirmation and at most five selected records per request provide the minimum bounded manual execution. Conversation chunks are ten messages each (at most fifty per request); every record is isolated so a failure does not block later eligible selections. No automatic client retries or unbounded draining. Firestore can retry a transaction for contention under its SDK limits. Pagination advances across ineligible rows. This is not an unattended guarantee of deletion exactly on day 90. Keep public wording truthful until separately approved operational enforcement is accepted.

## Exact deployment scope and order — not authorised

Combined PR44 plus this child requires seven Function exports, all europe-west1:

- acceptLegalConsent
- requestAccountDeletion
- cancelAccountDeletion
- finalizeAccountDeletion
- listAdminAccountDeletionRequests
- recoverAccountDeletions
- manageRetentionRecords (the only new export; HTTPS callable)

The first six include PR44 historical-version compatibility; finalizeAccountDeletion and the existing recovery worker additionally load the new completion metadata behavior. The existing recoverAccountDeletions schedule/identity/authorization must be preserved and ACCOUNT_DELETION_RECOVERY_ENABLED remains false. No new Scheduler job. No review retention worker, translation/media handler, Storage rules or indexes are deployed. Existing single-field/document-ID queries require no new composite indexes.

Firestore rules include PR44 historical-consent compatibility and protection of report resolvedAt/resolutionVersion/retentionDecision from direct client edits/removal. Reports carrying canonical resolution or preservation metadata cannot be directly deleted by clients. Existing ordinary legacy moderator handling remains permitted. acknowledgmentRetention and conversationRetention are private through the existing default-deny rule; even admin browsers must use the callable.

1. Obtain final approval of exact combined source and PR44 publication particulars/date. Record then-current main/Vercel deployment, complete Function environment maps/revisions, rules release, service IAM/ingress and authenticated recovery Scheduler configuration.
2. Deploy reviewed Firestore rules before the report callable. Deploy ONLY the seven listed Functions from the exact reviewed combined source, with RECORD_RETENTION_CLEANUP_ENABLED=false and all existing review/provider/retention/recovery controls unchanged and closed. No index/Storage deployment. Do not use an unrestricted functions deployment.
3. manageRetentionRecords is explicitly invoker:private to avoid an automatic allUsers grant under the existing organisation policy. Its browser access needs separate explicit approval to disable the invoker IAM check on Cloud Run service manageretentionrecords only, matching the established browser-callable approach. Preserve Firebase Auth/admin checks, App Check processing, ingress and organisation policy. No new account or role binding is proposed. Stop if any additional permission correction is required. Recheck this setting after future source deployments.
4. Confirm normal endpoint preflight, unauthenticated denial, non-admin denial and authenticated read-only queue access; disabled execute/redact must make no writes. Verify rules identity, packaged contract and all gates. Observe the existing recovery worker naturally if required by final scope; never trigger erasure as an acceptance test.
5. Merge PR44, then retarget/review the retention child against main and merge only with explicit approval. Each merge triggers Vercel; backend compatibility must precede the first website with new version payloads, and the new callable must precede the retention UI. Compare each merged tree to the approved source, including conflict resolutions. Keep Production Analytics consent enabled and reviews disabled. This avoids an incompatible intermediate website. Do not deploy mixed-worktree output.

Example scoped commands (only after approval, from the exact source):

    firebase deploy --project holalocal-491c9 --only firestore:rules
    firebase deploy --project holalocal-491c9 --only functions:acceptLegalConsent,functions:requestAccountDeletion,functions:cancelAccountDeletion,functions:finalizeAccountDeletion,functions:listAdminAccountDeletionRequests,functions:recoverAccountDeletions,functions:manageRetentionRecords

A source merge alone is not a Firebase deployment. Do not publish PR44 before its unresolved operator particulars and actual release date are ready.

## Immediate behavior versus disabled cleanup

After backend deployment, newly completed authorised erasures create private review metadata, once; this happens even with cleanup closed. Existing records are unchanged. Explicit admin assessment/resolution writes start only when an administrator uses the new controls. No automatic backfill. No new destructive execution occurs until separate cleanup activation approval. Review activation and its existing workers remain separate controls and are not blocked by this unrelated retention implementation.

## Verification and limits

The portable runner functions/scripts/runRetentionIntegration.mjs accepts backend, rules, browser-closed or browser-enabled plus an absolute durable evidence directory outside /tmp. It pins demo projects/loopback ports; no production fixtures or credentials belong in the repository. Browser fixtures are test files, not imported by production runtime. Run resource-heavy modes sequentially. Final combined checks:12 real Auth/Firestore backend cases,99 Firestore/Storage rules cases,82 targeted unit cases and113 shared-contract cases passed with no skipped cases. Both real Auth/Firestore/Functions browser modes passed34locale/viewport checks each. Lint,17locale parity, fresh build and26-file packaged-contract byte/integrity verification passed. Initial JavaScript measured208.69kB gzip; the unchanged200kB budget fails and must remain visible. These suites overlap and are not presented as a count of unique cases. Earlier failing setup attempts remain historical.

Real Auth/Firestore/Functions emulator journeys cover holds/releases, report handling, private decisions, closed controls, explicit local enabled execution, cancellation, reload, preserved unrelated records, non-admin denial and 17-language mobile/desktop layout. Unit and rules checks preserve historical acknowledgments, finalizer/recovery safety, ownership and released media/business protections. No production cleanup or runtime callable IAM behavior is claimed verified locally. No Translation/cache test is repeated.

Known limits: attachments/unknown schemas require separate assessment; legacy resolution dates are not inferred; a recreated Auth identity outside normal platform flows remains an operational boundary; full deletion-request operational metadata minimization is separate from four-field acknowledgment removal. Native/legal editorial review is not certified. The existing 200 KiB website budget remains unchanged; report the measured final value and any increase honestly.

## Rollback

Close RECORD_RETENTION_CLEANUP_ENABLED first; an in-flight request may finish. Disable the admin workbench by reverting its website commit while retaining private metadata and protective rules. Preserve PR44 1.0/1.1 backend/rules compatibility once 1.1 registrations exist; old exact-version validation is not a safe rollback. Restore recorded Function/config revisions only with that bridge intact. Restore the new service's invoker-check requirement if withdrawing browser access; do not alter other services. Never delete preservation decisions as rollback. Source rollback cannot restore erased data; do not resurrect personal information by blindly restoring backups. No change to the approved reviews, support-mailbox or monitoring policies.
