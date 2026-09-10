# Profile / My Business appearance review

Baseline: main 9fd2023918ed56f3a8cc2a8ee469a6e2c9188a0f (PR #38). Branch: preview/profile-business-refresh. Not approved for integration or deployment.

## Production Save evidence

The user confirmed production Save succeeded after PR #38. Persistence after reopening remains unconfirmed; only an explicit user report can confirm it. The durable release log has the same distinction.

## Authoritative changes

- `ProfilePage.jsx`: read-only overview avatar; original uploader, error recovery and handler moved into the original Edit profile dialog. Compact Edit profile action in Personal details; My business only in Business tools. Removed page-level logout and the superseded summary action row. Duplicate header email removed (retained in personal details). Corrected existing first/last-name validation focus IDs.
- `BusinessDashboardPage.jsx`: compact business identity; keep publication and business verification visible, replace duplicate plan/setup badges with the existing permission-guarded Edit link. Completion and requested changes remain separate cards; images remain recommendations and moderation rules are unchanged.
- `EditBusinessPage.jsx`: compact heading with My Business navigation using existing unsaved protection. Original unsaved dialog now has padded content and independent actions; Keep editing primary, Leave secondary.
- `global.css`: modify original rules; relocate camera selectors, remove obsolete email and deleted-badge rules, consolidate heading typography and redundant desktop declarations. No appended override stylesheet or duplicate page implementation. Preserve original responsive avatar sizing and shared form/dialog/accessibility styles.
- Existing browser regression extended, not replaced by a demo page.

Shared callers checked: PublicBusinessCard avatars, BusinessReportDialog and MessagesPage form actions, account-deletion dialog, AccessibleDialog focus return/Escape/backdrop behavior. Their handlers and shared action styles are unchanged. No Firebase, review activation or upload transport/session changes.

## Verification

Revised real-component emulator browser journey: 1 passed, 25.1 seconds. Auth/Firestore/Storage isolated demo environment, external HTTPS requests blocked. Mobile 390px / desktop 1440px screenshots for both overviews, profile editor, business editor and unsaved dialog. Confirmed uploader absent from overview and present in editor; keyboard Enter opens the profile editor, Escape returns focus to Edit profile; keyboard Business tools navigation reaches the dashboard; one My business link and no page-level logout; Keep editing preserves dirty business text at both sizes; legacy services and canonical replacements save/reload; private contacts and other media references preserved; prohibited lifecycle write rejected atomically and editor unavailable after reload. No horizontal overflow in checked overviews/edit screens.

Lint, 17-locale parity and fresh build pass. Bundle budget remains failed: 205.30 kB vs unchanged 200 kB limit. Prior same-dependency baseline evidence established this overage predates PR #38. No limit increase or unrelated optimisation.

## Preview and limits

Durable captures and screenshot index: sibling `review-evidence/profile-business-preview/index.html`. Browser log: sibling `review-evidence/profile-business-preview-revision-browser.log`. Screenshots use the updated application itself, no fictional preview components or production fixtures.

Subscription projection and insights show expected unavailability because this harness does not run Functions. Real photo upload transport is not retested; its existing implementation is unchanged. No new production, native-language editorial, full assistive-technology or exhaustive lifecycle visual verification is claimed. Appearance approval required before integration. Original mixed workspace, recovery backup and separate investigations preserved.

## Requested appearance revision

Profile avatar and business logo are now 88px square on mobile (previously 60px), with 144px profile / 152px business sizes on desktop (previously 112px / 120px). The profile editor also uses the larger 88px avatar. The authoritative image rule accepts a scoped fit variable: these images use contain, maintaining natural image proportions; other avatar callers retain cover. Preview data uses initials fallbacks, so these captures do not claim a new upload test.

Removed all base and responsive profile-summary action selectors, not just hidden controls. Kept account-menu logout and workflow sign-out recovery. The Personal details action uses wrapping flex layout and a 44px minimum touch target. Shared account-card and avatar styles retain their other callers. Current lint and fresh build pass; translations unchanged. No merge, push or deployment.
