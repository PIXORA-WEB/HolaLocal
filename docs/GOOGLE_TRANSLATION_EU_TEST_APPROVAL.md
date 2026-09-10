# EU translation probe — approval pending

Prepared 2026-09-10 on a separate branch from PR #34 head abd621f14414adc245983ebbb276c2b5393e23ea. No provider execution, API enablement, IAM changes, deployment, merge or gate activation is authorised by this document.

## Concrete recommendation

Approve enabling only translate.googleapis.com in existing project holalocal-491c9 and one execution of the fixed EU probe, with a USD 0.03 translation-usage allowance before tax/currency conversion. No new project, keys, service accounts, deployments or production records. Stop on any credential/permission mismatch; do not grant additional roles automatically. Approval does not authorise a rerun.

## Read-only preflight

Translation API DISABLED; billing enabled; IAM Credentials API enabled. Current gcloud principal has cloudtranslate.generalModels.predict, serviceusage.services.use and serviceusage.services.enable. Existing local ADC is authorized_user and its quota project is already holalocal-491c9. This does not establish that ADC and CLI identities/permissions are identical: check the actual ADC principal's permissions read-only before enabling/executing. The existing runtime account is 1097633279895-compute@developer.gserviceaccount.com; current caller lacks iam.serviceAccounts.getAccessToken on it. No credentials are included here.

Prefer existing ADC for this local server-side SDK probe; no IAM grant or downloadable service-account key is needed if its permission preflight passes. Future deployed code should use its attached runtime service account. Impersonating that account locally would require a separately authorised narrowly scoped token-creator permission; it is unnecessary for the recommended test. Ordinary gcloud login is not equivalent to SDK ADC.

Minimum execution permissions: cloudtranslate.generalModels.predict and serviceusage.services.use on the consumer project. Enabling the API separately needs serviceusage.services.enable. The predefined roles/cloudtranslate.user is broader than the single prediction permission; do not add it when existing permissions suffice. See [IAM](https://docs.cloud.google.com/translate/docs/access-control) and [authentication](https://docs.cloud.google.com/translate/docs/authentication).

## EU adapter preparation

The existing adapter's location parameter previously changed only the request parent; its SDK client still used the global endpoint. This preparation adds an explicit allowlisted endpoint, endpoint-keyed client reuse, EU region validation, and an explicit pretrained NMT model. The probe pairs translate-eu.googleapis.com with europe-west1 and models/general/base. It never falls back to global. Existing application callers retain their defaults; neither provider selection nor production configuration changes.

Google documents EU data-at-rest and ML processing for this endpoint; a matching European request region is required. This is not a claim that all Google account/billing telemetry is EU-only. [Endpoint requirements](https://docs.cloud.google.com/translate/docs/advanced/endpoints).

## Exact outbound data and bounds

The only content is this fixed 74-character synthetic sentence:

`This is a synthetic review of a fictional service for translation testing.`

One sequential request per target: en, es, fr, de, nl, pt, pl, ro, cs, sk, hu, uk, it, sv, da, fi, no. Body fields are contents containing the sentence, sourceLanguageCode en, targetLanguageCode, mimeType text/plain, parent projects/holalocal-491c9/locations/europe-west1, and that parent's models/general/base path. Maximum 17 requests / 1,258 input code points including spaces. English-to-English is intentional adapter/provider coverage; a failure stops the probe and is not silently skipped.

Transport metadata includes OAuth authentication identifying the Google principal, quota/billing project, parent routing headers, SDK/client-version information and network source IP; Google may generate operational request identifiers. Tokens must never be printed. No Firebase tokens, browser cookies, review/business/account IDs, reviewer names, emails, ratings, reports or private notes are supplied as application data. Future production translation would send the current published review text instead, which can itself contain user-written personal information; it would not send separate reviewer identity fields. That is a separate activation approval.

10-second SDK RPC timeout, retries explicitly disabled, stop on first failure, 210-second process deadline. A timeout may still have incurred usage; there is no automatic rerun. Bound is per authorised invocation, not an account-wide billing cap. Output contains only synthetic translations and safe error categories. No Firestore cache or business data is read/written by the probe.

Google says submitted content is not used to train its translation features and is held briefly in memory for translation. [Data usage](https://docs.cloud.google.com/translate/data-usage).

## Cost and commands — NOT executed

At USD 20 per million NMT input characters: 1,258 × 20 / 1,000,000 = USD 0.02516 (2.516 cents). Available monthly NMT credit may reduce that to zero; credit availability was not checked. Allow USD 0.03 before taxes/local-currency pricing. There is no dedicated compute, model training, storage, Scheduler or new Firebase resource in this test. API enablement has no separate resource purchase; it enables billable usage for authorised callers. Existing project operations/logging costs remain separate. [Pricing](https://cloud.google.com/products/translate/pricing).

After explicit approval and actual ADC permission preflight only:

```sh
gcloud services enable translate.googleapis.com --project holalocal-491c9
cd ~/Projects/HolaLocal-worktrees/review-translation-eu-probe/functions
node scripts/checkReviewTranslationProvider.mjs holalocal-491c9 --execute-paid
```

Use Node 20. The safe default --plan has been executed locally. Do not execute an older global probe from PR #34. Do not disable the API afterward without checking for other consumers and obtaining approval; stop further test calls instead.

## Verification and production separation

11 adapter unit tests pass, including EU parent/model, bounded RPC options, invalid host/region rejection, no fallback/retry, and preserved global requests. Offline plan confirms all 17 targets and exact character/request bounds. These are injected-client/local checks, not real-provider evidence.

Real-test acceptance: every target returns a nonempty response through the EU adapter; no global fallback, more than 17 calls, raw credentials, or real user data. Record failed target/category and stop on failure. Translation quality still requires human review; this short probe does not prove live callable IAM, cache integration, moderation privacy or every failure scenario.

Production is separate: integrate/review the adapter option, explicitly wire the review provider factory/callable to the EU endpoint and region, use a location-specific provider cache version, verify runtime identity permissions and rerun focused configuration/integration tests before any deployment. PR #34 currently remains global-default and must not be represented as EU-configured. Provider deployment, monitoring, privacy notice and review/retention activation remain separately approved work. PR #33 and PR #34 remain untouched/unmerged.
