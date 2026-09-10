# Unattended safeguards — prepared, not deployed

## Authoritative current decisions

Craig receives actionable alerts at hello@holalocal.es, Europe/Madrid, when available. There are no staffed hours, response guarantee or backup. No new notification test is authorised. The previous single test's inbox receipt remains unconfirmed.

On 10 September 2026 the Cloud Billing account was confirmed open and denominated in EUR. The verified budget “HolaLocal Translation — EUR30 monthly alert” filters project 1097633279895 and Translate service 1DB1-3CD3-35A3, calendar MONTH, EUR30, actual spend at 100%, INCLUDE_ALL_CREDITS. Only the existing hello@holalocal.es monitoring channel receives it; default billing IAM recipients are disabled. Billing Budgets API was enabled for this operation. No quotas were changed and no test notification was sent. Free/eligible promotional credits reduce counted spend; free-tier zero-price usage does not increase it. This is net billed spend, not gross characters, and not a hard cap. Billing delays and continued usage can exceed the threshold. No claim is made about remaining credits or exact-once provider email delivery. Daily/minute quota proposals remain UNAPPROVED.

Read-back evidence is durable in ../review-evidence/translation-budget/{account,request,created,verified}.json relative to the worktree parent. No credentials are included in repository documentation.

## Focused authoritative changes

* Existing account-deletion lease/finalizer gains an internal recovery option. Only previously admin-started failed/stale finalizations qualify; requested/cancelled/completed/actively leased/expired requests do not. The original admin must still exist, be enabled and have the admin claim. Existing version, lease, ownership and checkpoint checks remain; Auth deletion stays last.
* New internal scheduled adapter scans at most 25 requests/hour, with durable progress, exponential delay from existing retryCount/updatedAt and five automatic retry cycles maximum. It calls the existing finalizer, not a second erasure implementation. It cannot authorise a new erasure. Default-off ACCOUNT_DELETION_RECOVERY_ENABLED controls execution independently of review gates.
* Existing retention worker isolates transaction/query failures, scans at most 50 candidates per each of three collections, rereads expiry/status in transactions, advances durable cursors before work and rotates collection order after interruptions. Failed rows are revisited after cursor wrap; open reports are never removed. Linked resolved audit/request records keep the approved 90-day expiry checks. Missing/invalid expiry still requires preflight investigation, not guessed deletion.
* maintenanceProgress documents are server-only under unchanged default-deny rules. Logs contain counts, not account/report IDs or text. Existing offline monitoring now prepares 12 disabled policies and three count metrics, including record failures, recovery failures/blockers/exhaustion/pending queues and missing recovery completion. No operational policies were created.

## Limitations and launch requirements

These safeguards reduce dependence on immediate human response; they cannot guarantee erasure deadlines without someone addressing blocked/exhausted work and requests awaiting initial approval. Cursor-cycle latency scales with total records. Systemic Firestore failure stops a run and must alert through Scheduler failure; no unsafe fallback exists. Accounts whose authoriser loses permission require a new permitted human action. Reports missing valid expiry need read-only data preflight. Neither retry cap nor cursor bounds promise a response time.

Before release: review exact commit/stack; verify effective runtime permissions for Auth read/delete, existing finalizer Firestore/Storage operations and Scheduler authenticated invocation. Do not infer these from local ADC permissions. No IAM grants are included. Confirm recovery/retention queries against deployed indexes, existing authorised-erasure states and expiry schema read-only. Test alert delivery/receipt using the already-sent test, without sending another. Operational monitoring creation/arming and automation activation require concrete approval.

## Proposed deployment, only after approval

From the reviewed combined source, with review and retention gates closed and recovery unset/false:

`firebase deploy --project holalocal-491c9 --only functions:finalizeAccountDeletion,functions:sweepResolvedCustomerReviewReports,functions:recoverAccountDeletions`

This updates two existing Functions and adds one authenticated Scheduler worker/job. It does not deploy website, rules, indexes, Storage/media handlers or other callables. New worker's Scheduler job and invoker permissions must be verified; do not disable its IAM check. New runtime module must be included in the deployment artifact. Recovery can later be enabled separately only after explicit approval; review/retention flags remain independent.

Costs: additional hourly Scheduler/Functions executions, bounded Firestore reads/writes and any actual erasure Storage/Auth work; monitoring metrics/policies may also incur charges. Translation budget does not cover these resources. No new production automation/resources in this paragraph have been created.

Acceptance: source/export/gate read-back; new worker authenticated Scheduler success while disabled with no maintenance writes; current retention likewise disabled/no cleanup writes; permission/index inspection; approved isolated positive tests and no synthetic production records/account deletion. Later authorised activation requires counts/heartbeat alerts and gate rollback verification. Record deployed revision/configuration before changes.

Rollback: close recovery and retention gates first, restore previous finalizer/retention source if needed and pause/delete only the newly introduced recovery job after approval. Preserve progress/checkpoint records. Already-completed erasures and retention deletions cannot be undone. The budget is independent and can be edited/deleted without changing runtime quotas.

## Final local verification

358 backend unit tests pass, 29 emulator-only tests skipped in that unit invocation. Separately, all 36 real Auth/Firestore/Storage/Functions emulator checks pass on the final source (translation provider remains mocked). This includes concurrent recovery of an actual synthetic Auth deletion, revoked admin/ownership rejection, cancelled/requested preservation, poison-record progress, other-collection progress and private progress-rule denial. Five monitoring preparation tests and Functions lint pass. Clean deployment-artifact verification passes with installed runtime dependencies. No production positive erasure/retention operation was attempted. Logs: ../review-evidence/translation-budget/safeguard-{all-unit,emulator-release,lint,package}.log. Main was rechecked at 428cdbc08617d53e3498ffb5593e7200807dfa7c.
