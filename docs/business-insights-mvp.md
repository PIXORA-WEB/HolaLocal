# Business Insights MVP

Business Insights starts at the first accepted insight after deployment. HolaLocal does not estimate earlier activity and no production conversation backfill is part of this change.

## Collection and aggregation

- A profile view is a successfully loaded, public-eligible active business detail. A random per-tab `sessionStorage` token prevents refresh inflation. The server stores only its SHA-256 digest, scoped to the business and event type, and suppresses reuse for a rolling 24 hours. Expired or malformed dedupe documents are overwritten transactionally, so correctness does not depend on prompt TTL deletion.
- A new enquiry is counted once when the canonical conversation document is created. A transaction adds `insightsEnquiryCountedAt` to that conversation and increments the private aggregates atomically. Messages and replies do not increment enquiries.
- Contact actions are deliberate activations of visible HolaLocal message, phone, email, WhatsApp or website controls. The browser generates a new random token for every activation; the server-side 24-hour dedupe window therefore protects callable retries of that activation without suppressing a later deliberate activation. Only the category is stored; the destination value is never included.
- All-time totals live at `businessInsights/{businessId}`. UTC daily totals live under `days/{YYYY-MM-DD}`. Owners can request an inclusive 7, 30, 90 or custom range of up to 366 days. The authenticated callable validates the range, queries only existing daily documents by document ID, inserts zero-valued missing dates, and calculates selected-range totals on the server. The default remains the last 30 UTC calendar days including today.

Insight data does not contain raw IP addresses, names, email addresses, phone numbers, message text, user-profile data, browser fingerprints, advertising identifiers, or contact destinations. It is not sourced from Google Analytics.

## Retention and deletion

Daily aggregate documents are retained with the business until a reviewed business/account deletion workflow removes the insight tree. Dedupe documents contain only timestamps and an opaque digest and have an `expiresAt` timestamp 24 hours after creation. Temporary hourly rate-limit documents live in `businessInsightRateLimitHours`, contain global or per-business counters, and expire 48 hours after the end of their UTC hour. The code writes genuine Firestore timestamps for both kinds of temporary document, but this change does not enable a production TTL policy. TTL activation for the `insightDedupe` collection group and `businessInsightRateLimitHours` collection is a separate production-configuration stage; TTL deletion is asynchronous. Aggregate deletion must be included when permanent business deletion is implemented because Firestore does not cascade-delete subcollections.

## Abuse boundary

The public callable strictly allowlists payload fields, revalidates publication and contact availability, and deduplicates retries/session refreshes. One transaction now limits accepted events to 1,000 globally per UTC hour and 300 per business per UTC hour. Duplicate retries are returned before either counter is consumed, and a limited request creates no dedupe record or analytics update. The limits bound accepted Firestore writes and temporary-document creation; they do not prevent incoming callable invocations or the reads needed to reject excess requests.

App Check is not currently initialized or enforced and is a separate later stage. Production TTL activation, monitoring, alerts and budgets are also separate production-configuration work and are not made active by this code. Insight figures remain directional product analytics rather than audited, billing-grade or unique-person statistics.

Stage 2A has been implemented and tested locally only. The server-side limits and Function resource controls are not active in production until a separately approved Firebase Functions deployment is completed; this documentation change neither authorizes nor performs that deployment. Production TTL, App Check, monitoring, alerts and budgets remain separate later actions.
