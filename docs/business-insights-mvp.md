# Business Insights MVP

Business Insights starts at the first accepted insight after deployment. HolaLocal does not estimate earlier activity and no production conversation backfill is part of this change.

## Collection and aggregation

- A profile view is a successfully loaded, public-eligible active business detail. A random per-tab `sessionStorage` token prevents refresh inflation. The server stores only its SHA-256 digest, scoped to the business and event type, and suppresses reuse for a rolling 24 hours. Expired or malformed dedupe documents are overwritten transactionally, so correctness does not depend on prompt TTL deletion.
- A new enquiry is counted once when the canonical conversation document is created. A transaction adds `insightsEnquiryCountedAt` to that conversation and increments the private aggregates atomically. Messages and replies do not increment enquiries.
- Contact actions are deliberate activations of visible HolaLocal message, phone, email, WhatsApp or website controls. The browser generates a new random token for every activation; the server-side 24-hour dedupe window therefore protects callable retries of that activation without suppressing a later deliberate activation. Only the category is stored; the destination value is never included.
- All-time totals live at `businessInsights/{businessId}`. UTC daily totals live under `days/{YYYY-MM-DD}`. Owners receive only aggregate totals, the 30-day series, tracking start, and business status through an authenticated callable.

Insight data does not contain raw IP addresses, names, email addresses, phone numbers, message text, user-profile data, browser fingerprints, advertising identifiers, or contact destinations. It is not sourced from Google Analytics.

## Retention and deletion

Daily aggregate documents are retained with the business until a reviewed business/account deletion workflow removes the insight tree. Dedupe documents contain only timestamps and an opaque digest and have an `expiresAt` timestamp 24 hours after creation. Configure a Firestore TTL policy on the `insightDedupe` collection group and `expiresAt` field before production launch; TTL deletion is asynchronous. Aggregate deletion must be included when permanent business deletion is implemented because Firestore does not cascade-delete subcollections.

## Abuse boundary

The public callable strictly allowlists payload fields, revalidates publication and contact availability, and deduplicates retries/session refreshes. App Check is not currently enforced and was deliberately not enabled by this task. A scripted caller can mint tokens and inflate counts. Enable and monitor App Check later, then consider per-install/rate-limit controls if traffic warrants them. These metrics are useful directional product analytics, not billing-grade unique-person measurements.
