# Customer review quotas and report retention

This batch is stacked on PR #29 and PR #28. Main was rechecked at `33d7ea7a4d12f42d2bda466cee4c5a3fcd1f6074`. Nothing has been merged or deployed to Firebase. Website and callable review activation still reject production. No credentials, seeds, media changes, or paused admin visual changes are included.

## Approved behaviour and implementation

- Five review submissions/edits combined per authenticated account in a rolling 24 hours, across all businesses. Ten reports per account in that same rolling window. Failed validation and exact receipt replays consume no quota. Approval, rejection and withdrawal consume no quota. The existing customer/business slot enforces one current review.
- `customerReviewQuotas.js` replaces the synthetic 100/20 cumulative policies at the existing callable boundary. The record contains at most 5 or 10 timestamps, and exact 24-hour-old timestamps leave the window. Corrupt/old demo counters fail closed. Quota time is sampled after the transaction reads the counter, so another request committing after this request started does not create a false clock-regression error.
- Open reports stay open until handled. The admin queue and case mark them overdue after seven days; this neither removes the review nor imposes a handling deadline.
- Resolution writes `resolvedAt` and `expiresAt` (90 days) on the report and expiry on both submit/resolve request receipts and audit records. The submission receipt pointer binds the correct reporting cycle. Each new cycle also receives a server-generated random generation, independent of client request IDs. Admin resolution must match both the numeric version and this generation, preventing a stale screen from resolving a later report after full erasure resets its version—even if the client reuses an expired request ID. A deliberate new report about currently published content starts a new cycle; it does not prolong old linked records. Resolving a report still does not remove the review.
- The existing report controller freezes `submittedAt` with the request ID and payload. Receipts replay without quota charges. Without a receipt, a submission must be less than 24 hours old (up to five minutes future clock tolerance). This prevents an old lost-response retry from recreating a report after its identifying receipt has been erased. Expired requests require a deliberate refresh/new operation; a device with a substantially incorrect clock must be corrected. Old report clients without this field fail validation; deploy the combined client/backend before enabling reports.
- `customerReviewRetention.js` deletes whole expired report/request/audit records, including details, reporter/admin identifiers, fingerprints and notes. Every candidate is reread transactionally; new open or later-resolved cycles survive. Open records have no expiry. Expired case content is hidden on reads at the boundary even before the scheduled pass. Existing account-erasure fences and cleanup drain identifying records and both quota records earlier.
- `sweepResolvedCustomerReviewReports` is an hourly scheduled Function, default OFF through `CUSTOMER_REVIEW_RETENTION_ENABLED`. Each run handles at most 50 candidates in each of three collections. Logging contains counts and `pageLimitReached`, never report data. Repeated page limits require operator attention/increased verified drain capacity. Physical removal runs after eligibility, normally on the next hourly pass, with backlog/failures able to delay it; this is not an exact-to-the-second deletion SLA.
- The authoritative author form keeps withdrawal available when a submission/edit hits quota. Customer quota guidance and the admin overdue indication are present in all 17 interface locales. No duplicate save or media handlers were added.

## Verification on the combined source

Durable evidence is in `~/Projects/HolaLocal-worktrees/review-evidence/policy-*`. Final counts and browser results are recorded below. Initial failed logs remain historical: a new synthetic fixture omitted the required published-review statistics; application validation correctly rejected it. The first browser launch preceded demo readiness and was rerun after the protected readiness checks completed. Later runs exposed the emulator’s transient closed-transaction error under identical-request contention; the race test explicitly replays that same request once for this exact error only, then asserts one stored operation and one quota charge. It does not change runtime retry or error mapping.

Tests cover exact rolling-window limits, staggered expiry, concurrent independent requests, free identical retries, one customer/business slot, combined submissions/edits, withdrawal at the limit, report closure/replay, retention boundary, open reports, earlier account erasure, and cleanup racing new/open/later-resolved reporting cycles. The combined browser journey uses real Auth/Firestore/Functions with synthetic data, including real server commit followed by a dropped response. Boundary counters and time passage are explicitly seeded only in the isolated emulator.

## Coordinated release requirements — no deployment authorization

The stack can be reviewed/merged as disabled integration only after owner approval. Merging may trigger Vercel production, but these flags cannot activate reviews there. PR #28/#29 must not be treated as independent production activation releases.

For a future explicitly approved Firebase release, build/package from the final coordinated commit and review the exact delta:

1. Deploy the four additive indexes from PR #28, preserving all existing indexes; wait for readiness. The retention queries use automatic single-field `expiresAt` indexes and require no new composite index or TTL policy. Check that no index exemption disables those fields.
2. Deploy the 16 review/report/summary callables **together with `finalizeAccountDeletion` and `sweepResolvedCustomerReviewReports`**. Use an explicit `--only functions:...` list. Do not deploy media Functions, Firestore/Storage rules or unrelated resources. The shared vendored contract and matching lock integrity from PR #29 must be included; `npm --prefix functions run verify:deployment-package` checks the artifact.
3. Before actual activation, separately approve the production gate change and verify deployed Auth/Firestore permissions, composite indexes, scheduled cleanup, count/backlog monitoring, and earlier account erasure in an approved isolated environment. Enable `CUSTOMER_REVIEW_RETENTION_ENABLED=true` with that approved cleanup release before accepting production reports. No environment flag alone bypasses the current review demo-only gates.
4. Release the matching website and enable reviews only after the backend/cleanup is verified. Keep review text translation/provider activation and approved-business maintenance outside this scope.

Deployment command scope for step 2 is appended from the authoritative callable registry in this document before commit. No Firebase command in this document has been executed.

The new scheduler job, Functions/Cloud Run invocations, Firestore queries/reads/deletes and logging can be billable. The default worker performs three expiry queries per enabled hourly run, plus transactional reads/deletes for candidates. Inspect project billing and establish monitoring before creating/enabling these resources. This batch created no cloud resources.

Old demo quota records (`used`) and reports lacking submission pointers/expiry are intentionally not silently migrated. No production reviews have been activated by this stack. If a future preflight finds legacy review data, inventory and explicitly migrate/erase it in the approved environment first; do not relax validation. Historical recovery documents are not migration authority.

Rollback: disable customer-review website/callable access before rolling back contracts. Once reports exist, keep retention and account erasure running; restoring PR #28's synthetic quota implementation is not a production rollback plan. Record the actual pre-deployment Function revisions when a deployment is approved.

## Remaining gaps

- Deployed review activation, index availability and scheduler operation are unverified; no production review flow is claimed.
- Admin report business context is now corrected in the readiness follow-up; see CUSTOMER_REVIEWS_RELEASE_READINESS.md for current evidence and release instructions.
- Native-language editorial review remains pending. Automated locale parity and UI checks do not replace it.
- Original gallery upload/finalization/retry investigation, cloud media harness portability and approved-business maintenance remain separate, unmerged work. Ordinary successful uploads are not evidence of failure recovery.
- Real approved-business Services visual feedback remains pending an available listing; released Services/onboarding/media fixes are preserved.

## Exact future Firebase scope (requires separate approval)

From the final isolated repository root, after checking the index plan:

```sh
firebase deploy --project holalocal-491c9 --only firestore:indexes
firebase deploy --project holalocal-491c9 --only functions:getCustomerReviewRatingSummaries,functions:submitCustomerReviewReport,functions:listCustomerReviewReports,functions:getCustomerReviewReport,functions:resolveCustomerReviewReport,functions:submitCustomerReview,functions:editCustomerReview,functions:withdrawCustomerReview,functions:approveCustomerReview,functions:rejectCustomerReview,functions:removeCustomerReview,functions:listPublishedCustomerReviews,functions:getOwnCustomerReview,functions:listOwnCustomerReviews,functions:listCustomerReviewModerationQueue,functions:getCustomerReviewModerationCase,functions:finalizeAccountDeletion,functions:sweepResolvedCustomerReviewReports
```

There are 16 review callables plus the existing finalizer and one new scheduled Function. No rules, Storage, media Functions or website deployment is included in these commands.

## Final local results

- 336 backend unit tests passed; 27 protected emulator entry points skipped outside the emulator.
- 28 real Auth/Firestore/Functions/Storage review emulator tests passed, including unauthorized-client denial, concurrent quotas, identical retry, both retention/new-cycle races, stale admin generation with deliberately reused expired request ID, and account erasure.
- 112 shared-contract tests passed; shared source/archive is unchanged from the reviewed identity batch.
- 95 selected customer/admin/Services/location/media website tests passed.
- Combined real customer/admin browser journey passed: empty explicit name/public disclosure/invalid focus; real commit with dropped response and identical retry; approval/display/reload; moderated name edit; keyboard rejection on mobile with private-note isolation; report drop/retry; overdue queue/case; cancel/resolve; quota rejection and rolling-window recovery; mobile dialog closure; withdrawal at the edit limit and reload persistence. Synthetic boundary counters/time passage were seeded explicitly.
- Three released Services browser regressions and two onboarding/display/deletion browser regressions passed on the final source.
- Functions and website lint, 17-locale parity, Firebase configuration checks, clean Functions deployment-package verification and fresh website build passed. Initial JavaScript is 193.86 kB gzip.
- Original 598 source hashes match the recovery manifest; roughly 12 GB free; no dependency installation needed in this batch.

Final logs use `policy-final-*` in the durable evidence directory. The accepted emulator log is `policy-final-emulator-accepted.log`; the shared log is `policy-shared.log`. Historical failed/startup logs are not substituted for these results. The code commit is the PR head; none of these tests establish deployed production behaviour.
