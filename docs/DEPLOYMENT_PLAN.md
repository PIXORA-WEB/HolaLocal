# HolaLocal Early Access Deployment Plan

## Purpose

This plan describes the controlled sequence for releasing the HolaLocal website as Early Access.

It is designed to avoid:

- deploying clients before required callable Functions exist;
- running queries before Firestore indexes are ready;
- applying tightened rules before production data is canonical;
- exposing hidden contact data;
- breaking older website or mobile clients prematurely;
- losing the ability to roll back a production data repair.

## Release Scope

### Included

- Website Early Access
- Customer registration and profiles
- Business registration and onboarding
- Business profile creation and editing
- Submit-for-review workflow
- Controlled moderation backend
- Public directory and business details
- Website messaging
- Contact privacy
- Existing 17 website locales

### Deferred

- Mobile messaging
- Mobile business creation
- Full mobile parity
- Translation activation
- Full admin dashboard
- Multi-business support
- Advanced moderation UI
- Mobile bundle optimisation

## Release Candidate

- **Branch:** `feature/full-production-site`
- **Commit:** `cc7456e`
- **Commit subject:** `Prepare HolaLocal Early Access release candidate`

No release should use a different commit without another review.

## Current Production Baseline

Latest confirmed read-only audit:

- Users: 2
- Businesses: 1
- `businessPrivate`: 1
- Conversations: 0
- Reports: 0
- Duplicate groups: 0
- Privacy errors: 1

Known blocking production finding:

- Hidden public `contact.website` value in one business document.

## Verified Backup

- **Bucket:** `gs://holalocal-491c9-firestore-backups`
- **Export prefix:** `contact-privacy-repair-20260716T173016Z`
- **Collections:** `businesses`, `businessPrivate`
- **Export status:** `SUCCESSFUL`

Keep this export until:

- the repair is complete;
- the post-repair audit passes;
- the deployment is complete;
- the rollback window has closed.

## Phase 1 – Production Privacy Repair

### Preconditions

- [x] Fresh production audit complete
- [x] Narrow repair dry-run complete
- [x] Expected target count: 1
- [x] Actual target count: 1
- [x] Proposed mutation count: 1
- [x] Private value already preserved
- [x] Drift: 0
- [x] Backup/export successful
- [ ] Dry-run revalidated immediately before repair
- [ ] Separate explicit repair approval received

### Planned mutation

Remove the hidden website value from the public business document:

`businesses/gZqsAxfWwLO66dGBGxJL.contact.website`

Do not change the private value in:

`businessPrivate/gZqsAxfWwLO66dGBGxJL`

### Required controls

- exact production project confirmation;
- expected target count;
- mutation ceiling;
- document fingerprints;
- Firestore `lastUpdateTime` precondition;
- explicit `--apply`;
- exact confirmation phrase;
- no unrelated field changes.

### Post-repair gate

Immediately rerun the production read-only audit.

Proceed only if:

- audit completes successfully;
- privacy errors equal `0`;
- no new critical errors appear;
- document counts remain expected;
- no duplicate group appears.

## Phase 2 – Deploy Firestore Indexes

Deploy required indexes before website code depends on them.

### Gate

- index definitions reviewed;
- production project confirmed;
- no unintended index deletion;
- index deployment command reviewed.

### Verification

- required indexes reach ready state;
- directory query using `status` and `publishedAt` succeeds.

## Phase 3 – Deploy Firebase Functions

Deploy the callable backend before the new website.

Required callables:

- `updateAccountRole`
- `ensureOwnerBusiness`
- `sendMessage`
- `moderateBusiness`

Translation Functions may be deployed only with the provider still disabled unless separately approved.

### Gate

- Functions unit tests pass;
- Functions lint and syntax checks pass;
- isolated emulator harness passes;
- production region confirmed as `europe-west1`;
- translation provider default is `disabled`;
- production environment configuration reviewed.

### Smoke tests

- authenticated role transition;
- first owner business creation;
- manager-only owner creation rejection;
- message send and retry idempotency;
- moderator operation with correct claim;
- ordinary user moderation rejection.

Stop if any callable returns unexpected authentication, permission or schema errors.

## Phase 4 – Deploy Website

Deploy the reviewed release candidate only after indexes and Functions are available.

### Gate

- production website environment variables confirmed;
- build passes;
- bundle gate passes;
- routes and compatibility tests pass;
- Functions endpoints are available;
- contact privacy repair has passed its post-repair audit.

### Immediate checks

- homepage loads;
- SPA route refresh works;
- sign-in and registration load;
- directory query works;
- business details route works;
- legal pages load;
- no debug routes or mock controls are exposed.

## Phase 5 – Deploy Firestore and Storage Rules

Deploy tightened rules after:

- production data is canonical enough for the new allowlists;
- the new website is live;
- required Functions are live;
- old-client impact is accepted.

### Gate

- emulator rules tests pass;
- production audit has no blocking schema/privacy errors;
- no unresolved legacy key issue affects current production documents;
- rollback and stop conditions are understood.

### Verification

- direct client message creation is rejected;
- direct role promotion is rejected;
- direct `businessId` mutation is rejected;
- valid profile edits succeed;
- valid business draft edits succeed;
- public eligible business reads succeed;
- unpublished business reads fail safely.

## Phase 6 – Browser and End-to-End QA

Perform the checklist in `RELEASE_CHECKLIST.md`.

Minimum required journeys:

1. Customer registration, verification, profile and messaging.
2. Business registration, role transition, business creation and submission.
3. Moderator publication.
4. Public directory/detail visibility.
5. Mobile-width navigation and forms.
6. Legal and consent flows.
7. Message retry without duplication.

## Phase 7 – Post-Deployment Verification

Run:

- production read-only audit;
- website smoke test;
- callable smoke test;
- directory and detail checks;
- message send/retry check;
- rules verification.

Record results in `RELEASE_LOG.md`.

## Stop Conditions

Stop the release immediately if:

- project/account does not match the approved production project;
- backup/export cannot be verified;
- privacy-repair dry-run detects drift;
- mutation target count differs from 1;
- post-repair audit reports any new error;
- required Firestore index is missing;
- a callable is unavailable or returns unexpected errors;
- new website depends on a missing backend;
- tightened rules reject a valid core workflow;
- hidden contact values are publicly visible;
- unpublished businesses appear publicly;
- duplicate messages or preview regressions occur;
- browser QA finds a core workflow failure.

## Rollback Strategy

### Production repair

Use the verified Firestore export and field-level preconditions. Restore only the affected public contact fields if rollback is necessary. Do not blindly replace the entire document.

### Website

Redeploy the previous known-good website build if a critical runtime issue appears.

### Functions

Redeploy the previous known-good Functions version if a callable is defective and the client can remain compatible.

### Rules

Restore the previous reviewed rules only if the tighter rules break legitimate production workflows. Do not leave insecure rules in place longer than necessary.

### Indexes

Do not delete indexes during the release unless explicitly reviewed.

## Final Launch Gate

HolaLocal may be announced as Early Access only when:

- production privacy repair is complete;
- post-repair audit has zero privacy errors;
- indexes are ready;
- Functions are deployed and smoke-tested;
- website is deployed;
- Firestore and Storage rules are deployed;
- core browser/E2E checks pass;
- no critical production audit findings remain;
- release details are recorded in `RELEASE_LOG.md`.
