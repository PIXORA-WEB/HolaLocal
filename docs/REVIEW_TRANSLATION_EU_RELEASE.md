# EU review translation — disabled release approval package

## Source and approval boundary

PR34 targets main428cdbc08617d53e3498ffb5593e7200807dfa7c. Adds the tested EU changes from8c7aaa3/bde093e to the original translation PR, then explicitly wires the authoritative review callable to those settings. Does not enable provider selection, reviews or retention. No production merge/deployment is authorised yet.

Review options are fixed in customerReviewTranslation.js and consumed by customerReviewCallables.js through the existing providerFactory: translate-eu.googleapis.com, europe-west1,10seconds and no automatic upstream retries. Google cache version google_cloud-eu-europe-west1-nmt-v2 invalidates former global results. Same-language bypass is verified in adapter/service/browser. Messaging callers retain defaults; no messaging deployment is in scope. Internal logs retain only fixed phase/status, numeric code, endpoint/region and normalized languages, never raw text/messages/headers/credentials.

## Runtime access — activation blocker

Read-only inspection identifies1097633279895-compute@developer.gserviceaccount.com on listPublishedCustomerReviews. Direct project bindings: datastore.user, eventarc.eventReceiver, run.builder, run.invoker. None establishes Translation prediction/service usage permission. Effective Policy Troubleshooter requests returned403; inherited/deny/conditional policy is unverified. No IAM grants made. The new callable does not yet exist: verify its actual attached identity after deployment rather than assuming it matches.

Before selecting google_cloud, an administrator must establish cloudtranslate.generalModels.predict and serviceusage.services.use on holalocal-491c9 for that actual runtime identity (or approve narrowly scoped grants if missing). Existing local ADC permissions and successful synthetic API calls do not satisfy this check. No service-account keys. Translation API already enabled by the prior explicit test approval.

## PR33 and monitoring dependency

PR33 is offline preparation and need not be merged to compile/deploy this disabled source. Recommend merge PR33 first, resolve only current status documentation in PR34 against its merged main, recheck the final diff/tree and checks before PR34 approval. Do not assume a future combined tree hash equals this PR head. Both intermediate websites remain review-disabled; no translation requests should occur under production guards.

Before activation, update PR33's monitor service list from16 to17 with translatepublishedcustomerreview, and add a warning log alert for google_translation_failure (safe translation failures return unavailable rather than HTTP5xx). Monitor latency/errors, provider permission/quota failures, API usage/spend and cache effectiveness without content labels. Its existing cleanup/scheduler/finalizer monitors remain necessary. Craig's actual alert email/channel and response hours are unresolved placeholders; no backup responder exists. No cloud metrics/channels/policies/notifications were created. Budget alerts are not hard caps; production Translation quotas/monthly spend need approval. Provider call leases/cooldowns are not exactly-once billing guarantees.

## Exact later disabled deployment sequence

1. Approve concrete final merge source, merge PR34 only after PR33 reconciliation if PR33 goes first. Automatic Vercel deployment is website-only; verify exact commit/aliases, Services, /my-reviews and guarded admin routes. Neither review UI nor retention should activate.
2. Record current seven Function revisions, runtime identities/env and service IAM-check settings; keep CUSTOMER_REVIEW_TRANSLATION_PROVIDER absent/disabled and both existing gates closed. Build/package from the approved final source.
3. Deploy only:

```sh
firebase deploy --project holalocal-491c9 --only functions:translatePublishedCustomerReview,functions:submitCustomerReview,functions:editCustomerReview,functions:withdrawCustomerReview,functions:approveCustomerReview,functions:rejectCustomerReview,functions:removeCustomerReview
```

The six command exports preserve/invalidate cache with publication lifecycle. No rules, indexes, Storage, media, messaging, Scheduler or account-deletion finalizer deployment. Account erasure already removes the public projection/cache through existing deployed cleanup; current tests must continue confirming this.
4. New browser-facing callable may repeat the known organisation-policy public-invoker rejection. Separately approve disabling only its Cloud Run invoker IAM check if needed, preserving ingress/Auth/App Check/application gate; no allUsers or organisation-policy changes. Verify other six services retain their known settings after Firebase deploy. A partially failed deployment is not accepted.
5. Read-only acceptance: actual runtime identity, explicit EU source revision, provider disabled, both gates closed; endpoint OPTIONS succeeds and anonymous/authenticated callable requests reach handler then fail closed with no review/cache writes. Preserve production records; no synthetic production records/account deletion. Confirm deployment revisions and website aliases.

## Activation is separate

Needs runtime permissions, monitor recipients/delivery/coverage, quotas/budget, approved public-text data disclosure, native-language quality review, and explicit review gate/provider activation approval. Retention remains separately gated. Real full callable/provider/cache verification should use an authorised isolated environment; direct ADC probe + mock-provider emulator are complementary but do not prove runtime provider integration. Cloud deadline/quota/network failure behaviour is not exhaustively verified. No new paid test authorised here.

## Rollback

Keep provider selection disabled to prevent paid calls. If later active, disable provider selection and close review gate before code rollback; retention is separate. Restore prior website deployment/Function artifacts and recorded IAM-check states for only affected exports. New translation callable may be left disabled while prior six exports are restored. Global cache entries are ignored by the new namespace; old code must not reinterpret EU cache as global. Cache removal is not required for disabled rollback. Already processed provider requests cannot be undone or refunded; API enablement should not be reversed without checking other consumers. Do not redeploy unrelated resources or use the original mixed worktree build.

## Evidence distinctions

Durable final logs: review-evidence/review-translation-integrated. Real provider evidence remains review-translation-eu/revised-run (16 successes,1,184 characters). Backend units/fake provider and protected real Firebase emulator checks cover publication/visibility/revision/cache/erasure. Browser transport is mocked. Neither is claimed to be an end-to-end production provider test. Final counts and preview recorded in the PR update.

## Final integrated local verification

354 backend unit passes,28 protected skips;33/33 real Auth/Firestore/Functions/rules emulator passes with mock provider; Chromium390/1440 all17 UI languages, same-language bypass, original toggle, stale response/revision/failure/keyboard/escaping; Functions and website lint;17-locale parity; fresh website build and clean Functions deployment-package verification passed. The first emulator launch stopped safely for a missing cache path; rerun used the existing cached jars and passed. No paid requests or cloud mutations in this integration. Runtime permission inspection remained read-only.
