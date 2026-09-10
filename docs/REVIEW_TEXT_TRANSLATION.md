# Automatic review text translation — disabled release candidate

Based on main428cdbc. No merge, deployment, provider activation, paid request or notification is authorized by this candidate. PR33 operations preparation and the upload/retry investigation remain separate.

## Authoritative implementation

Reuses shared customerReviewTranslationCacheKey and the existing Google/disabled/mock provider factory. The shared file existed but lacked a package subpath export; adds that export and refreshes the vendored archive/lock. No alternative provider, copied review source service or client-supplied text endpoint.

Adds translatePublishedCustomerReview to the existing callable registry and default-off review gate. It accepts EXACTLY publicReviewId, publishedRevision and one of17 targetLanguage codes. Anonymous readers may request only an already-published projection belonging to a currently public-eligible business, matching existing public review reads. Unknown/stale/private/pending/rejected/removed targets cannot supply source text. Only stored originalText and optional source-language hint reach the provider; display names, account identity, pending revisions, reports and private notes never do. The response contains target/version/status and translated text only. The same check runs on cache hits and after provider completion, preventing stale resurrection after deletion, new publication or business suspension. Current Auth/App Check wrapper behaviour remains unchanged; this is not a new claim of mandatory App Check enforcement.

Cache is a bounded translationCache field on customerReviewsPublic/{publicReviewId}, not a new public cache collection. The field stores providerVersion, publishedRevision and up to17 language entries using the existing cache key. Maximum translated result8000 Unicode code points bounds document size; control-character/empty/oversized output is rejected. Clients cannot read/write this collection directly under existing rules. The public list projection does not include cache/lease fields.

The authoritative command handler preserves cache only when the approved original and revision remain identical (including pending edits/rejections); publishing a new revision replaces it. Withdrawal/moderator removal/account erasure delete the document and cache together through existing handlers. No new cleanup worker, TTL, index or finalizer code change. Hidden businesses can retain stored cache but it cannot be returned while unavailable.

A60-second transactional lease deduplicates simultaneous requests per language/revision/provider. Failed attempts have30-second backoff; provider calls happen outside Firestore transaction callbacks. Leases expire after process loss; this bounds duplicate work, but is not a billing cap or exactly-once guarantee after provider-side success with a lost response. Re-requesting after lease expiry can bill again. Production quota/budget controls remain necessary.

The existing Google adapter accepts an optional request timeout. Reviews pass10seconds and disable upstream automatic retry; messaging callers keep their previous default behaviour. Provider failures return safe unavailable results, never upstream diagnostics. ProviderVersion is an explicit deployment namespace (currently provider-name-v1); bump it whenever model, endpoint, settings or provider behaviour changes. Google may update NMT behind the same model: this cache is not a claim of model-version pinning.

## Website behaviour

Public review bodies request translation automatically when the site language or published revision changes. UI uses original text during loading/failure, labels machine translations and offers Show original/Show translation with native keyboard buttons. Names stay untouched. React escapes translated text; it is never inserted as HTML. A response must match ID/revision/language; effect cleanup ignores late language/revision/unmount responses. No browser-persistent translation cache bypasses server visibility checks. Pending backend responses receive at most2 bounded retries; an individual browser request times out after15seconds. Author/pending editing panels deliberately retain original input; they never send private drafts for translation.

All17 interface target codes are handled. Translation quality/provider support remains subject to real-provider verification; authored labels and automated tests are not native-speaker editorial approval.

## Provider preflight and approval requirements

Read-only production inspection10September2026: no CUSTOMER_REVIEW_TRANSLATION_PROVIDER is configured on existing review Functions; MESSAGE_TRANSLATION_PROVIDER is absent on translateCreatedMessage as well (defaults disabled). This confirms no configured provider selection, not whether the paid API happens to be enabled for other uses. Both review/retention gate variables remain absent/closed. No credentials printed or paid calls made.

Recommended reuse: Google Cloud Translation Advanced v3 NMT via the existing @google-cloud/translate adapter. It uses Application Default Credentials on the server. A deployed runtime should use its attached service account with an appropriate translation role (roles/cloudtranslate.user or reviewed narrower equivalent), API access and a billing/quota project; do not put keys in Vite, browser storage or Git. Local provider verification would require separately authorized ADC setup, e.g. `gcloud auth application-default login --project=APPROVED_PROJECT`, and approval for bounded synthetic paid requests. gcloud CLI sign-in alone is not necessarily ADC. [Authentication](https://docs.cloud.google.com/translate/docs/authentication), [IAM](https://docs.cloud.google.com/translate/docs/access-control).

The existing adapter uses the GLOBAL endpoint/location. It does not promise EU-only processing. Google states API content is not used to train its translation models. Before paid tests/activation approve the provider/data handling disclosure and processing-location choice; if EU-only processing is required, configure and test the existing adapter's endpoint/location capability in a reviewed follow-up rather than silently using global. No regional configuration is claimed here. Only public moderated review body text would be submitted; originals stay in Firestore. [Data usage](https://docs.cloud.google.com/translate/data-usage), [EU endpoints](https://docs.cloud.google.com/translate/docs/advanced/endpoints).

Current published NMT price is US$20/million input characters after any applicable shared allowance. Example:100 reviews x500characters x16 non-source targets =800,000 characters, US$16 before allowance, cached for the published revision/provider. Revisions, expired failed attempts or changed provider namespaces can cause additional calls. Firestore cache reads/writes/storage and callable compute also bill. Before configuration approve a monthly budget and enforce an appropriate Translation API quota; a budget alert is NOT a hard cap. No billing settings/resources changed. [Pricing](https://cloud.google.com/products/translate/pricing).

## Verification boundaries and later release order

Local evidence is recorded in durable review-evidence/review-translation. Unit tests use fake transactions and injected SDK errors; emulator tests use real Firestore/Auth/Functions/rules but the existing mock translator. Browser tests use the real component/i18next/styles at390/1440 with fake transport for deterministic failure and stale-response timing. These do not establish real-provider translations, quality, production IAM for the new callable or Google deadlines.

Before paid provider verification: approve project/budget/data-location and credential access; use synthetic strings only, target all17 languages, verify detected source and response text, real timeout/quota/auth failure behaviour where safe, repeated cache-hit request and one source-revision change. No production review records or personal content are needed for direct adapter verification. Full cloud cache/permissions testing requires an authorized isolated environment and a separately reviewed non-emulator activation gate; current production gates intentionally refuse it.

After this candidate is reviewed, a disabled website merge can precede backend deployment safely. Firebase scope would be the new translatePublishedCustomerReview plus the six existing command exports submitCustomerReview, editCustomerReview, withdrawCustomerReview, approveCustomerReview, rejectCustomerReview and removeCustomerReview, using the fresh contract package. The six command updates preserve the approved cache during pending edits; omitting them would leave the older cache-dropping behaviour. Deploy this exact scope only after approval:

```
firebase deploy --project holalocal-491c9 --only functions:translatePublishedCustomerReview,functions:submitCustomerReview,functions:editCustomerReview,functions:withdrawCustomerReview,functions:approveCustomerReview,functions:rejectCustomerReview,functions:removeCustomerReview
```

 No rules, Storage/media functions, Scheduler, indexes or finalizer deployment required. Creation will encounter the known public-invoker/domain-policy conflict; explicitly approve only this new service's `--no-invoker-iam-check` setting if effective policy still permits, preserve IAM bindings/ingress and verify normal browser preflight and disabled handler responses. Do not rerun16 existing invoker updates. Keep CUSTOMER_REVIEW_TRANSLATION_PROVIDER absent/disabled at this stage and both review/retention gates closed.

PR33 monitoring currently lists16 review callables: add the new17th service to its monitored set before activation, without merging unrelated work here. Before public activation also require provider verification/budget/operational ownership, real cloud retention acceptance and a reviewed gate change: environment flags alone still cannot activate reviews. Retention remains separate and unchanged.

Rollback the website to its recorded prior deployment if necessary; leave old clients/callables compatible. Closing review access disables this callable as well. The old command implementation may drop caches on pending edits, causing later retranslation but no private data exposure. Do not deploy the provider change to unrelated messaging functions as part of this scope. Retain erasure and90-day report cleanup for real data; no rollback may restore synthetic policies.

## Reproducible provider probe (NOT executed against Google)

`node functions/scripts/checkReviewTranslationProvider.mjs APPROVED_PROJECT --plan` is offline. After separate paid-request/data-location approval and ADC setup, `node functions/scripts/checkReviewTranslationProvider.mjs APPROVED_PROJECT --execute-paid` performs at most17 requests using one fixed synthetic sentence and prints only synthetic results/safe error categories. It uses the existing global adapter with10-second request deadline and no automatic retry. Never substitute personal review text. A successful probe verifies actual provider transport/output for the17 targets, not Firestore cache lifecycle, quality certification or production activation. The plan prints the exact character count so cost is reviewable before execution.

## Fresh local verification

- Final protected emulator suite:33 passes, including anonymous HTTP translation for17 targets, real transaction lease/cache behaviour, authoritative pending-edit/approval/withdrawal invalidation, cached account-erasure cleanup and direct-client rules denials.
- Backend unit suite:345 passes,28 protected emulator skips; added focused successful transient-recovery/provider-version regression also passes.
- Shared contracts:112 passes. Focused website regression tests:56 passes.
- Real Chromium component test at390/1440: all17 language targets, original/translation keyboard toggle, unchanged name, late response suppression, revision switch, failure fallback and escaped provider output; uses fake transport and does not claim real-provider success.
- Functions/website lint,17-locale checks, fresh website build and clean Functions deployment-package verifier pass. Package imports the new contract export and all17 callables reject by default before dependency construction.
- About12GB free; heavy suites ran sequentially with existing dependencies/emulator cache. Initial package-export and emulator-cache-path failures were corrected and rerun; no test result from the old interrupted task was substituted.
- Read-only provider preflight and all logs/screenshots are in durable review-evidence/review-translation. No paid provider test, deployment, production review data mutation or gate change performed. Native-language editorial quality and real-provider/cloud acceptance remain unverified.
