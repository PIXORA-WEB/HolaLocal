# Combined reviews release readiness

Current successor to PR #28 backend, #29 chosen names/UI and #30 quotas/retention. Production remains disabled. Historical batch results are not substituted for fresh results on this branch.

## Response and privacy correction

The authoritative report detail service now returns only businessContext {businessId, name} for a currently public-eligible business, or null. It uses the checked review locator, never a browser-supplied business ID. The admin case links the escaped name to the existing Services detail route. Suspended, unsafe-contact, missing/deleted and erased targets show the localized unavailable message without a link or private business fields. A withdrawn review can still identify its currently public business. Normal review moderation IDs and existing customer public projections are unchanged.

## Language review

All 17 locales are included: en, es, fr, de, it, pt, nl, sv, no, da, fi, pl, cs, sk, hu, ro, uk. Structural checks cover key parity, nonempty values and pipe-row alignment. Critical policy wording was compared for public-name disclosure, private account linkage, no purchase implication, quotas, withdrawal and reports not automatically removing reviews.

Verified corrections: removed unused rejectGap and its 17 misleading “rejection unavailable” sentences after checking callers; added separate localized Business name labels without relabelling existing business-ID headings; harmonized German/Portuguese display-name instructions with informal customer copy; Norwegian name disclosure now uses the same anmeldelse term as its review controls; Spanish quota reports now match report controls. These are source/automated and assisted semantic checks, NOT native-speaker editorial approval of every sentence. Native-speaker review remains pending, especially register, report/moderation terminology and long mobile messages. No purchase-verification claim or new policy was introduced.

## Local vs cloud checks

Locally:
- node functions/scripts/checkCustomerReviewIndexes.mjs checks the four expected composites and local expiry index exemptions.
- Unit, protected emulator and combined browser suites cover callables, generation/version checks, quota races, exact retries, retention timing/new report races and erasure.
- Scheduled worker wrapper is exercised enabled and disabled against real emulator Firestore. This does not test Cloud Scheduler IAM or delivery.
- Account finalizer invokes cleanupAccountCustomerReviews independently of feature activation and before final account/Auth deletion. Keep this dependency in every future finalizer deployment. Corrupt counters fail closed; resumable cleanup and gate-off behavior are emulator tests.
- Demo seeds/guards and browser harness remain test infrastructure. No temporary design preview exists in the candidate. Original previews and old handovers remain recoverable in the untouched backup, not runtime. Legacy reviewerAlias compatibility remains necessary for previously shaped records. Upload/retry and business-maintenance proposals are separate.

Before an AUTHORIZED cloud deployment:
1. Record current main, website deployment ID/aliases, targeted Function revisions/environment/IAM, index definitions and scheduler jobs. Store metadata securely; do not put environment secrets or user documents in Git.
2. Compare deployed indexes with repository plan. Add only the four review composites; reject any CLI proposal to delete unrelated indexes. Inspect single-field overrides for expiresAt on customerReviewReports, customerReviewReportRequests and customerReviewReportAudits; ascending COLLECTION indexing must remain available (default automatic is sufficient).
3. Inventory any existing review collections read-only. Legacy synthetic quota shapes, missing report generation/submission pointers or pre-policy reports require an explicit migration decision; no automatic permissive fallback.
4. Confirm billing, Scheduler availability, function region europe-west1 and operational alert recipient.

After authorized index deployment, save a read-only export:
gcloud firestore indexes composite list --project=holalocal-491c9 --database='(default)' --format=json > review-indexes.json
node functions/scripts/checkCustomerReviewIndexes.mjs review-indexes.json

This checks READY composites only. Independently inspect single-field exemptions in Firebase/Google Cloud console and execute each real query after deployment; emulator success is not index readiness. Do not treat a stale export as current.

## Exact deployment sequence — NOT executed

Merge only after approval, in dependency order: #28 -> #29 -> #30 -> readiness follow-up. Retarget each child to main after its parent merges, inspect diff/checks and verify the final combination. Automatic website deployments may occur at each merge; gates must stay closed throughout. Never merge #28 as an activated standalone release.

From the final isolated commit with fresh package verification/build:
1. firebase deploy --project holalocal-491c9 --only firestore:indexes
   Review additive plan first; wait for all four READY and verify expiry indexing.
2. Deploy ONLY the 16 callables plus finalizer and scheduler using the command below. Keep CUSTOMER_REVIEWS_ENABLED and CUSTOMER_REVIEW_RETENTION_ENABLED disabled for this first disabled rollout.
3. Verify Function revisions, default-disabled errors, unchanged ordinary account flows, scheduler configuration and no public review UI. Scheduled function is europe-west1, every60min; inspect its generated job, authenticated target and last executions. Disabled invocations must not construct the database worker.
4. Website procedure: after explicit merge approval, merge the stacked PRs in the order above into the Git-connected main branch; let the existing HolaLocal Vercel integration build each merge from source. Do not upload a local dist or change environment/project settings. In Vercel, verify the final deployment source SHA equals final main, target is Production, build is Ready and the existing production aliases point to it. These automatic disabled website deployments can precede Firebase safely because both gates are closed. Record the previous production deployment ID for rollback. If automatic deployment fails, stop and inspect that build; do not deploy from the mixed workspace.
5. Activation is a SEPARATE reviewed change: current backend AND website gates deliberately refuse production, even if a flag is true. No environment-only activation command can enable this candidate. Review gate changes and run authorized cloud synthetic tests first, then enable retention and verify it runs before accepting any production reports; open customer access last.

firebase deploy --project holalocal-491c9 --only functions:getCustomerReviewRatingSummaries,functions:submitCustomerReviewReport,functions:listCustomerReviewReports,functions:getCustomerReviewReport,functions:resolveCustomerReviewReport,functions:submitCustomerReview,functions:editCustomerReview,functions:withdrawCustomerReview,functions:approveCustomerReview,functions:rejectCustomerReview,functions:removeCustomerReview,functions:listPublishedCustomerReviews,functions:getOwnCustomerReview,functions:listOwnCustomerReviews,functions:listCustomerReviewModerationQueue,functions:getCustomerReviewModerationCase,functions:finalizeAccountDeletion,functions:sweepResolvedCustomerReviewReports

No Firestore rules, Storage rules, media Functions, Storage objects or website deployment is included in this Firebase command.

## Scheduler, monitoring and rollback

Authorized environment verification must include expired synthetic resolved report + linked receipts/audits, unexpired resolved report and open report. Invoke the worker there, verify all expired copies removed, others preserved, new report race protected, and logs contain only counts. A production Scheduler “Run now” is a mutation, not read-only inspection; require approval and suitable synthetic scope before doing so.

Operational alerts to configure before activation: worker error or missing successful hourly execution for two hours; pageLimitReached for two successive runs; overdue open report queue reviewed daily. Default bounded worker examines at most 50 records per collection per hour (150 total). A persistent backlog requires capacity review, not discarding open reports. Monitor callable failures/latency and account-erasure retry failures without recording report text, identities, tokens or private notes. Alert thresholds are operational recommendations, not changes to retention/moderation policy.

Rollback: close customer writes/UI first; preserve backend contracts serving existing records, retention and earlier erasure. Restore the recorded known-good website deployment if necessary. Do not roll Functions back to synthetic quotas, remove indexes in use, or turn off retention while report data exists. If reverting finalizer, retain its review cleanup dependency or stop finalization until compatible cleanup is available. Record actual Function revisions at deployment; none exist for this undeployed stack.

## Resources and remaining decisions

No cloud resources created. Deployment can bill Blaze Functions/Cloud Run invocations, build/artifact storage, one hourly Cloud Scheduler job, Firestore composite storage/query reads/transaction reads/writes/deletes and logging/alerts. Website uses existing Vercel project/plan. No new Firebase project, Storage bucket, paid translation provider or TTL service is required by this batch. Actual pricing/budget must be checked in the project before creation.

Approved product decisions are settled: customer-chosen names, 5 combined reviews/edits +10 reports per rolling24h, 90-day resolved cleanup and 7-day overdue indication. No further review policy decision is requested. Activation approval, operational owner/budget, authorized cloud verification and editorial review remain outstanding.

## Final combined-source verification (10 September 2026)

- 338 backend unit tests passed; 27 protected entry points skipped outside emulator.
- 29 real review emulator tests passed, including scheduled wrapper enabled/disabled, concurrency, retry, retention/new-cycle races and account erasure while reviews are disabled.
- 112 shared-contract tests passed; 97 selected website component/client/Services/location/media tests passed.
- Combined real Auth/Firestore/Functions customer/admin browser journey passed, including report public-business name/link and keyboard focus. Unavailable/deleted fallback and name escaping also have explicit response/rendered-component tests.
- Released regression browsers: 3 Services and 2 onboarding/media checks passed.
- Functions/website lint, all17 locale parity, Firebase initialization, clean deployment package verification, whitespace checks and fresh website build passed.
- Main reverified at 33d7ea7a4d12f42d2bda466cee4c5a3fcd1f6074. PR #28/#29/#30 unchanged and mergeable at inspection. All598 original source hashes match recovery manifest; about12GB free; no new dependencies installed.
- Durable logs are ../review-evidence/readiness-*.log. No cloud activation/index/scheduler result is claimed. No Firebase deployment, merge or production change was performed.

Recommendation: review and approve the full stack as a disabled integration, with readiness follow-up last. Do not activate production until the cloud and operational checks above are complete. The candidate SHA is the readiness PR head; all runtime/tests listed above are included in that commit.
