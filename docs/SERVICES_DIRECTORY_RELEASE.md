# Services directory and detail integration

Branch: feature/services-directory-refresh. Baseline: current main f9e436a18b2c24058acacc26c0dd3cbd9d749a91. The approved Services preview is integrated with the exact public deep-link correction. Website-only; no Firebase deployment is required. Do not merge or deploy to production until separately authorized. A PR preview is authorized.

## Authoritative changes and removals

- ServicesPage uses existing getPublicBusinessById for details instead of searching the capped directory. List/detail loading and failures are separate; stale detail responses are ignored. Search/category/language/area handlers and contact/save/report service handlers remain unchanged.
- PublicBusinessCard's directory presentation replaces the former result-card markup. The homepage hero rendering is retained. No preview fixtures, rating summaries or customer-review imports are included.
- BusinessDetailPanel has one approved layout: contact/actions first on mobile and beside information on desktop. Its old alternate layout and unneeded preview/review props are removed. Existing action callbacks, public contact fields, media presentation and accessibility labels remain authoritative.
- Existing detail declarations were moved from global.css into servicesPresentation.css and merged with the approved values. Removed obsolete result-card selectors/markup and global detail/grid rules; there is no appended override layer or second detail implementation. Shared avatar/upload controls and homepage hero styles remain.
- BusinessMetadataIcon and 17-language service/contact wording accompany the approved design. The original paused workspace and preview remain untouched for recovery; they are not release dependencies.

## Verification

Three real emulator/browser scenarios passed (1.1 minutes, retries disabled):

1. Search, area, category and language filtering; keyboard Enter card navigation; full long-name detail heading; 1440px desktop and 390px mobile without horizontal overflow; English/Spanish details; public contact hrefs and safe external-link attributes; missing/failed logo fallback; canonical gallery bytes loaded from Storage emulator; anonymous save dialog and Escape focus restoration.
2. An eligible business older than 101 other records is absent from the capped directory but opens through exact navigation and reload without fetching the directory. Draft, Pending review, Needs changes, Suspended, Archived and missing records remain unavailable. Private contact data is not rendered. Controlled lookup failure shows Retry, which returns to the real callable; return to results works.
3. A verified synthetic customer uses the existing login/profile service, saves the business, reloads with saved state and decoded gallery, removes the saved entry, and submits one report through the real Firestore rules. Database inspection confirms the intended target and persistence.

Only fixture setup uses Admin SDK writes. Successful application reads, media display, save and report writes are not mocked. HTTPS requests are blocked during emulator checks; the deliberately missing logo uses a synthetic compatibility URL and never reaches production. Actual upload finalization is outside this test, as before.

Initial test failures involved incomplete synthetic fixture schemas, filters being changed before prior results rendered, and a browser-process crash. Fixtures now satisfy existing rules; filter checks wait for the full expected list. Tests run in separate browser contexts with shared-memory pressure mitigated. No rules or application filter behavior was relaxed/changed to pass.

Nine relevant unit test files passed. Website lint, 17-locale parity, Firebase initialization and a fresh isolated build/bundle check passed (173.00 kB initial gzip). The two existing onboarding browser flows also passed against this source, including verified-token onboarding, location removal/save/reload, review submission without images, independent image display and canonical/legacy deletion checks. No required Firebase source changed. Retained evidence: /tmp/services-design-browser7.log and /tmp/services-release-*.log. Desktop/mobile screenshots are under apps/holalocal-website/test-results/services (ignored artifacts).

## Preservation and limits

The released onboarding, location, image-display and gallery-deletion source remains based on main. No Functions, Firestore rules/indexes, Storage rules, upload transport/retry/session changes, review activation, moderation policy or production records are changed. All 144 original paused-source fingerprints still match. The original recoverable snapshot remains /tmp/holalocal-paused-snapshot-20260909; broader inventory is retained on fix/services-deep-links in docs/PAUSED_WORK_STATUS.md.

External email/telephone/WhatsApp applications and message delivery were not exercised. The contact URLs and existing callbacks are preserved; no synthetic external message is sent. Spanish browser rendering and all-locale key parity are checked, not native-language editorial approval of every locale. Original gallery upload/finalization diagnosis remains separate; canonical deletion remains emulator-verified and legacy deletion has the previously recorded production check.

## PR and eventual deployment

Push only this feature branch and open a PR into main. User authorized its automatic Vercel preview, not a merge or production release. Do not change Vercel automatic deployment settings. Preview uses real application services and public business data; fixtures exist only in tests. Avoid authenticated mutations against production while reviewing it unless separately authorized.

Once the PR and production release are separately approved, the existing main-branch Vercel workflow can build the merged source. No Functions/rules/index/Storage deployment accompanies this change. Verify the exact deployment commit and live aliases, then smoke-test public Services/search/details and owner-approved authenticated actions. Keep the prior production deployment as the website rollback target.
