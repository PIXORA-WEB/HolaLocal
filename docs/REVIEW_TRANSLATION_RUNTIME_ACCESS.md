# Runtime access verification and conditional minimum grant — NOT executed

Confirmed deployed listPublishedCustomerReviews account:1097633279895-compute@developer.gserviceaccount.com, project holalocal-491c9, region europe-west1. Direct project roles read previously: roles/datastore.user, roles/eventarc.eventReceiver, roles/run.builder, roles/run.invoker. These do not establish cloudtranslate.generalModels.predict or serviceusage.services.use. Effective Policy Troubleshooter returned403; inherited/conditional/deny permissions remain UNVERIFIED, not confirmed denied. Successful user ADC tests prove only that user principal's access. New translatePublishedCustomerReview is not deployed; verify its actual identity after deployment before any permission decision.

## Minimum administrator read-only check

Run using an existing administrator identity with permission to inspect relevant IAM policies/troubleshoot, not a new grant to the runtime:

```sh
gcloud functions describe listPublishedCustomerReviews --gen2 --region=europe-west1 --project=holalocal-491c9 --format='value(serviceConfig.serviceAccountEmail)'
gcloud policy-intelligence troubleshoot-policy iam //cloudresourcemanager.googleapis.com/projects/1097633279895 --principal-email=1097633279895-compute@developer.gserviceaccount.com --permission=cloudtranslate.generalModels.predict --project=holalocal-491c9
gcloud policy-intelligence troubleshoot-policy iam //cloudresourcemanager.googleapis.com/projects/1097633279895 --principal-email=1097633279895-compute@developer.gserviceaccount.com --permission=serviceusage.services.use --project=holalocal-491c9
```

After separately authorised disabled Function deployment repeat the describe command for translatePublishedCustomerReview and troubleshoot the actual returned account. Pass only if both effective decisions are GRANTED, with all relevant conditions and deny policies evaluated. UNKNOWN/403 is blocked, not permission to grant blindly. If the commands differ in the installed SDK, the equivalent Policy Troubleshooter accessTuple is principal serviceAccount:EMAIL, fullResourceName //cloudresourcemanager.googleapis.com/projects/1097633279895, and each permission above. No translation request required.

## Conditional proposal — requires separate approval only if access is confirmed missing

Project custom role holaLocalReviewTranslation with exactly cloudtranslate.generalModels.predict and serviceusage.services.use. Grant only to the verified runtime account on holalocal-491c9. Do not grant Editor, Owner, broad Translation Admin, allUsers, Token Creator or create keys. Check whether the custom role already exists before creation; do not overwrite an unrelated role.

```sh
gcloud iam roles create holaLocalReviewTranslation --project=holalocal-491c9 --title='HolaLocal review translation' --permissions=cloudtranslate.generalModels.predict,serviceusage.services.use --stage=GA
gcloud projects add-iam-policy-binding holalocal-491c9 --member=serviceAccount:1097633279895-compute@developer.gserviceaccount.com --role=projects/holalocal-491c9/roles/holaLocalReviewTranslation --condition=None
```

These commands are a proposal, not authorised execution. Confirm actual account before substitution/use. This is a shared runtime account: the grant would allow its other workloads to use Translation too. A dedicated review-translation runtime account offers tighter workload separation but would require a separately reviewed identity/deployment and necessary Firestore/logging permissions; do not silently change identity in this release. No new role or binding is necessary for the disabled rollout itself.

Record IAM policy/etag and existing matching bindings before change. If newly added, rollback removes only that exact new binding after disabling provider selection; do not remove preexisting access or delete a role still in use. Never relax organisation/deny policies to force a pass. Retest effective permissions after a grant. Runtime paid-provider validation still requires separate test approval and must not use real review data while gates are closed.
