# Consistent overview headers and immediate image feedback

Isolated branch: fix/profile-media-feedback, based on main df4bc78ee51083ef4defc88cc8559377117270ef (PR #39). Appearance and functional preview approved through 1206639ef1980c9d2ddf0fe00e2892f2af221863. PR push and automatic preview authorised; production merge/deployment, Firebase and activation changes remain unauthorised.

## Separate review scopes

Header commit b307bd9: original ProfilePage, BusinessDashboardPage and global.css. Shared top-card layout, spacing and image dimensions; same section-header action style. Remove Edit business from identity, feedback and quick-action duplicates; retain one lifecycle-guarded Edit business in the profile-completion section header. Moderation feedback stays above that section, submission retains existing eligibility checks, and contact/subscription actions remain. No replacement pages or overriding stylesheet.

The following functional commit updates original ProfilePage/EditBusinessPage handlers, storageClient validation, AppRoutes/cache disposal, and Business service cache-invalidation calls. A single shared useMediaSelectionPreview hook owns local selection URLs for all three existing controls; it is not another upload/save implementation. No transport, finalization contract, permissions, backend or publication-policy changes.

## Confirmed implementation findings

Profile photos already finalize immediately through prepareProfileMediaUpload -> uploadCanonicalImageFile -> finalizeProfileMedia. Save submits only profile details. Previously there was no immediate selection preview, and the post-upload foreground account refresh unmounted the editor. A controlled-success browser reproduction lost the dialog before its saved feedback appeared. Using the existing background-refresh option preserves the open editor and typed details. The user's exact production request was not captured; this is a verified local defect, not a claim about an observed production backend failure.

Profile's remote presentation previously revoked its old URL in the loader-effect cleanup, before a replacement had rendered. Presentation ownership now releases that URL after state replacement. The shared selection owner keeps a confirmed local image as fallback for a failed replacement, disposes replaced/unneeded selections after rendering, and disposes remaining URLs on unmount. File-picker cancellation leaves the saved selection unchanged. Save/Cancel affect details; neither stages nor rolls back an immediately finalized image. Upload success labels occur after the existing onCommitted callback. A failed replacement clears stale success feedback and preserves the last saved image.

Business logo/gallery also save immediately. Selected files now appear locally while upload is pending. Logo failures restore the prior confirmed display; failed gallery previews are removed while existing saved images remain. Gallery previews are separate from persisted entries and have no Delete control. Existing retry guards remain authoritative; no additional upload handler.

A second browser reproduction showed an overview logo disappearing after edit navigation. AppRoutes passive cleanup could revoke a promise obtained by the entering page. Layout-effect cleanup now runs before the entering page's passive loaders. In-place media refresh invalidates cached entries without revoking URLs still used by the current view; retired URLs are released at route disposal. The next browser run verified the actual overview logo after navigation. The original cache remains the sole canonical business-media cache.

Preview validation reuses validateImageFile, including the upload path's existing strict 5 MiB limit; its duplicate size predicate was consolidated. No metadata/generation protection changed.

## Verification against combined source

- Browser journey passed: 31.8s test / 34.6s suite. Actual components at 390px and 1440px, keyboard action navigation/focus return, one business Edit link, no identity-card edit link, no horizontal overflow, real non-square images after navigation.
- Deterministic controlled media-service results: valid selection immediately shows a blob preview, invalid selection rejected, file-picker cancellation, successful photo then Cancel, failed replacement restores the last saved image, retry succeeds, typed details survive upload, Cancel restores detail values, profile Save persists details and image reference. Browser instrumentation found no URL revoked while displayed; failed replacement URL becomes unavailable after release.
- Real isolated Auth/Firestore/Storage emulator integration: profile details Save/reload; canonical private photo and business logo/gallery reads after reload; existing gallery paths retained on failure; successful new gallery shown once; legacy-service and canonical-service save/reload; private contacts/media preservation; prohibited lifecycle write rejected atomically. Test code seeds synthetic finalization results and objects: real upload transport/callable finalization is NOT verified by this UI harness.
- 39 targeted profile/business media, errors and submission-guard tests pass. Includes in-place cache retirement and subsequent disposal. Final lint, 17-locale parity and fresh build pass.
- Initial JS 205.42 kB gzip exceeds existing unchanged 200 kB limit. Pre-existing overage remains documented; no budget increase or unrelated optimisation.

No native-speaker editorial or real-device assistive-technology review claimed. Non-English immediate-save help reuses existing translations; English explicitly mentions Save and Cancel. Subscription/insights unavailable states reflect the absent Functions emulator. Original upload incident and any real-provider/media recovery verification remain separate.

## Preview and next step

Durable screenshot gallery: sibling review-evidence/profile-media-feedback/index.html. Browser final log: sibling review-evidence/profile-media-feedback-browser-final.log. Other final check logs share the profile-media-feedback prefix. Synthetic fixtures and service controls are confined to tests/browser and excluded from the production Vite entry graph; screenshot index is outside source.

Preview approved; production release requires separate approval. This is a website-only release; no Functions, Firestore/Storage rules, indexes or activation deployment. Preserve original mixed workspace, recovery snapshots, prior preview/release evidence and unrelated work.


## Focused PR preparation

Current main reverified at df4bc78ee51083ef4defc88cc8559377117270ef. No integration differences: the two approved commits are retained without rewriting or squashing. This preparation changes documentation only; all runtime source remains identical to 1206639. Reuse its 39 passing targeted tests, final emulator browser run, lint, locale parity and fresh build. Existing dist inspection found none of the synthetic controller/identity markers and no tests directory. Vite production entry graph excludes tests/browser; no test-only runtime configuration is added. The automatic Vercel preview will build from the final PR commit.

Production upload transport/callable finalization remains unverified by these tests. Do not treat the controlled media-service results as resolution of the original upload incident. The 205.42 kB initial-JavaScript result still exceeds the unchanged 200 kB budget; no limit increase or check bypass.

After separate production approval, merge through the existing GitHub/Vercel main workflow and verify the deployed commit, aliases and authenticated Profile/Business interactions. No Firebase deployment is required. Rollback website to the last verified PR #39 deployment for df4bc78 (https://hola-local-g8jhpb8i7-hello-8446s-projects.vercel.app) if rollback is authorised, then prepare a normal source revert. Review activation and unrelated work stay untouched.
