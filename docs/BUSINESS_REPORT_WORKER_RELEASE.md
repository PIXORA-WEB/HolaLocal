# Coordinated disabled release — PR44 then PR47

This is deployment preparation, not authorization. PR44 head0c0792826a9fec4bb0fed868eb038fcfe8dce968. The final PR47 head/tree is recorded in the release evidence/PR description after commit. Earlier “unexported helper”, seven-export and daily-manual-check instructions are superseded. Original three retention commits, backups and unrelated work remain preserved.

## Source and behavior

The authoritative businessReports transaction is shared by manual cleanup and the independent worker. The worker is now exported as sweepResolvedBusinessReports. Options: europe-west1, every60minutes, Etc/UTC,120seconds,256MiB,1CPU,maxInstances1,minInstances0,concurrency1,retryCount0. At most50candidates per invocation; SDK transaction retries remain possible within timeout. Progress-before-attempt prevents a failed/held prefix from permanently blocking later records. Success/disabled/error logging includes only fixed outcomes and counts; raw errors/report identifiers/text/exception reasons are not logged by this wrapper.

BUSINESS_REPORT_RETENTION_ENABLED is false by default: absent or any value other than exacttrue returns before creating a Firestore client or writing progress. Only trusted business-report resolution older than or equal to90days, supported schema and no active/invalid hold can pass the transaction. Overdue holds never release themselves. Conversation erasure, acknowledgment assessments and hold decisions remain manual. No account deletion can be initiated by this worker.

## Approval A: disabled deployment scope

Deploy from the exact clean combined PR47 source before website merges, with the regenerated shared archive checked against source/lock. No mixed-worktree build. Capture current main/tree/Vercel deployment/aliases, complete Function configurations and IAM, Firestore rules release and all relevant Scheduler settings before changes.

Eight exact Function exports in europe-west1:
acceptLegalConsent
requestAccountDeletion
cancelAccountDeletion
finalizeAccountDeletion
listAdminAccountDeletionRequests
recoverAccountDeletions
manageRetentionRecords
sweepResolvedBusinessReports

Commands after approval only:

    firebase deploy --project holalocal-491c9 --only firestore:rules
    firebase deploy --project holalocal-491c9 --only functions:acceptLegalConsent,functions:requestAccountDeletion,functions:cancelAccountDeletion,functions:finalizeAccountDeletion,functions:listAdminAccountDeletionRequests,functions:recoverAccountDeletions,functions:manageRetentionRecords,functions:sweepResolvedBusinessReports

Rules: four version comparisons allow valid1.0/1.1while preserving accepted-record immutability/timestamps/ownership. Reports' resolvedAt,resolutionVersion,retentionDecision cannot be changed/removed by direct client updates; direct deletion is denied when resolutionVersion or retentionDecision exists. Private acknowledgmentRetention/conversationRetention remain default-deny. No new composite indexes (local fieldOverrides is empty), Storage rules, media handlers or translation/review-worker source deployments. Verify deployed single-field index availability rather than infer it from emulator success.

Keep BUSINESS_REPORT_RETENTION_ENABLED=false on the new worker and RECORD_RETENTION_CLEANUP_ENABLED=false on manageRetentionRecords. Preserve every other environment setting. Defaults are closed even if initially absent; record explicitfalse using a read-back/merged complete serviceConfig.environmentVariables map for each new Function before acceptance. Never replace a complete map with just one flag. Existing review/provider/retention/recovery controls remain closed. Existing authorized manual finalization continues; new completed erasures gain one private due-now assessment. Admin resolution/hold/release metadata actions remain possible with cleanup closed, only on explicit admin use. No backfill. Existing recovery schedule stays authenticated/closed; it is not the new report scheduler.

New Cloud resources: one v2 Function/Cloud Run service sweepresolvedbusinessreports, one authenticated Scheduler job firebase-schedule-sweepResolvedBusinessReports-europe-west1, plus three log metrics and four disabled alert policies below. Existing deployment infrastructure/APIs are reused. No new notification channel, paid Translation request or synthetic production record.

## Exact IAM/access scope

Project holalocal-491c9, project number1097633279895.
Runtime identity explicitly pinned to1097633279895-compute@developer.gserviceaccount.com, matching the recorded existing hourly worker arrangement. This is a shared existing account with existing project data access, not a new collection-restricted identity. Other workloads using it can obtain the same identity. No new Firestore/data role grant is proposed.

Firebase's pinned CLI scheduler deployment path creates service-scoped roles/run.invoker with member serviceAccount:1097633279895-compute@developer.gserviceaccount.com on Cloud Run service sweepresolvedbusinessreports only. Its Scheduler OIDC serviceAccountEmail is the same, with audience/URI https://europe-west1-holalocal-491c9.cloudfunctions.net/sweepResolvedBusinessReports. Keep the Cloud Run invoker IAM check ENABLED on this worker. No allUsers/allAuthenticatedUsers member. Existing project IAM may confer administrative access; do not claim that one explicit binding proves nobody else has effective access.

Prerequisites to verify read-only: deployer already has iam.serviceAccounts.actAs for this runtime account and existing Function/Scheduler deployment permissions; service-1097633279895@gcp-sa-cloudscheduler.iam.gserviceaccount.com retains its existing roles/cloudscheduler.serviceAgent binding, enabling OIDC issuance; existing Functions/Run service agents remain intact. No new Service Account User/Token Creator/service-agent/project data bindings are authorized by this package. Stop if extra IAM is needed; report exact principal/resource/permission instead of broadening access.

The separate browser admin callable still needs its already-documented, separately approved correction:

    gcloud run services update manageretentionrecords --project=holalocal-491c9 --region=europe-west1 --no-invoker-iam-check

That command applies ONLY to manageretentionrecords, never sweepresolvedbusinessreports or another scheduler worker. Preserve Firebase Auth/admin checks, current App Check processing, ingress and organisation policy. It adds no public IAM grant. Verify after deployment because future Firebase updates may alter invocation configuration.

## Exact monitoring configuration

Authoritative generator: scripts/reviews-operations/prepare.mjs --business-reports. Committed generated API payload: scripts/reviews-operations/business-report-monitoring.json. Drift test enforces equality. Generate offline with:

    node scripts/reviews-operations/prepare.mjs holalocal-491c9 OUTPUT_DIRECTORY projects/holalocal-491c9/notificationChannels/13796860726352907332 --business-reports

Use the existing verified hello@holalocal.es destination. Recheck channel identity/enabled state read-only; no new verification/test email.

Create only these Logging metrics using each metrics entry as the POST body to https://logging.googleapis.com/v2/projects/holalocal-491c9/metrics:
- holalocal_business_report_scheduler_success
- holalocal_business_report_cleanup_completion
- holalocal_business_report_capacity

Create only these Monitoring policies using each policies entry as the POST body to https://monitoring.googleapis.com/v3/projects/holalocal-491c9/alertPolicies:
- HolaLocal business-report retention: failure-or-assessment-required
- HolaLocal business-report retention: scheduler-missing-success
- HolaLocal business-report retention: cleanup-missing-completion
- HolaLocal business-report retention: sustained-capacity

All four payloads have enabledfalse. Capture returned resource names/etags. Preflight existing names and stop on unexpected collisions; do not overwrite unrelated policies/metrics. No new labels containing user/report data. Existing review/erasure/Translation policies are unchanged.

One failure policy combines Scheduler/runtime/partial-failure and unsupported-record signals to avoid duplicate policies for one fault. Log notifications are rate-limited to86400seconds; no explicit renotification schedule. This limits duplicate mail rather than promising Google can never redeliver. Capacity is two non-held-only full-page signals in a rolling120minute window for5minutes; it is an investigation signal, not an exact backlog count. Held-only pages and disabled success do not match. Delivery absence is no success in120minutes for5minutes. Enabled-cleanup completion has a separate heartbeat: a Scheduler200or disabled outcome is not proof of cleanup. Absence detection must have a real baseline series; no-series-from-birth cannot be assumed detected.

All monitoring stays unarmed under Approval A. Approval of arming operational alerts is distinct from this offline work; it can result in actionable incident emails but does not authorize another test notification. Craig responds when available; no daily queue routine, fixed hours, response guarantee or backup responder is invented.

## Acceptance with controls closed

1. Verify exact source/package/configuration and explicitclosed controls; compare rules release to approved content. Confirm only the eight intended exports were deployed and existing sensitive settings unchanged.
2. New worker: verify schedule, UTC/timeouts/retries, runtime identity, target URI/audience and service-scoped invoker binding. Confirm no public binding and invoker check remains enabled. Observe the next natural Scheduler execution; outcome disabled,2xxdelivery and zero progress/report writes. No manual cleanup trigger or synthetic records.
3. New admin callable: preflight succeeds, anonymous/non-admin requests rejected, approved admin read-only queue queries work. Disabled execute/redact returns before writes. No real records used as deletion probes.
4. Verify metric/policy request bodies and returned descriptors, correct existing destination, enabledfalse, scoped filters and no sensitive labels. Natural disabled-run delivery should establish Scheduler metric series; no notifications are sent. Completion metric intentionally has no enabled-run series yet.
5. Reconfirm existing recoverAccountDeletions natural closed-gate/authenticated behavior because its compatible source was redeployed. No initiation/deletion test. Stop on unapproved IAM or unexpected data changes.
6. Only after backend acceptance and final publication approval, merge PR44 then retarget/check PR47 and merge. Each triggers Vercel. Confirm each intermediate source and final combined tree, production aliases/routes/guards and unchanged Analytics/review controls without Analytics traffic. Do not publish missing operator details or unset dates. Preserve original batch commits via normal merge commits, not squash. Existing1.0users remain uninterrupted; no fabricated acceptance.

## Approval B: later destructive activation, not included in A

Before opening BUSINESS_REPORT_RETENTION_ENABLED: read-only inventory of actual trusted eligible/held/legacy records; reviewed operational alerts ready; disabled acceptance passes. Obtain explicit permission for real eligible report deletion. Arm failure and Scheduler delivery coverage after its natural baseline; then enable only this worker's gate. Arm capacity coverage and bootstrap enabled-completion monitoring after the first real enabled completion. First-run failures are covered by failure alerts; do not manufacture production records to seed metrics.

Observe natural aggregate outcomes and eligible backlog while preserving holds; use read-only record evidence as permitted. Hourly execution has scheduling/backlog/error latency, not an unapproved retention grace period. No automatic workflow can decide that an overdue preservation need has ended. Retain manual judgment for real exceptions, not routine queue sweeping. Review activation, review-report retention and account-erasure recovery remain separately closed; completed EU provider/named-cache evidence is not repeated.

## Costs and rollback

Scheduler lists US$0.10/job/month subject to the shared first3free jobs. About720–744scheduled invocations/month, including disabled runs. Ordinary Cloud Run request/CPU/memory, Firestore progress/read/delete, build/artifact, log-based metric and alerting charges can apply. Shared free tiers are not guaranteed available. No Translation usage or budget/quota change. Bounded50candidate work and120second timeout bound each attempt, not total monthly billing. Regional usage/read-only inventory is needed for a reliable total; no hard cap is claimed. Pricing references: https://cloud.google.com/scheduler/pricing ; https://cloud.google.com/run/pricing ; https://cloud.google.com/firestore/pricing ; https://cloud.google.com/stackdriver/pricing .

Close BUSINESS_REPORT_RETENTION_ENABLED first; an in-flight transaction may finish. Pause only the new Scheduler job if necessary. Disable its four policies to prevent stale heartbeat notifications during shutdown; preserve diagnostic evidence/progress/holds. Restore captured source/configurations where safe. For a fully aborted disabled rollout, remove only newly created job/service/metric/policy resources using recorded names after approval; do not touch existing workers/channel. Restore manageretentionrecords invoker-check if withdrawing browser access. No source rollback restores deleted data; never resurrect erased records from backups. Preserve1.0/1.1compatibility after1.1registrations exist, even if rolling back the website.

Operator address and applicable tax particulars remain pending; use actual approved publication date. This package does not waive those requirements or seek another policy decision. No production action is authorized by preparation.
