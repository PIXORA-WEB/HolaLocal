# Customer-chosen review names and coordinated UI

Stacked on unmerged PR #28 (`758c1be3d8a3c37b62dc1e89efd9d26025f00733`). Neither PR may merge or deploy without approval. Production reviews remain disabled in both website and server gates.

## Approved identity behaviour

The form requires a separately chosen public display name; it never initializes from Auth/profile names or email. Before submission, all 17 locales explain that the name is public after approval, the account link remains private for moderation, and neither name nor verified email proves a purchase/service.

Shared validation trims and NFC-normalizes names, allows 1–80 Unicode code points and rejects control/bidi override characters and malformed Unicode. React renders the name as escaped text. It is included in request fingerprints, immutable revisions and private author/admin read projections. The currently approved revision supplies the existing public reviewerAlias field, preserving read compatibility. Name edits require approval; pending/rejected edits retain the prior public name. Legacy originals can still be read/erased, but new submissions cannot omit the chosen name. Private authorUid linkage and ownership checks are unchanged.

The synthetic alias chooser was removed from the authoritative command/gate boundary. This is not a global profile-name change or a verification badge.

## Coordinated UI extraction

Customer review editor/status/history/report UI, admin moderation/report UI, services/controllers, routes and translations are integrated into current Services components. Optional review props do not reinstate old layout variants. Current released Services deep links, card/detail styles, onboarding, media display and deletion remain intact. No preview fixture/runtime, global CSS override or competing save/delete handler was imported.

Obsolete paused tests for servicesTarget and preview mock summaries were retired; actual Services browser and backend summary tests cover the authoritative implementations. Admin comparison now shows proposed and published names beside their respective review versions. Name input shares existing form styles.

## Verification and limits

- Shared/backend validation, privacy, approval/edit/rejection, idempotency and cleanup tests; 57 protected emulator tests passed.
- Real local browser test `tests/browser/customerReviewDisplayName.mjs`: blank input despite seeded private names; publication/non-purchase disclosure; focus; lost successful response and identical retry with exactly one revision; admin confirmation/Escape; approval; escaped public name; reload; pending name preservation; approved replacement. Customer mobile and admin desktop checked.
- Run the browser test against a **fresh** `scripts/runCustomerReviewDemo.mjs` environment, synthetic demo-holalocal-functions only. The browser test checks the loopback hub before SDK initialization and never uses production endpoints. Set TMPDIR to a durable local evidence/runtime directory. Stop that demo before running another heavy suite.
- Three current Services browser tests and two current onboarding/display/deletion browser tests passed with review activation off.
- Website/Functions lint, 17-locale parity, fresh website build/bundle and deployable Functions package verification passed. Native editorial validation of every translation and the full remaining customer/admin report/browser matrix remain follow-up gates.

## Separate approved policies and release dependencies

The owner also approved 5 review submissions/edits and 10 reports per rolling 24h; exact retries free, withdrawal unrestricted. Open reports stay until handled; resolved text/reporter identity/private notes are removed after 90 days, sooner during account erasure. No automatic reopening; an explicit new report about currently published content remains allowed. Those implementations are NOT in this identity/UI batch and must be tested separately before production activation.

No Firebase deployment is needed to review this PR. A future coordinated launch must first deploy verified indexes, policy/retention/erasure backend dependencies and the affected review callables, then separately enable the website/server gates with explicit approval. This batch alone is not a launch recommendation. Do not deploy Storage rules, media handlers or the original upload/retry candidate. PR #28 remains unmerged.

Durable evidence: ~/Projects/HolaLocal-worktrees/review-evidence. Original recovery backup and mixed source remain untouched.
