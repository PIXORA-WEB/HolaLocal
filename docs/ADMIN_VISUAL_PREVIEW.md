# Admin visual preview — not released

Baseline: main `e3e2b606e84ab54df7128950640930e875131aed` (PR #40). Read-only GitHub deployment inspection confirmed Production success at https://hola-local-4ee5qr8ul-hello-8446s-projects.vercel.app; public holalocal.es served the matching `/assets/index-D596oyqk.js` entry. No production writes or configuration changes.

Branch: `preview/admin-visual-refresh`, durable worktree `~/Projects/HolaLocal-worktrees/admin-visual-preview`. Original mixed workspace, previous worktrees and recovery backup were not modified. Approximately 12 GB free; existing dependencies reused, no installation.

## Preview

Interactive real application: http://127.0.0.1:4190/admin

Synthetic admin: `admin@reviews.example.invalid`; password `Fictional-review-demo-47!`.
Screenshot gallery: http://127.0.0.1:8769/ . These URLs are local to the development computer; no hosted deployment or tunnel was created.

The protected `runCustomerReviewDemo.mjs` configuration runs Auth, Firestore, Storage and Functions emulators for `demo-holalocal-functions`. It enables reviews only inside that isolated demo. No new provider requests. Original fixtures and UI are reused; no alternative Admin pages. Review/customer actions mutate only synthetic records. An in-progress deletion fixture is intentionally not eligible for finalization. Production business/account data is never seeded here.

Durable screenshots, logs and synthetic emulator export: `../review-evidence/admin-visual-preview/`.
To restore after stopping the demo, from `apps/holalocal-website`, using Node 20 and the existing emulator cache:

```sh
export TMPDIR="$HOME/Projects/HolaLocal-worktrees/review-evidence/runtime"
export FIREBASE_EMULATORS_PATH="$HOME/.cache/firebase/emulators"
node scripts/runCustomerReviewDemo.mjs --import-demo "$HOME/Projects/HolaLocal-worktrees/review-evidence/admin-visual-preview/emulator-export"
```

## Authoritative changes

- `AdminLayout.jsx`: existing sidebar/drawer share the same ordered navigation, icons and admin/gate restrictions. Review translations load lazily only when needed; no raw translation keys before opening the first review route.
- `global.css`: edited original Admin declarations and responsive rules. More readable record text, compact summaries, broader desktop content, wrapped mobile filters/headings, contained logos, consistent dialog spacing. Existing selected/pressed and keyboard focus states retained.
- `AdminBusinessesPage.jsx`, `AdminBusinessReviewPage.jsx`: removed unused heading modifier and hidden decorative radio span. Existing fetches, access rules and moderation/subscription handlers untouched.
- `AdminAccountDeletionsPage.jsx`: consistent loading/error/empty states. Consolidated two competing modal lifecycles into the original single dialog containing details or confirmation. This fixes reproduced focus loss after Cancel → Close; eligibility, exact version/UID payload, confirmation and finalization service remain unchanged.
- `AdminCustomerReviewsPage.jsx`, `CustomerReviewModeration.jsx`, `adminCustomerReviews.css`, `customerReviews.css`: removed duplicate page navigation; original queues use readable responsive records, retain case/revision/privacy and action contracts. Shared public article rules explicitly exclude the Admin queue records instead of competing with their layout.
- `adminTranslations.js`: completeness checklist calls its items recommended, rather than required. Backend publication eligibility unchanged. Existing general Admin fallback wording is English; locale parity is not native editorial verification.
- `registerAdminCustomerReviewTranslations.js`: documents shared lazy navigation usage.

Removed: duplicate review-page navigation and its CSS, second deletion dialog lifecycle, hidden plan indicator markup/CSS, unused split-heading modifier, duplicate textarea rule. No replacement pages or appended override stylesheet.

## Reviews availability

Both `/admin/customer-reviews` and `/admin/customer-review-reports` already exist. Authenticated AdminRoute + admin-only route checks apply. The reviews website gate hides navigation and shows unavailable content while closed; moderators do not acquire access. Review callables have their own server gate. Business listing moderation remains independent. Existing customer-review approval and report-resolution/removal permissions are unchanged. No production gate was altered.

## Verification

- Existing real-emulator browser journey: route claims, private boundaries, rejection, owner resubmission, approval, responsive UI — passed (38.4s).
- Existing real-emulator subscription/admin/moderator/owner projection and responsive dialog journey — passed (2.0m).
- Synthetic real account-deletion request, queue, detail/confirmation, Cancel, keyboard focus return, finalization and reload — passed. Initial two-dialog focus failure reproduced and fixed.
- Existing combined customer/admin review journey: submit/edit/approve/reject, private-name isolation, retries, quota boundaries, reports/resolution, withdrawal and reload — passed. All local Firebase callables; no production records.
- Original pages captured at 390px and 1440px, long names, empty queues, unavailable business/report, active review/report cases. No document horizontal overflow. Injected queue network failure surfaced safe error; Retry reached real local callable and recovered.
- 33 affected unit/contract/source tests; lint; 17-locale parity; fresh production build. See saved logs for final outcomes.
- Pre-existing bundle budget remains a failure: 205.61 kB gzip against unchanged 200 kB. No budget increase or bypass.
- Preview/test configuration and synthetic source files are outside the production import graph; built assets checked for preview fixture markers.

## Touch investigation — superseded by released fix

The recording subsequently confirmed the native tap overlay. PR #41 released the independent base.css correction; the user now confirms it is resolved on their phone. The approved Admin design does not modify that rule. Earlier touch observations above remain historical preview evidence.

## Release boundary

Appearance approved at `b7856325e98fb69b6c21b9b6365e3b970ac1e395`. Release preparation is documented in ADMIN_REDESIGN_RELEASE.md. Website only; no Firebase/Storage/IAM/index/activation changes. The original preview was not merged or deployed; subsequent PR preparation is tracked in ADMIN_REDESIGN_RELEASE.md. The blue tap-highlight issue is user-confirmed resolved. Existing production upload transport and separate reviews activation work remain unverified/open as previously documented.
