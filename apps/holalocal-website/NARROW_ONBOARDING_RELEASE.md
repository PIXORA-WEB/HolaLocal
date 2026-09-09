# Narrow onboarding website release — 9 September 2026

**Recommendation: ready for review and a separately authorized narrow website release.** The gallery incident remains open.

Prepared on `release/onboarding-core-fixes` in `/tmp/holalocal-onboarding-core`, based on `d9c776f`. Production is unchanged. No project was created; nothing was pushed or deployed. The original `fix/my-business-dashboard-layout` worktree and paused reviews/admin changes were preserved.

## Scope

Core fixes are independently committed as `e702bb6`:

- `locations.js`: remove an exact existing unresolved selection before catalogue resolution. Preserve unknown entries until explicitly removed; do not guess mappings for santa-margarita, duquesa or Remote. Save replaces the selected array and retains other selections.
- `auth.js`, `AppRoutes.jsx`: refresh the verified user's ID token before role transition; let the complete-profile form own the incomplete-onboarding transition.
- `EditBusinessPage.jsx`, the profile-save portion of `businessService.js`, and translations: show saving/success/failure beside Save, focus/scroll to invalid fields, distinguish a confirmed commit followed by a failed refresh, and keep unsaved edits visible. No timeout changes are included, including in the save-refresh path.
- `businessCompletion.js`, `BusinessDashboardPage.jsx`, translations: align review eligibility with the existing core profile and location contract; logo/gallery recommendations are optional. Explain email verification, business verification, saved drafts and approval separately. Count canonical media references in completion even when their preview fails.

Image display is separately committed as `920e7a0` and included after its independent browser checks passed:

- Only the media cache invalidation ordering changes in `businessService.js`: invalidate after attachment and before fetching new presentation URLs. Do not revoke the newly returned image URL.
- Existing avatar/overlay selectors in `global.css` keep the business logo control correctly sized and prevent overlapping initials/upload text.
- Synthetic attached logo/gallery fixtures exercise real authenticated emulator Storage reads and browser image decoding, replacement, old URL revocation and reload. Upload/prepare/finalize operations are substituted in this display-only check. It does NOT prove successful real-GCS media finalization.

No changes from the base commit in Functions runtime, rules, indexes, shared contract, vendor archives, lockfiles, `storageClient.js`, `functionsClient.js`, `businessMediaWorkflow.js`, `businessMediaPresentation.js`, `frontendErrors.js` or `withTimeout.js`. Upload transport, timeout and retry/session fixes from the broader candidate are excluded. There are no additional implementations or save handlers.

## Verification

On this isolated source using Node 20.20.2:

- Browser suite: **2 passed, 54.8 seconds**, with retries disabled. Actual emulator registration and email verification → refreshed token → account role → draft creation → profile Save/reload; invalid name focus; saving a stale editor after real review submission is denied by rules, gives visible error feedback and preserves entered text.
- Existing-business browser flow: explicitly removes all three unresolved chips, selects La Duquesa, saves/reloads exactly Marbella plus La Duquesa, and submits a complete image-free profile to `pending_review` with no publication timestamp.
- Independent display check: real authenticated reads of synthetic attached Storage fixtures, browser decoding for logo and gallery, replacement/cache lifetime, reload persistence, and existing editor display at 390×844. `test-results/onboarding/display-mobile.png` was visually inspected; label/icon fit and no horizontal overflow.
- Five focused website test files pass: locationSelection, businessMediaIntegration (base workflow tests), mediaSubmissionGuard, businessErrors, browserTestStartupSafety. Includes 75% image-free readiness and incomplete core-field rejection.
- Backend accountRoleTransition and businessMedia test files pass. Runtime code is unchanged.
- Security rules: **93 passed, 0 failed** against the actual checked-in Firestore and Storage rules.
- Website lint, 17-locale parity, Firebase initialization and bundle checks pass. Fresh build from this worktree; never use either older mixed-worktree or broader-candidate dist.

Initial browser attempts identified harness issues (cold Firestore startup, SDK export used incorrectly for warmup, Storage CLI host formatting, and omission of the authoritative business pointer in the stale-editor fixture). These were corrected in test infrastructure; no production security rule was weakened. The final browser run passes without automatic retries.

## Limits and gallery incident

The initiating production gallery failure remains unconfirmed. Full upload/finalization, transfer deadlines, recovery after lost responses, and duplicate prevention under the proposed broader retry changes remain outside this release. The existing gallery implementation and its known limitations remain. Do not label this release a gallery-upload fix or close that investigation.

Production evidence from the earlier read-only investigation: the reported business's canonical logo exists and is attached, while no gallery reference/current gallery object exists. The live cache-order defect is confirmed. Production's transitional canonical-write switch remains enabled; this website release does not alter it. The Storage emulator's token cleanup/generation/context mismatch is a separate limitation; no validator was weakened.

The local production-mode build uses the existing seven public Firebase configuration values. Vercel's full production environment (including App Check settings) has not been exported or changed. Deploy through the existing Vercel project's unchanged approved production environment; do not upload this local dist as a substitute for that environment-controlled build.

## Release procedure — only after approval

1. Review `git diff d9c776f..HEAD` on this branch. Keep the two implementation commits separate for review. The later test/documentation commit contains no additional runtime change. Confirm excluded paths still match the base and the worktree is clean.
2. Confirm the existing HolaLocal Vercel project and its unchanged production environment: root `apps/holalocal-website`, framework Vite, install `npm ci`, build `npm run build`, output `dist`. Preserve its Firebase/App Check settings. Do not create another project or change production Firebase settings.
3. Once deployment is explicitly authorized, push this exact branch/commit to the existing remote. A push can trigger a Vercel deployment, so no push was performed during preparation:

   ```bash
   git -C /tmp/holalocal-onboarding-core push origin release/onboarding-core-fixes
   ```

4. In the existing Vercel project's Deployments page, create/select a deployment from the exact final release SHA supplied in the delivery. Verify the source SHA, build success and existing project settings, then use the project's existing production promotion process. Do not deploy the broader `release/business-onboarding-fixes` branch.
5. No `firebase deploy`, Functions, Storage rules, Firestore rules/indexes, IAM, CORS or data migration step is required by this patch.
6. After release, confirm an existing user can remove unresolved locations, save/reopen and retain other selections. Confirm a new user can verify email, complete onboarding, Save/reload and submit without images. Confirm business verification still requires its separate review and drafts remain private. Confirm an already attached logo/gallery displays after refresh. A failed gallery upload must remain an open incident, not evidence that these separate profile saves failed.

Reproduce local checks (Node 20.20.2; protected emulators use synthetic demo data only):

```bash
cd /tmp/holalocal-onboarding-core/apps/holalocal-website
node --test tests/locationSelection.test.mjs tests/businessMediaIntegration.test.mjs tests/mediaSubmissionGuard.test.mjs tests/businessErrors.test.mjs tests/browserTestStartupSafety.test.mjs
node tests/browser/runOnboardingRegression.mjs
node tests/browser/runOnboardingRegression.mjs --rules-only
npm run lint
npm run check:locales
npm run check:firebase
npm run build
npm run check:bundle
```
