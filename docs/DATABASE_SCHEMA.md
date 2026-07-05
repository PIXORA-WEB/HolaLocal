# HolaLocal Firestore database schema

## Status and scope

This document defines the planned Firestore architecture for HolaLocal before
feature implementation. It is a data contract, not an implementation. The
example documents below are type-oriented templates containing placeholders;
they are not mock records or seed data.

The design supports customers, service providers, and users who have both
roles. It favors bounded documents, query-driven denormalization, cursor-based
pagination, and collections that can scale independently to hundreds of
thousands of users.

## Shared conventions

- All timestamps are Firestore `Timestamp` values written with a trusted server
  timestamp where possible. Client device time must not be authoritative.
- All top-level documents use non-sequential IDs. Firebase Authentication UIDs
  are used only where identity ownership is the natural key.
- References are stored as string IDs unless an actual Firestore
  `DocumentReference` materially improves a specific query. String IDs are
  easier to validate, serialize, migrate, and use across web and mobile.
- Nullable fields are written explicitly only when queries depend on `null`.
  Optional fields that are not queried may be omitted.
- Documents use `createdAt`, `updatedAt`, and, where applicable, `deletedAt`.
- Soft-deleted content must be excluded by normal queries and security rules.
  Scheduled deletion or anonymization handles physical cleanup later.
- Large text, URLs, dynamic maps, and fields that are never queried should have
  single-field indexing disabled to reduce index storage and write costs.
- Arrays must remain bounded. Unbounded histories, members, media, messages,
  reviews, and favourites belong in separate documents or subcollections.
- List queries must use cursor pagination (`startAfter`) with a stable secondary
  sort such as document ID; offset pagination should not be used.
- Composite indexes listed here are recommendations. Only indexes required by
  implemented query shapes should be deployed.

### Common status values

Status strings should be validated by security rules or trusted backend code.
Initial controlled values are:

- Account status: `active`, `suspended`, `deletion_pending`, `deleted`
- Business status: `draft`, `pending_review`, `active`, `suspended`, `archived`, `deleted`
- Verification status: `unverified`, `pending`, `verified`, `rejected`
- Moderation status: `visible`, `pending`, `hidden`, `removed`
- Subscription status: `none`, `trial`, `active`, `past_due`, `cancelled`,
  `expired`

## 1. `users`

**Collection path:** `users/{userId}`  
**Document ID:** Firebase Authentication UID (`{uid}`)

Each document stores one account profile. A user may have `customer`,
`business`, or both values in `roles`.

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `displayName` | `string` | Yes | Public-facing name, length-limited. |
| `displayNameNormalized` | `string` | Yes | Lowercase normalized form for exact/prefix administration queries. |
| `email` | `string` | Yes | Account email; readable only by the owner and authorized staff. |
| `emailVerified` | `boolean` | Yes | Mirrored Auth verification state for rules/UI convenience. |
| `roles` | `array<string>` | Yes | Bounded set containing `customer`, `business`, or both. |
| `profilePhoto` | `map \| null` | No | `{ path, downloadUrl, width, height, updatedAt }`; `path` is canonical. |
| `preferredLocale` | `string` | Yes | Locale such as `en`, `es`, or a future supported locale. |
| `accountStatus` | `string` | Yes | Account lifecycle status. |
| `lastActiveAt` | `Timestamp \| null` | No | Coarsely updated presence timestamp; not updated on every request. |
| `termsAcceptedAt` | `Timestamp \| null` | No | Latest terms acceptance time. |
| `privacyPolicyAcceptedAt` | `Timestamp \| null` | No | Latest privacy-policy acceptance time. |
| `deletionRequestedAt` | `Timestamp \| null` | No | GDPR erasure request time. |
| `deletionScheduledFor` | `Timestamp \| null` | No | End of any permitted recovery/retention window. |
| `anonymizedAt` | `Timestamp \| null` | No | Time identifying fields were removed or replaced. |
| `createdAt` | `Timestamp` | Yes | Account profile creation time. |
| `updatedAt` | `Timestamp` | Yes | Last profile update time. |

Do not store passwords, authentication tokens, payment card data, or an
unbounded list of business/favourite/conversation IDs in this document.

### Example document template

```json
{
  "displayName": "<display name>",
  "displayNameNormalized": "<normalized display name>",
  "email": "<account email>",
  "emailVerified": "<boolean>",
  "roles": ["<customer|business>"],
  "profilePhoto": {
    "path": "users/<uid>/profile/<file>",
    "downloadUrl": "<generated URL>",
    "width": "<number>",
    "height": "<number>",
    "updatedAt": "<Timestamp>"
  },
  "preferredLocale": "<locale>",
  "accountStatus": "active",
  "lastActiveAt": "<Timestamp|null>",
  "deletionRequestedAt": null,
  "deletionScheduledFor": null,
  "anonymizedAt": null,
  "createdAt": "<Timestamp>",
  "updatedAt": "<Timestamp>"
}
```

### Relationships

- `users/{uid}` corresponds one-to-one with Firebase Authentication `{uid}`.
- `businesses.ownerId`, review authorship, conversation participants,
  favourites, reports, and notification recipients reference this ID.
- A user may own/manage multiple businesses; those relationships are queried
  from `businesses`, not stored as an unbounded array on the user.

### Recommended indexes

| Query | Composite index |
| --- | --- |
| Active users by recent activity | `accountStatus ASC, lastActiveAt DESC` |
| Users by role and creation time | `roles ARRAY_CONTAINS, createdAt DESC` |
| Pending GDPR deletion work | `accountStatus ASC, deletionScheduledFor ASC` |

Disable indexing for `profilePhoto.downloadUrl` and other unqueried media
metadata.

## 2. `businesses`

**Collection path:** `businesses/{businessId}`  
**Document ID:** Firestore auto ID

One document represents one service-provider profile. Rating totals and review
counts are derived values maintained by trusted backend processes when review
functionality is implemented.

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `ownerId` | `string` | Yes | Primary owner UID. |
| `managerIds` | `array<string>` | Yes | Bounded UIDs allowed to manage the profile; includes or supplements owner. |
| `name` | `string` | Yes | Public business name. |
| `nameNormalized` | `string` | Yes | Normalized name for administration/exact matching. |
| `slug` | `string` | Yes | Human-readable URL key; uniqueness enforced by a future reservation mechanism. |
| `description` | `string` | No | Public profile description, length-limited. |
| `primaryCategoryId` | `string` | Yes | Main category used for navigation and filtering. |
| `categoryIds` | `array<string>` | Yes | Bounded, deduplicated service-category IDs. |
| `serviceAreas` | `array<string>` | Yes | Bounded normalized area IDs/slugs. |
| `location` | `map` | No | `{ geopoint, geohash, locality, region, countryCode }`; exact address may be private. |
| `contact` | `map` | Yes | Public-safe contact projection: `{ phone, phoneVisible, email, emailVisible, whatsappNumber, whatsappVisible, website, preferredContactMethod, allowCallbackRequests }`. Hidden values must be empty here. |
| `profilePhoto` | `map \| null` | No | Logo metadata `{ path, downloadUrl, width, height, updatedAt }`. |
| `coverPhoto` | `map \| null` | No | Cover image metadata with the same shape. |
| `galleryCount` | `number` | Yes | Derived count; gallery items should later use a subcollection if unbounded. |
| `ratingAverage` | `number` | Yes | Derived average from visible reviews, initially `0`. |
| `ratingCount` | `number` | Yes | Derived visible-review count. |
| `status` | `string` | Yes | Business publishing lifecycle. |
| `verificationStatus` | `string` | Yes | Verification workflow status. |
| `verifiedAt` | `Timestamp \| null` | No | Successful verification time. |
| `subscription` | `map` | Yes | Future-facing `{ tier, status, provider, currentPeriodEnd }`; no payment secrets. |
| `lastActiveAt` | `Timestamp \| null` | No | Coarse activity time for the business account. |
| `publishedAt` | `Timestamp \| null` | No | First/current publication time. |
| `deletionRequestedAt` | `Timestamp \| null` | No | Owner deletion request time. |
| `deletedAt` | `Timestamp \| null` | No | Soft-deletion time. |
| `createdAt` | `Timestamp` | Yes | Creation time. |
| `updatedAt` | `Timestamp` | Yes | Last profile update time. |

### Example document template

```json
{
  "ownerId": "<uid>",
  "managerIds": ["<uid>"],
  "name": "<business name>",
  "nameNormalized": "<normalized business name>",
  "slug": "<unique-slug>",
  "description": "<profile description>",
  "primaryCategoryId": "<categoryId>",
  "categoryIds": ["<categoryId>"],
  "serviceAreas": ["<areaId>"],
  "location": {
    "geopoint": "<GeoPoint>",
    "geohash": "<geohash>",
    "locality": "<locality>",
    "region": "<region>",
    "countryCode": "<ISO 3166-1 alpha-2>"
  },
  "profilePhoto": null,
  "coverPhoto": null,
  "galleryCount": 0,
  "ratingAverage": 0,
  "ratingCount": 0,
  "status": "draft",
  "verificationStatus": "unverified",
  "subscription": {
    "tier": "free",
    "status": "none",
    "provider": null,
    "currentPeriodEnd": null
  },
  "lastActiveAt": "<Timestamp|null>",
  "createdAt": "<Timestamp>",
  "updatedAt": "<Timestamp>"
}
```

### Relationships

- `ownerId` and each `managerIds` value reference `users/{uid}`.
- Category fields reference `categories/{categoryId}`.
- Reviews, conversations, favourites, reports, and business-targeted
  notifications reference `{businessId}`.
- Storage objects should use paths such as
  `businesses/{businessId}/logos/{file}` and
  `businesses/{businessId}/photos/{file}`.

### Recommended indexes

| Query | Composite index |
| --- | --- |
| Published businesses by primary category | `status ASC, primaryCategoryId ASC, updatedAt DESC` |
| Published businesses by any category and rating | `status ASC, categoryIds ARRAY_CONTAINS, ratingAverage DESC` |
| Published businesses by service area | `status ASC, serviceAreas ARRAY_CONTAINS, updatedAt DESC` |
| Businesses owned by a user | `ownerId ASC, status ASC, updatedAt DESC` |
| Businesses managed by a user | `managerIds ARRAY_CONTAINS, updatedAt DESC` |
| Verification queue | `verificationStatus ASC, createdAt ASC` |
| Subscription maintenance | `subscription.status ASC, subscription.currentPeriodEnd ASC` |
| Geohash range by category | `status ASC, primaryCategoryId ASC, location.geohash ASC` |

Firestore is not a full-text search engine. Do not grow a large token array on
business documents. Introduce a dedicated search service when substring,
ranking, typo tolerance, or multilingual search is required. Disable indexing
for descriptions, public URLs, and unqueried media/contact map fields.

### Private business contact settings

**Collection path:** `businessPrivate/{businessId}`

Firestore cannot hide individual fields from an otherwise readable document.
The full contact settings therefore live in an owner/manager-only document at
this path. The matching `businesses/{businessId}.contact` map is a public
projection and contains phone, email, or WhatsApp values only when its
visibility flag is enabled. Clients must update both documents atomically and
must never treat presentation-layer hiding as a privacy boundary.

## 3. `categories`

**Collection path:** `categories/{categoryId}`  
**Document ID:** Stable lowercase slug, for example `<category-slug>`

Categories are curated platform data, not user-created free text.

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `slug` | `string` | Yes | Stable slug matching the document ID. |
| `names` | `map<string, string>` | Yes | Localized display names keyed by locale. |
| `descriptions` | `map<string, string>` | No | Localized short descriptions. |
| `parentId` | `string \| null` | Yes | Parent category ID for a bounded hierarchy. |
| `iconKey` | `string \| null` | No | Key into the application icon system. |
| `image` | `map \| null` | No | Optional category-image metadata. |
| `sortOrder` | `number` | Yes | Curated ordering within a parent. |
| `isActive` | `boolean` | Yes | Whether users may browse/select the category. |
| `createdAt` | `Timestamp` | Yes | Creation time. |
| `updatedAt` | `Timestamp` | Yes | Last update time. |

### Example document template

```json
{
  "slug": "<category-slug>",
  "names": {
    "en": "<English name>",
    "es": "<Spanish name>"
  },
  "descriptions": {},
  "parentId": null,
  "iconKey": "<icon key|null>",
  "image": null,
  "sortOrder": "<number>",
  "isActive": true,
  "createdAt": "<Timestamp>",
  "updatedAt": "<Timestamp>"
}
```

### Relationships

- `businesses.primaryCategoryId` and `businesses.categoryIds` reference category
  IDs.
- `parentId` references another `categories/{categoryId}` or is `null`.
- Renaming a display label must not change the stable document ID.

### Recommended indexes

| Query | Composite index |
| --- | --- |
| Active root categories in display order | `isActive ASC, parentId ASC, sortOrder ASC` |
| Active children in display order | `parentId ASC, isActive ASC, sortOrder ASC` |

Disable indexing for localized description values unless an administration
query explicitly needs them.

## 4. `reviews`

**Collection path:** `reviews/{reviewId}`  
**Document ID:** Deterministic `{businessId}_{authorId}` for one review per user
per business. If multiple reviews per relationship are later required, migrate
to Firestore auto IDs and enforce policy server-side.

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `businessId` | `string` | Yes | Reviewed business ID. |
| `authorId` | `string` | Yes | Reviewing user UID. |
| `rating` | `number` | Yes | Integer rating from `1` to `5`. |
| `title` | `string` | No | Optional length-limited summary. |
| `body` | `string` | Yes | Length-limited review text. |
| `moderationStatus` | `string` | Yes | Visibility/moderation state. |
| `businessResponse` | `map \| null` | No | `{ body, authorId, createdAt, updatedAt }`. |
| `editedAt` | `Timestamp \| null` | No | Most recent author edit. |
| `deletedAt` | `Timestamp \| null` | No | Soft-deletion time. |
| `createdAt` | `Timestamp` | Yes | Creation time. |
| `updatedAt` | `Timestamp` | Yes | Last mutation time. |

### Example document template

```json
{
  "businessId": "<businessId>",
  "authorId": "<uid>",
  "rating": "<integer 1-5>",
  "title": "<optional title>",
  "body": "<review text>",
  "moderationStatus": "visible",
  "businessResponse": null,
  "editedAt": null,
  "deletedAt": null,
  "createdAt": "<Timestamp>",
  "updatedAt": "<Timestamp>"
}
```

### Relationships

- `businessId` references `businesses/{businessId}`.
- `authorId` references `users/{uid}`.
- Visible review changes update the business rating aggregate through trusted,
  idempotent backend logic. Clients must not write aggregate rating fields.
- Reports may target the review document.

### Recommended indexes

| Query | Composite index |
| --- | --- |
| Visible reviews for a business, newest first | `businessId ASC, moderationStatus ASC, createdAt DESC` |
| Visible reviews for a business by rating | `businessId ASC, moderationStatus ASC, rating DESC, createdAt DESC` |
| Reviews written by a user | `authorId ASC, createdAt DESC` |
| Review moderation queue | `moderationStatus ASC, createdAt ASC` |

Disable indexing for `body`, `title`, and response body fields.

## 5. `conversations`

**Collection path:** `conversations/{conversationId}`  
**Document ID:** Firestore auto ID. A trusted transaction should prevent
duplicate active conversations for the same customer/business relationship if
that becomes a product requirement.

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `businessId` | `string` | Yes | Business context for the conversation. |
| `customerId` | `string` | Yes | Customer UID that initiated/owns the customer side. |
| `participantIds` | `array<string>` | Yes | Bounded UIDs allowed to read the conversation. |
| `participantState` | `map<string, map>` | Yes | Per-UID `{ lastReadAt, archivedAt, mutedUntil, deletedAt }`. |
| `lastMessage` | `map \| null` | No | Bounded preview `{ messageId, senderId, type, preview, createdAt }`. |
| `lastMessageAt` | `Timestamp \| null` | No | Sort key for inboxes. |
| `status` | `string` | Yes | `active`, `closed`, or `blocked`. |
| `createdAt` | `Timestamp` | Yes | Creation time. |
| `updatedAt` | `Timestamp` | Yes | Last conversation-level change. |

`participantIds` must remain small. Do not store all message IDs, full message
content, or an ever-growing event history in the conversation document.

### Example document template

```json
{
  "businessId": "<businessId>",
  "customerId": "<customer uid>",
  "participantIds": ["<customer uid>", "<business participant uid>"],
  "participantState": {
    "<uid>": {
      "lastReadAt": "<Timestamp|null>",
      "archivedAt": null,
      "mutedUntil": null,
      "deletedAt": null
    }
  },
  "lastMessage": null,
  "lastMessageAt": null,
  "status": "active",
  "createdAt": "<Timestamp>",
  "updatedAt": "<Timestamp>"
}
```

### Relationships

- `businessId` references `businesses/{businessId}`.
- `customerId` and `participantIds` reference `users/{uid}`.
- Messages live only under
  `conversations/{conversationId}/messages/{messageId}`.
- Notifications may reference a conversation and its latest message.

### Recommended indexes

| Query | Composite index |
| --- | --- |
| User inbox by latest message | `participantIds ARRAY_CONTAINS, lastMessageAt DESC` |
| User inbox filtered by status | `participantIds ARRAY_CONTAINS, status ASC, lastMessageAt DESC` |
| Conversations for a business | `businessId ASC, lastMessageAt DESC` |
| Customer conversations | `customerId ASC, lastMessageAt DESC` |

Disable indexing for `lastMessage.preview` and the dynamic `participantState`
map. Security rules must require the requesting UID to appear in
`participantIds`; list queries must include the matching participant filter.

## 6. `messages` subcollection

**Collection path:**
`conversations/{conversationId}/messages/{messageId}`  
**Document ID:** Firestore auto ID

Messages are immutable by default. Edits and soft deletion alter only explicit
fields and must preserve the original sender and creation timestamp.

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `senderId` | `string` | Yes | Sending participant UID. |
| `type` | `string` | Yes | Initially `text`; future bounded types may include `image` or `system`. |
| `text` | `string \| null` | Yes | Length-limited text for text messages. |
| `attachment` | `map \| null` | Yes | Future `{ path, downloadUrl, contentType, size, width, height }`. |
| `moderationStatus` | `string` | Yes | Message moderation state. |
| `editedAt` | `Timestamp \| null` | No | Last edit time. |
| `deletedAt` | `Timestamp \| null` | No | Soft-deletion/redaction time. |
| `createdAt` | `Timestamp` | Yes | Canonical chronological value. |

### Example document template

```json
{
  "senderId": "<participant uid>",
  "type": "text",
  "text": "<message text>",
  "attachment": null,
  "moderationStatus": "visible",
  "editedAt": null,
  "deletedAt": null,
  "createdAt": "<Timestamp>"
}
```

### Relationships

- The parent conversation supplies `conversationId`, `businessId`, and
  authorization context; these need not be duplicated into every message.
- `senderId` must be a participant in the parent conversation.
- Storage attachment paths should be scoped to the conversation and message.
- Reports may target a message using both conversation and message IDs.

### Recommended indexes

- The normal parent query ordered by `createdAt DESC` uses Firestore's automatic
  single-field index and requires no composite index.
- For collection-group moderation: `moderationStatus ASC, createdAt ASC` on the
  `messages` collection group.
- If sender-history administration is required later: `senderId ASC, createdAt
  DESC` on the collection group.

Disable indexing for `text`, attachment URLs, and unqueried attachment metadata.
Paginate message history; never attach a listener to an unbounded history.

## 7. `favourites`

**Collection path:** `favourites/{favouriteId}`  
**Document ID:** Deterministic `{userId}_{businessId}` to make add/remove
idempotent and enforce one favourite per user/business pair.

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `userId` | `string` | Yes | Owning customer UID. |
| `businessId` | `string` | Yes | Saved business ID. |
| `createdAt` | `Timestamp` | Yes | Time favourited. |

### Example document template

```json
{
  "userId": "<uid>",
  "businessId": "<businessId>",
  "createdAt": "<Timestamp>"
}
```

### Relationships

- `userId` references `users/{uid}`.
- `businessId` references `businesses/{businessId}`.
- Business display data should be joined in the client/service layer or copied
  only as a deliberately maintained bounded snapshot.

### Recommended indexes

| Query | Composite index |
| --- | --- |
| User favourites, newest first | `userId ASC, createdAt DESC` |
| Favourite count/administration by business | `businessId ASC, createdAt DESC` |

Security rules must allow users to read and mutate only favourites whose
`userId` matches their authenticated UID.

## 8. `reports`

**Collection path:** `reports/{reportId}`  
**Document ID:** Firestore auto ID

Reports are private moderation records and must never be publicly queryable.

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `reporterId` | `string` | Yes | Reporting user UID. |
| `targetType` | `string` | Yes | `user`, `business`, `review`, `conversation`, or `message`. |
| `targetId` | `string` | Yes | Primary target document ID. |
| `parentId` | `string \| null` | No | Parent ID needed for nested targets such as messages. |
| `reason` | `string` | Yes | Controlled reason code. |
| `details` | `string \| null` | No | Length-limited reporter context. |
| `evidence` | `array<map>` | Yes | Bounded metadata for approved evidence; no arbitrary external URLs. |
| `status` | `string` | Yes | `open`, `in_review`, `resolved`, or `dismissed`. |
| `priority` | `string` | Yes | `low`, `normal`, `high`, or `urgent`. |
| `assignedTo` | `string \| null` | No | Moderator UID. |
| `resolution` | `map \| null` | No | `{ action, notes, resolvedBy, resolvedAt }`. |
| `createdAt` | `Timestamp` | Yes | Submission time. |
| `updatedAt` | `Timestamp` | Yes | Last workflow update. |

### Example document template

```json
{
  "reporterId": "<uid>",
  "targetType": "<controlled target type>",
  "targetId": "<target document id>",
  "parentId": "<parent id|null>",
  "reason": "<reason code>",
  "details": "<optional context>",
  "evidence": [],
  "status": "open",
  "priority": "normal",
  "assignedTo": null,
  "resolution": null,
  "createdAt": "<Timestamp>",
  "updatedAt": "<Timestamp>"
}
```

### Relationships

- `reporterId`, `assignedTo`, and `resolution.resolvedBy` reference users with
  the appropriate roles/claims.
- `targetType`, `targetId`, and optional `parentId` resolve the reported entity.
- Reports may be retained or pseudonymized under a documented legal/moderation
  retention policy even when the reporter requests account deletion.

### Recommended indexes

| Query | Composite index |
| --- | --- |
| Moderation queue | `status ASC, priority DESC, createdAt ASC` |
| Reports assigned to moderator | `assignedTo ASC, status ASC, updatedAt DESC` |
| Reports for a target | `targetType ASC, targetId ASC, createdAt DESC` |
| Reports submitted by a user | `reporterId ASC, createdAt DESC` |

Disable indexing for `details`, evidence URLs/metadata, and resolution notes.

## 9. `notifications`

**Collection path:** `notifications/{notificationId}`  
**Document ID:** Firestore auto ID

Notifications are per-user inbox records. They are not a source of truth for
messages, subscriptions, or moderation decisions.

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `userId` | `string` | Yes | Recipient UID. |
| `type` | `string` | Yes | Controlled event type such as a future message or verification event. |
| `title` | `string` | Yes | Localizable or already localized short title. |
| `body` | `string` | Yes | Length-limited preview; avoid sensitive message content. |
| `data` | `map` | Yes | Bounded navigation IDs such as `{ conversationId, businessId }`. |
| `readAt` | `Timestamp \| null` | Yes | `null` until read. |
| `createdAt` | `Timestamp` | Yes | Creation time. |
| `expiresAt` | `Timestamp \| null` | No | Optional Firestore TTL field. |

### Example document template

```json
{
  "userId": "<recipient uid>",
  "type": "<notification type>",
  "title": "<short title>",
  "body": "<safe preview>",
  "data": {
    "conversationId": "<conversationId|null>",
    "businessId": "<businessId|null>"
  },
  "readAt": null,
  "createdAt": "<Timestamp>",
  "expiresAt": "<Timestamp|null>"
}
```

### Relationships

- `userId` references `users/{uid}`.
- IDs in `data` may reference conversations, businesses, reviews, or reports.
- Deleting a notification never deletes its source entity.
- Push delivery state, device tokens, and delivery attempts should use separate
  private infrastructure if Firebase Cloud Messaging is added.

### Recommended indexes

| Query | Composite index |
| --- | --- |
| User notifications, newest first | `userId ASC, createdAt DESC` |
| User unread notifications | `userId ASC, readAt ASC, createdAt DESC` |
| Notification maintenance by type | `type ASC, createdAt DESC` |

Configure `expiresAt` as a Firestore TTL field if automatic expiry is adopted.
Disable indexing for `body`, title text, and unqueried values inside `data`.

## Cross-collection integrity

Firestore does not enforce foreign keys. Integrity must be maintained through a
combination of security rules, atomic transactions/batched writes, and trusted
backend triggers or scheduled jobs:

- A business owner/manager must exist and have the `business` role before
  management access is granted.
- Category IDs written to a business must be active, valid, bounded, and
  deduplicated.
- Only conversation participants may read its messages or create a message.
- Review, favourite, report, and notification ownership fields are immutable
  after creation unless changed by trusted administration.
- Rating summaries and last-message previews are derived fields; clients must
  not update them directly.
- Deleting a parent Firestore document does not delete subcollections. Cleanup
  jobs must explicitly remove or retain message/media descendants.

## GDPR deletion and retention

Account deletion is a workflow rather than a single document delete:

1. Set `users.accountStatus` to `deletion_pending` and record
   `deletionRequestedAt` and `deletionScheduledFor`.
2. Prevent new protected activity while any allowed recovery window is active.
3. Delete or anonymize direct identifiers, profile media, favourites,
   notifications, and owned data according to the approved retention policy.
4. For content that must remain for conversation continuity, fraud prevention,
   legal obligations, or moderation, replace identity fields with a stable
   non-identifying tombstone and record `anonymizedAt`.
5. Transfer, unpublish, or delete businesses through an explicit owner/business
   workflow rather than implicitly orphaning them.
6. Recursively process subcollections and Storage objects; Firestore parent
   deletion alone is insufficient.
7. Delete the Firebase Authentication account only when the workflow reaches
   the appropriate final stage.

Retention periods and lawful bases must be confirmed before implementation.
Backups, analytics, reports, and payment-provider records require separate
retention decisions.

## Scale and operational guidance

- Use Firestore auto IDs for high-write collections to avoid sequential-key hot
  spots.
- Keep document sizes far below Firestore's 1 MiB limit and watch the 40,000
  index-entry limit, especially for arrays and maps.
- Rate-limit `lastActiveAt`; update it at coarse intervals rather than on every
  page view or message poll.
- Use aggregate queries for occasional counts. Use trusted counters only where
  real-time counts are required; adopt distributed counters if one business
  document becomes a sustained write hotspot.
- Prefer one real-time listener per visible bounded query. Detach listeners when
  screens are inactive and paginate older messages/reviews.
- Store media in Firebase Storage, not as base64/blob data in Firestore. Store
  canonical Storage paths; treat download URLs as replaceable metadata.
- Apply App Check, least-privilege security rules, validation limits, and role
  enforcement before exposing writes in production.
- Use custom claims only for coarse platform authorization such as moderator or
  administrator access. Keep changeable profile/business roles in Firestore.
- Export and monitor index usage, document growth, rejected security-rule
  requests, and read/write costs as query patterns evolve.
