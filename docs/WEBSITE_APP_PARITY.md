# HolaLocal website and app parity

## Shared backend

`holalocal-app` and `holalocal-website` use the same Firebase project and the
same environment-variable contract. They share:

- Firebase Authentication accounts
- Firestore user profiles in `users/{uid}`
- Firestore business profiles in `businesses/{businessId}`
- Firebase Storage configuration for future shared media

Users authenticate against the same Firebase project, with independent
sessions per device or browser. The Firestore clients are not yet fully
compatible: both clients now interpret supported legacy records, but mobile
creation/contact/media and sparse-legacy editing remain deferred. Phase 1A
defines the target compatibility path; production has not migrated.

## Shared profile flows

The target is for both clients to use compatible user and business structures.
Batch 1 adds the pure shared definitions and adapters. Batch 2A applies them at
website user and business read boundaries. Batch 2B1 now applies the user
adapter at the mobile account boundary and makes new mobile registration and
profile/language writes use the canonical user model. Neither client repairs
legacy documents automatically. Cross-client compatibility is not complete.

The target shared flows include:

- Authentication and password reset
- User profile completion
- Customer, business, or combined account onboarding
- Business profile creation and editing
- Preferred UI locale (`preferredLocale`) and business primary language
- Custom subcategories, service areas, and spoken languages

## Current boundaries

The website retains its own responsive marketing and account UI; it does not
reuse the mobile navigation presentation. Marketplace search, messaging,
reviews, paid subscriptions, media uploads, and automatic translation remain
outside the current parity scope.

Future schema changes must be implemented compatibly in both clients before
deployment so either platform can safely read documents written by the other.

The approved target uses `businessOwners/{uid}` as the future uniqueness
boundary. `users/{uid}.businessId` will become a trusted-only pointer when the
clients, trusted creation path, and rules are updated. Existing UID-based
business IDs may remain authoritative after the future production audit. New
opaque-ID business creation will eventually be trusted and atomic.

Full contact values belong in `businessPrivate/{businessId}`; public documents
contain only explicitly enabled values. Language codes are canonical, while
legacy labels and custom values remain transitional compatibility inputs.
Rules, indexes, production audit, migration, and legacy cleanup are deferred.
Batch 2A website lookup validates the existing user pointer, legacy UID
document, and bounded `ownerId` query candidates that current rules permit. It
does not read `businessOwners`. Multiple valid candidates fail safely and
require audit or manual resolution; the website does not select or modify one.
Website registration, profile, business, contact, media, conversation, and
report writes remain on their existing canonical website paths.

Batch 2B2 now applies the shared business adapter and deterministic ownership
lookup to mobile reads. Existing businesses with canonical ownership,
lifecycle, and public-contact shape can submit a bounded canonical edit
payload without changing their document ID. Sparse or unsafe legacy records
remain read-only and are directed to the website or support.

New mobile business creation remains disabled before the legacy UID-based
write. Mobile contact and media editing also remain read-only because current
rules cannot accept the complete approved contact-visibility contract. Batch
2B2 derives mobile completion display locally from required business fields and
does not write `profileCompleted`. Current rules still permit some
transitional derived fields until a separately authorised tightening pass.
Batch 3/4 covers remaining compatibility and trusted creation/rules/indexes,
Batches 5–6 audit and migration tooling, and Batch 7 production migration.
Legacy cleanup remains a later separately authorised batch.

Phase 1A Batch 3 now provides read-only Firebase audit tooling under the
website scripts package. It is a preparation step only: the tool has not been
run against production, no production data conclusions have been established,
`businessOwners/{uid}` is still inactive, no migration has occurred, and no
rules or indexes have been tightened. A separate explicit approval is required
before running any production audit or using its results for migration
planning.
