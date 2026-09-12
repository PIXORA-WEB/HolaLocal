# Business-report cleanup automation — preparation only

This replaces the proposed daily manual queue routine. No daily attendance requirement, grace period or changed retention policy is introduced. No cloud resources, scheduled Function export, IAM changes or activation are included in this candidate.

## Corrected existing scope

Admin queue views query dates across the full collection, not the currently loaded page. Cleanup-due business reports use trusted resolvedAt <= now minus90days; assessment-due views use private decision dates. Each is ordered oldest first with stable document-ID tie ordering and20record pages. Business rows show their cleanup eligibility date and due/not-yet-due state separately from preservation. Missing trusted dates are explicit. Due views can have empty pages after excluding legacy/released records; Next page remains available rather than falsely claiming no remaining work. No backdating, broad unbounded browser scan or fabricated legacy date.

Dates query existing automatic single-field indexes; no new composite index is proposed. Cloud index readiness still needs read-only acceptance at release; the emulator cannot prove deployed index availability.

## Prepared authoritative worker

runBusinessReportRetention in the existing businessReports.js is offline preparation, not an index.js Function export. Its separate BUSINESS_REPORT_RETENTION_ENABLED control defaults false and returns before opening Firestore. Manual admin permission checks are unchanged. Both manual and worker paths reuse one private deletion transaction; no fabricated admin identity or permissive endpoint.

The transaction rereads and requires targetType=business, status=resolved, resolutionVersion=1, a real trusted resolvedAt at least90days old, and no active/invalid preservation decision. Explicitly released valid decisions are permitted; merely overdue holds are not. Known supported schema only, no attachments/unhandled copies. It deletes the supported report record including identifying text and notes, never the business or a customer-review report.

One page of at most50candidates per run. Cursor in maintenanceProgress/businessReportRetention advances before each attempt so held/invalid/failing records cannot permanently pin the queue; short/end pages reset and failures can be revisited on later cycles. Each transaction failure is isolated; progress/query failure fails the run. No unbounded loop. Timestamp/document-ID cursor queries do not require a new composite index. Concurrent holds are checked inside the shared transaction. Firestore may retry a contended transaction; each run remains bounded by the future Function timeout. No automatic release, acknowledgment assessment, conversation erasure or account-deletion initiation.

## Proposed additional cloud implementation — needs approval of exact final source

Add ONE onSchedule export, sweepResolvedBusinessReports, in europe-west1:
- schedule every60minutes;120second timeout;256MiB;maxInstances1;concurrency1;minInstances0;retryCount0.
- call the prepared worker, logging only aggregate examined/removed/preserved/needsAssessment/failed/pageLimitReached counts and an explicit disabled/complete/error outcome. No report IDs, text, personal data or exception reasons in logs.
- independent BUSINESS_REPORT_RETENTION_ENABLED=false on initial deployment. It must not inherit review activation, manual cleanup, retention or account-recovery gates.
- retain authenticated Scheduler-to-worker invocation. Use the established scheduled-worker runtime/service-agent arrangement only after read-only identity/permission verification. No public invoker exception. Stop on any additional IAM requirement; do not grant roles by inference.

This creates one Cloud Functions v2/Cloud Run service and one authenticated Scheduler job, expected firebase-schedule-sweepResolvedBusinessReports-europe-west1. Retain the existing review-report worker unchanged. Reuse the deployment/monitoring infrastructure, not a mixed review/non-review worker: this makes the retention responsibility, gate, failures and rollback explicit.

Deploying only the existing seven exports does NOT deploy this unexported helper as a scheduled service. Adding the proposed export later makes the total coordinated scope eight Functions, or one extra Function in a separate release. No new Storage/rules/index changes are needed solely for this schedule; the reviewed PR44/47 rules still apply.

## Monitoring and acceptance before activation

Extend the existing operational monitoring configuration for this worker, using Craig's verified hello@holalocal.es notification destination. No new test email. Proposed conditions: any failed run/failed record; no completed run for more than2hours while enabled; persistent eligible backlog or unsupported records needing assessment. Held records alone are not failures and must not generate repeated alerts merely because they are preserved. Publish count-only heartbeat/backlog/error signals; aggregate incidents and avoid repeated notifications for one continuing incident. Use the existing log/metric conventions; specify the exact generated policies/metric resources in the eventual executable release package before creating them.

Before deploying the wrapper: extend emulator tests for record failure/timeout progress, concurrent preservation changes and retry-after-deletion; test monitor predicates offline, including disabled-gate silence and held-only noise suppression. Existing shared transaction tests remain evidence, not a reason to run paid provider tests. The prepared helper's gate, bound and cursor across preserved/legacy records are already emulator-tested.

Initial cloud acceptance stays closed: exact source/runtime, gatefalse, intended Scheduler OIDC principal/audience and invoker binding, unauthorised invocation rejection, next natural disabled execution with zero database writes, log/alert predicate configuration. No synthetic production reports. Separately approve BUSINESS_REPORT_RETENTION_ENABLED=true only after these checks and a read-only inventory of actual eligible/held/legacy records. Enabling can delete real eligible reports and requires explicit destructive-production approval. Observe next natural runs/counters and preserved holds; any genuine record-level mutation test needs specific authorization.

Hourly execution normally handles an eligible report on a subsequent run after90days; it is not an exact-second guarantee or an approved extra retention period. Backlog/service failures can delay it and must be detected. Automation removes routine queue sweeping from Craig's responsibilities. Human assessment of genuine exceptions and operational incidents remains necessary without invented staffed hours or a response-time promise. No worker can safely decide that a preservation need has ended just because Craig is unavailable.

## Costs

One Scheduler job lists atUS$0.10/month; the first3jobs per billing account are free, but availability is not assumed. Roughly720–744scheduled invocations/month. Cloud Run compute/request charges, Firestore reads/writes/deletes and relevant logs/monitoring apply at current regional rates; shared free allowances are not a guarantee. A50record page has up to50query results,50transaction rereads,50progress writes and up to50deletions, plus progress/end operations and transaction retries. Empty runs still incur minimum query/progress operations. Startup/build artifacts/logs also have ordinary project costs. No Translation requests and no change to the€30Translation alert. Limits bound each run, not total billing; there is no new hard spending cap.

Sources checked12September2026: https://cloud.google.com/scheduler/pricing ; https://cloud.google.com/run/pricing ; https://cloud.google.com/firestore/pricing . Currency conversion/taxes/free-credit treatment follows the existing billing account. Estimate actual cost after the read-only volume/configuration preflight rather than promise a fixed total.

## Rollback and approval boundary

First close BUSINESS_REPORT_RETENTION_ENABLED; an in-flight invocation may finish. Pause the new job if necessary without altering other workers. Preserve progress and preservation metadata for diagnosis. Restore recorded source/configuration; source rollback does not restore deleted reports. Do not resurrect erased personal data from backups. No changes to account-erasure protections or review activation.

Approval needed later: exact wrapper/source commit, one authenticated hourly worker/job, its specific monitoring resources using the existing channel, and separately opening its single destructive gate after acceptance. No cloud execution approval is requested for an untested wrapper or unspecified IAM grant. The present corrected candidate remains unpublished and all production controls remain unchanged.
