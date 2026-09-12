# Optional Firebase Analytics — review candidate, not activated

Baseline: main `87d5fbd5de5f1ba6b7f10dbab11e9655c307c219` (PR43). No Firebase, IAM, review/provider/retention/recovery, budget, quota or monitoring changes. Original mixed workspace and recovery backup preserved.

## Implementation and boundary

One browser-level preference (`holalocal.analyticsChoice.v1`, accepted/rejected) in localStorage, independent of account acknowledgments. Invalid/missing choice is not acceptance. Unavailable storage permits a tab-only choice; a subsequent visit may ask again. Storage events propagate withdrawal between tabs. No preselected acceptance. Footer Privacy settings and /privacy#optional-analytics reopen the same nonmodal bar; closing settings preserves the existing choice. The bar reserves page space, lifts the original Profile/Business sticky Save controls and preserves keyboard focus. Non-English copy uses the existing lazy locale pipeline.

No Analytics SDK import, Google tag, Analytics event or consent-mode denied ping before acceptance. The deployment readiness switch `VITE_ANALYTICS_CONSENT_ENABLED` defaults off; browser-test mode is always off. A later approved production build must explicitly set it to true only after the console prerequisites below. Preview deliberately remains off even when a visitor saves acceptance. Core Auth, App Check, Firestore and business counters remain independent.

After acceptance on an allowlisted public path, load the authoritative analyticsClient lazily once. Only manual page_view events for /, /services, /events, /community, /contact, /privacy and /terms. No detail paths, login/registration, account, messages or admin paths. No query strings/fragments, current document titles, business/account IDs, text, custom conversion events, account user_id or user properties. Only a fixed public title and canonical public URL. Standard Google/browser installation identifiers, session information, browser/device characteristics and network processing are still inherent to Analytics; these are not anonymous aggregate-only requests. Google receives the visitor IP on network requests; we do not promise zero personal data processing.

Referral values retain only origins from a fixed common search/social allowlist; unknown referrals are omitted. No referral path/query/fragment or campaign parameters. This deliberately limits referral reporting. Do not describe it as full attribution or cross-device identity. Google Analytics can still derive normal session/first-visit/engagement and device information; advertising consent is denied, Google signals and advertising personalization are false, user_id is null. No account name/email is connected to the Analytics browser identifier.

Withdrawal synchronously raises Google's ga-disable switch, prevents queued application work, removes visible _ga/_ga_*/_gid/_gat cookies at applicable host/parent domains and paths, and leaves core cookies/storage intact. No denied-consent update is sent to create cookieless pings. Already transmitted/in-flight requests and historic Google data cannot be retracted by this UI. Other tabs receive the storage change. Shared Firebase installation storage is not deleted because this is an app-level Firebase identity, not an authentication logout. Google cookies are configured for at most 90 days without sliding refresh; this is the proposed client cookie lifetime, not a claim about Google report/data retention. Confirm the property retention setting separately. Choice remains until changed/cleared or the consent-version key is intentionally revised.

DNT=1 and Global Privacy Control are respected even if a stored choice says accepted. Browser blocking, unsupported storage and Google failures must not interrupt application functions. Reports cover consenting/technically measurable visitors only.

## Required Google console readback/configuration — NOT performed

An Editor on the correct GA4 property/web stream must confirm its measurement ID matches Firebase web config and the website environment. `send_page_view:false` alone does not disable history tracking. Before any collection-enabled release:

- Turn OFF all Enhanced Measurement, including history page views, outbound clicks, scroll, site search, video, downloads and form interactions. Confirm the Google tag's automatic event settings too.
- Disable Google signals, advertising personalization/ads features and automatic user-provided data collection. Check linked Ads/destinations; do not silently create/delete links. No additional tag/GTM installation or consent-mode tag is permitted alongside this implementation.
- Confirm applicable Google terms/DPA, property retention and cookie disclosures with PR44. No legal compliance certification is implied.
- Recheck the actual remote tag at the network boundary: it must not send raw URLs/queries/titles/referrer paths, form content or account data, and must stop on private routes/withdrawal. Console-controlled behavior cannot be certified by a local SDK mock.

Official references: https://developers.google.com/analytics/devguides/collection/ga4/views (explicit Enhanced Measurement/history caveat); https://support.google.com/analytics/answer/9216061 ; https://developers.google.com/analytics/devguides/collection/ga4/reference/config ; https://firebase.google.com/docs/reference/js/analytics .

## Reporting and costs

In the linked GA4 property: Reports → Engagement → Pages and screens for popular approved pages; Acquisition → Traffic acquisition for the retained referral origins; User → Tech → Tech details, Device category for mobile/desktop/tablet; Realtime for recent consented traffic. Navigation names can differ by report collection. Session/user figures use browser identifiers, not authenticated accounts, and are incomplete by design. No guarantee of observing every visitor or exact unique people. Source: https://support.google.com/analytics/answer/12923437 ; https://support.google.com/analytics/answer/13820344 .

Standard Firebase Analytics is listed as no-cost (https://firebase.google.com/pricing). No new cloud resources or provider introduced. Analytics 360, BigQuery export/streaming and other paid integrations are outside this batch; none are enabled. Existing website/backend costs remain.

Registration conversion would need a separately reviewed sign_up event at confirmed account-creation success (not button click), anonymous payload and explicit consent at that moment. Email verification, business draft creation, successful submission and approval are distinct outcomes. None of these events or key-event definitions have been added. First-visit/session events are not registrations.

## Existing business counters — separate, unchanged

Authoritative sources: businessInsightsTracking.js, businessInsightsService.js, functions/src/businessInsights.js and businessInsightsRateLimits.js. Public profile views use a crypto-random token in sessionStorage under holalocal:insights:view:<businessId>; contact actions use a fresh random token. The callable receives businessId, event type, token and contact action, never an Analytics client ID. Firebase callable transport may attach Auth/App Check credentials for its own security, independently of this payload. Public eligibility/contact checks, transaction dedupe and hourly limits remain.

Firestore stores businessInsights/<businessId> aggregate totals, days/<date> aggregates, hashed insightDedupe keys with createdAt/expiresAt, and separate rate-limit documents. Dedupe expiry is 24 hours for counting logic; an expiresAt field is NOT evidence of physical deletion/TTL readiness. Conversation creation also has server-side counting. The consent bar does not gate these existing counters or erase their aggregates/tokens. A visitor rejecting Google Analytics can still generate these counts. Their browser-storage/measurement lawful basis or consent exemption has NOT been established; this remains explicitly on the private publication checklist. Do not describe all site measurement as consent-controlled or exempt merely because tokens are random.

## PR44 coordination / release sequence

This PR adds only the optional-Analytics disclosure/control to the original Privacy page. It does not publish the incomplete PR44 legal rewrite, invent operator address/age/tax details, bump policy versions or require fresh account acknowledgment. PR44 must remove its now-superseded claim that no optional consent interface exists, retain the separate-counter disclosure and reuse this one AnalyticsPrivacy component when reconciled; no second consent banner or duplicate Analytics section. Its unresolved operator particulars/legal advice remain private.

1. Review this preview and final tests. Keep deployment switch closed. Reconcile PR44 privacy/cookie text and outstanding publication requirements.
2. Obtain approval for exact Google console corrections/readback and a bounded real-tag acceptance check. No settings or production data changed by this preparation.
3. After those checks, obtain approval for the exact website commit/build environment and whether the initial rollout remains collection-disabled or becomes consent-enabled. Website only; no Firebase deployment.
4. Acceptance: zero Analytics requests/cookies before choice and after rejection; one sanitized page view per public transition after acceptance; no private-route/automatic sensitive events; withdrawal stops further traffic and clears controlled cookies; reload preserves choice; genuine signed-in/out browsing and Safari/mobile privacy controls. Actual GA ingestion can be checked only with explicitly approved test traffic, not silently inserted production records.

Rollback: rebuild/deploy baseline87d5fbd or the previous approved website commit, or ship the same candidate with VITE_ANALYTICS_CONSENT_ENABLED=false. Disabling a subsequent build does not remotely unload tabs already running older code; withdrawal acts in those tabs, while a full rollback takes effect on reload. No collected historical data is automatically deleted and no legal acknowledgment versions change.

## Reviews remain separate

The corrected runtime Translation image is complete locally at sha256:448eb8b902342ea2e7cc04f03942f9733641a3fc9473143366cfddc6bd04d972. Its plan/self-test and 78 source-file match evidence remain preserved outside this PR. No new cloud execution is approved: proposed one 74-character EU request under the actual runtime account, maximum USD0.03 total allowance including Job/storage/logging, requires explicit approval. Real runtime permissions and deployed Firestore/cache checks remain unverified. No review activation, operational notification, quota or EUR30 budget change occurs here.

## Final local verification — 12 September 2026

107 focused tests passed: consent storage/cross-tab notifications, late-load withdrawal, route and referral allowlists, advertising flags, account independence, blocked storage/privacy signals, existing browser-test startup safety and business insight behavior. 36 browser cases passed: all17 languages at390/1440 widths plus signed-in/out real Firebase SDK command-boundary cases on synthetic Auth/Firestore emulators. Accepted reload emits one page view; SPA query-only navigation does not duplicate it; private-route collection closes; another tab's withdrawal closes the first tab; rejection survives reopening; locally seeded Google cookies are removed and an unrelated core cookie preserved. Actual remote Google tag and measurement endpoints are blocked: SDK command verification is not Google ingestion, remote automatic-event or translation-quality verification. No Google Analytics events delivered.

Lint, locale parity, diff whitespace and fresh builds passed. The unchanged200kB budget still fails: baseline205.45kB, candidate default-disabled207.39kB (+1.94), enabled207.56kB (+2.11). This feature's increase is not claimed to be pre-existing. Non-English consent copy and Firebase Analytics remain lazy; enabled Analytics chunk6.48kB gzip (Vite report, before external Google tag). No fixtures found in production output. No unrelated size optimization, changed limit or bypass.

Read-only production still serves /assets/index-Ck7ORKy6.js, matching main87d5fbd; measurement ID G-FKFR4SFML9. GA Admin read failed403 PERMISSION_DENIED, ACCESS_TOKEN_SCOPE_INSUFFICIENT. This establishes missing OAuth scope, not absence of property permissions or an incorrect property configuration. Use an existing permitted GA4 console session or separately approved analytics.readonly OAuth access to inspect; no API/settings/grants changed.

Desktop/mobile screenshots and machine-readable results are in the durable sibling review-evidence/analytics-consent directory. Chromium touch emulation is not a real iPhone/Safari check or native-language/legal editorial review. Appearance, actual remote-tag filtering/ingestion, GA console readiness and physical-phone checks remain release acceptance items.
