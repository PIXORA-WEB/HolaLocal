# Dedicated review Translation identity — preparation only

Baseline main: 2e49239b8f96bb5d9aee55760142edec136d7bb2. No account, IAM, Function, provider or activation change applied. PR44 remains separately unpublished at c32a06dbbde78e3915106b1d7dbd9bb9e0418161. Its approved registration-only 18+ self-confirmation preserves existing accounts and browsing. Address and applicable legal particulars remain in the private publication checklist. Reviewed application tests remain reusable; no legal source changes in this batch.

## Exact proposed identity and bindings

Project holalocal-491c9 (1097633279895), region europe-west1.
Create account holalocal-review-translation@holalocal-491c9.iam.gserviceaccount.com; no downloadable keys.
Create project role projects/holalocal-491c9/roles/holalocalReviewTranslationCaller from translation-role.json: cloudtranslate.generalModels.predict and serviceusage.services.use only. Bind on project to the new account, unconditional. This is not a geography or spend cap; authoritative provider pins translate-eu.googleapis.com and europe-west1, no global fallback.
Create project role projects/holalocal-491c9/roles/holalocalReviewTranslationCache from firestore-role.json: datastore.databases.get, datastore.entities.get, datastore.entities.create, datastore.entities.update only. Project binding condition: resource.name == "projects/holalocal-491c9/databases/(default)". Exact manifests in bindings.json are additive proposals, NOT complete replacement project policies.

## Firestore minimum and limits

Source traces customerReviewTranslation.js through createCustomerReviewFirestoreDatabase: transaction point reads of customerReviewsPublic and businesses; set writes to existing public-review cache; no query/list/delete. Real installed SDK serialization test confirms set emits update with no exists precondition. Google commit contract requires BOTH create and update for that form. Begin/rollback require databases.get; batchGet requires entities.get. These four are the documented minimum for unchanged wire behavior, verified against the installed serializer. No roles/datastore.user, delete, list, index, database administration, Auth-admin, Storage or logging-writer grant proposed. Runtime stdout is captured by the platform.

The role can read, create and update ANY document in the default database if code using that identity requests it. It is NOT limited to collections, fields, public content or cache. No collection restriction is claimed. IAM conditions support database boundaries; server SDK bypasses client rules. Application publication/revision checks remain essential. No production restricted-role transaction has run; conditional binding and complete end-to-end sufficiency remain deployment acceptance checks, not emulator-proven IAM facts. Removing create would require a separate verified change to the write contract, not a silently missing permission.

Sources: https://firebase.google.com/docs/firestore/security/iam (batchGet, beginTransaction, commit, rollback table); https://cloud.google.com/firestore/docs/manage-databases (per-database IAM condition). These sources and SDK serialization establish the proposed minimum, not successful deployed IAM access.

## Deployer and Google service agents

Read-only current project policy: user:hello@pixora.es has unconditional roles/owner; service-1097633279895@gcf-admin-robot.iam.gserviceaccount.com has roles/cloudfunctions.serviceAgent; service-1097633279895@serverless-robot-prod.iam.gserviceaccount.com has roles/run.serviceAgent; service-1097633279895@gcp-sa-cloudbuild.iam.gserviceaccount.com has roles/cloudbuild.serviceAgent. Preserve them; no new grants proposed for these principals.

Deployer needs existing serviceAccounts.create, roles.create, project get/setIamPolicy for approved provisioning; cloudfunctions get/update/source build access for deployment; iam.serviceAccounts.actAs on the new account. Recheck effective actAs once it exists; if unexpectedly denied STOP and report exact policy reason. Do not add project impersonation. A narrowly scoped roles/iam.serviceAccountUser binding on only the new account would be a fallback requiring separate approval, not part of this proposal.

Functions service agent needs actAs/token access to run the selected identity; Run service agent needs its existing runtime-token/image infrastructure rights. Existing same-project service-agent roles are the supported baseline; do not grant those roles to the runtime account. Build identity/source repository permissions stay as currently deployed. No cross-project service-account arrangement, keys, allUsers, organisation or ingress change.

## Authoritative source change

Only translatePublishedCustomerReview onCall options in functions/src/index.js gain serviceAccount. PUBLIC_CALLABLE_OPTIONS and other 44 identities are unchanged. EU adapter, service, guards and feature controls unchanged. Translation is intentionally a public published-content operation, not newly made login-only; Firebase callable token/App Check processing and private/admin operation authentication remain unchanged.

Important existing deployment caveat: PUBLIC_CALLABLE_OPTIONS has invoker public, while organisation policy rejected allUsers and current Cloud Run invoker IAM check is disabled for browser callables. Firebase may repeat the rejected grant or overwrite manual settings. Capture and recheck this service configuration; do not grant allUsers or bypass org policy. This approval package does NOT include an IAM correction beyond the two dedicated-account bindings. If Firebase deployment requires reapplying invoker-IAM-check-disabled, changing ingress, allUsers, or any further IAM correction, STOP and report the precise change for separate approval. Do not silently repair it. Worker authenticated access must not change.

## Corrected offline image

sha256:45366cc7b6d76da010f8a126e562fac7d631b4b6e6cd6c3559c4523e5bfc6593, linux/amd64, non-root 33:33. Assembled from preserved verified base and locked dependencies plus new probe and exact export source. Default --plan. Not uploaded. Durable OCI: review-evidence/legal-review-launch/dedicated-runtime-image. Shared layer hardlinks avoid duplicate dependencies and preserve prior evidence. runtime-probe.mjs expected identity is the dedicated account; job name holalocal-review-translation-identity-probe; approval marker dedicated-identity-candidate-v1. Previous executed image/ledger remains untouched and consumed.

## Separate acceptance A: runtime provider (NEW approval needed)

After identity deployment, verify actual Function identity and Job readback. Temporary Job same dedicated identity, one task/parallelism1/retries0, timeout60s, 1CPU/512MiB. One English-to-Spanish request, exact 74-character synthetic text in probe; translate-eu.googleapis.com, europe-west1, no retries/fallback. Runtime metadata identity and project Translation permission prechecks must pass before provider call. Memory-only fixtures/cache; no Firestore writes. Same-language bypass, cache hit, stale revision, unavailable and removed rejection checks. No customer content. Preserve sanitized results; remove only this temporary Job and exact diagnostic digest/tag after completion. New durable execution ledger prevents reruns.

Proposed total allowance US$0.03 before credits/tax/FX: Translation estimated $0.00148, one-minute Job roughly $0.00114, small transient image/log costs; no Cloud Build for diagnostic, scanning must remain disabled. These are estimates, not hard billing enforcement. Bound request/task duration and check settings before run. No automatic retry even on failure. Permission success alone is not provider success; provider success is not linguistic quality approval.

## Separate acceptance B: deployed Firestore/cache (not authorised)

Provider Job does NOT test deployed Firestore writes. With controls closed, verify identity/configuration, unauthorised/disabled callable response, and no data-changing path. A successful real cache transaction through normal callable requires the review gate and Google provider enabled plus an eligible genuine published review. Never seed public synthetic records in production to manufacture this.

Recommended smallest production check, subject to later explicit activation/data approval: choose one consenting genuine customer's already approved review with <=74 characters in English, one supported Spanish target. Record public revision and cache absence read-only without exporting content/identity. Through normal callable request translation once, repeat same revision/target once (cache hit), reload once using same target (cache hit); same-language request must return original without provider. Bound to 3 translated-target requests +1 original request, at most one 74-character provider call. Capture sanitized request statuses and cache revision/providerVersion readback. Expect lease then translated entry, original text/revision/business unchanged, no duplicate provider call. Do not edit/withdraw genuine content for tests; race/revision/withdrawal negatives remain local/emulator unless separately authorised.

Expected writes: two cache transactions (lease/result), point reads for each request; Firestore retries may add reads and cannot be proven zero from browser alone. Proposed separate $0.03 allowance covers provider, Function and small operation counts; no other users' traffic included in that estimate. Cleanup: temporary local capture only; legitimate translation cache remains normal product data until normal revision/removal/erasure invalidation. Do not delete a genuine review/cache as test cleanup. If no eligible review or controlled activation is acceptable, this check is BLOCKED; an isolated Firebase project with reviewed test-only configuration is the alternative and needs its own setup/cost approval. No synthetic public production records or hidden gate bypass.

## Deployment order (only after concrete approval)

1. Verify current main/candidate and fresh read-only Function/IAM/gate snapshots; record revision translatepublishedcustomerreview-00001-hop and old account 1097633279895-compute@developer.gserviceaccount.com; refresh if advanced. Stop on unexpected differences.
2. Merge this focused PR into current main through normal required checks. This authorises the usual automatic Vercel production build/deployment even though apps/, shared/, root configuration and lockfiles are unchanged. Verify resulting website commit/aliases without generating Analytics traffic. This merge does not deploy Firebase. Require the resulting source tree to equal the reviewed PR tree if main remains unchanged; stop/reverify if main advances. Keep PR44 separate and unpublished.
3. Provision ONLY dedicated account, two custom roles and two additive bindings. Use fresh etag-aware project policy; preserve all other roles. Confirm no inherited extra privileges; test actAs and permission support. No grant to old shared account.
4. Deploy reviewed merged-main source with all controls unchanged/closed: firebase deploy --project holalocal-491c9 --only functions:translatePublishedCustomerReview. Capture build/revision. No other Functions, rules, indexes, Storage, website or Scheduler deployment. Check callable IAM caveat above before proceeding.
5. Verify identity, EU options, closed review/provider/retention/recovery controls, ingress, callable preflight and disabled handler, all other Function/worker configurations unchanged. Disabled handler is not positive Firestore access verification.
6. Only with fresh bounded-test approval run acceptance A once and clean up. Stop on failure; no grants/retry automatically.
7. Keep activation closed; present results and PR44/legal publication requirements. Acceptance B requires separately approved controlled activation/data scope. Do not conflate readiness with activation.

Account/role creation itself has no proposed service subscription; Function deployment can incur normal Cloud Build/Artifact Registry charges. Diagnostic and acceptance allowances do not purport to cap unrelated production spend; €30 alert unchanged, no new quotas.

## Rollback

Before change save policies, Function export/config, revision and gate values. Keep gates closed (or first close provider/review gates if later activated). Restore only translation export's old identity from baseline and redeploy that Function using current compatible source, preserving unrelated released fixes. Recheck callable IAM setting. Only after no Function/Job uses new identity remove exact two new bindings, then custom roles/account if unused. Never delete shared identity or alter worker bindings. Completed requests/billing cannot be undone; legitimate cache is not automatically erased. No destructive rollback of review data.

## Remaining approval boundaries

This package is preparation only. New identity does not exist and its effective permissions cannot yet be empirically tested. No cloud diagnostic repeat is authorised. Legal publication/activation remain pending; mandatory address and applicable particulars unresolved privately. Production cache acceptance needs eligible approved data and controlled activation approval. Existing bundle-budget failure remains unchanged; this batch has no website runtime changes.

## Completed local verification

20 focused tests passed: identity export, actual SDK write serialization, translation/cache service, callable guards and Firestore adapter. Functions lint and git diff --check passed. OCI base layer checksums verified; revised image default plan and self-test started non-root with network namespaces isolated. Simulated provider success/cache hit, failure/no retry and wrong shared-account identity rejection passed; the last stopped before token/provider access, zero requests/characters. One test-mount setup failed before startup and was corrected; it was not a diagnostic execution. No cloud runtime result is claimed. Existing website tests are reused because website source is unchanged; bundle limit remains unchanged.

## Commands for later approved provisioning (NOT executed)

Run from this directory, only after refreshed IAM checks/approval. Inspect existing role names first; never replace an unrelated existing role.

```sh
gcloud iam service-accounts create holalocal-review-translation --project=holalocal-491c9 --display-name='HolaLocal review translation'
gcloud iam roles create holalocalReviewTranslationCaller --project=holalocal-491c9 --file=translation-role.json
gcloud iam roles create holalocalReviewTranslationCache --project=holalocal-491c9 --file=firestore-role.json
gcloud projects add-iam-policy-binding holalocal-491c9 --member='serviceAccount:holalocal-review-translation@holalocal-491c9.iam.gserviceaccount.com' --role='projects/holalocal-491c9/roles/holalocalReviewTranslationCaller' --condition=None
gcloud projects add-iam-policy-binding holalocal-491c9 --member='serviceAccount:holalocal-review-translation@holalocal-491c9.iam.gserviceaccount.com' --role='projects/holalocal-491c9/roles/holalocalReviewTranslationCache' --condition='expression=resource.name=="projects/holalocal-491c9/databases/(default)",title=review_translation_default_database'
```

These commands modify only their named bindings, not the complete policy; retain before/after etags and verify every unrelated binding remains intact. Stop on errors or unexpected existing resources. Account/roles/grants/Function deployment/diagnostic remain unexecuted.

## Focused PR release checkpoint

Current main reverified 2e49239b8f96bb5d9aee55760142edec136d7bb2; unchanged since preparation. No rebase or runtime integration change necessary. The 20 tests, Functions lint and offline image verification remain applicable; this follow-up modifies release instructions only. No new provider test, website traffic or cloud mutation. Verify PR base/head, mergeability and required checks before merge; do not bypass the known website bundle-budget failure. The source merge and resulting automatic Vercel deployment precede scoped Firebase provisioning/deployment. If required checks block, stop. Paid diagnostic and review/provider/retention/recovery activation are explicitly excluded from this release approval.
