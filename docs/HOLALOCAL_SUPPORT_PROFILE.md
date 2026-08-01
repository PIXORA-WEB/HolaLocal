# HolaLocal Support profile

> Phase 1A target status: production data and deployed rules have not been
> migrated. Legacy fields and UID-based business IDs may still exist. The
> shared target contract must not be described as already deployed. Batch 3
> read-only audit tooling exists, but it has not been run against production and
> does not authorise provisioning, duplicate resolution, or migration.

The official support listing is a normal `businesses/{businessId}` profile. It
must have a real Firebase Authentication owner so the existing conversation
flow can route messages to an inbox. It is intended for questions, product
feedback, and onboarding help—not as a public complaints channel.

## Provisioning

This repository does not contain a privileged seed runner or Firebase Admin SDK.
Do not put admin credentials in the website to create this profile. The steps
below describe the intended operational result, not an action authorised by
Phase 1A. Do not provision or reconcile the profile until production has been
audited and the appropriate operational task is separately authorised:

1. Create the official Firebase Authentication account for
   `hello@holalocal.es`, then sign in as that account.
2. Choose **Become a business** only after checking production for an existing
   support profile. Current clients do not yet share a concurrency-safe
   uniqueness boundary, so onboarding alone cannot guarantee no duplicate.
3. Enter and save the following values:

   | Field | Value |
   | --- | --- |
   | Business name | `HolaLocal Support` |
   | Main category | `Platform Support` |
   | Service areas | `Costa del Sol`, `Gibraltar` |
   | Languages | `en`, `es` |
   | Primary language | `en` |
   | Public email | `hello@holalocal.es` |
   | Subscription | `free` |
   | Description | `Questions, feedback and onboarding help for using HolaLocal. For trust and safety concerns about a listed business, use Report Business. Formal support requests can be sent to hello@holalocal.es.` |

4. From the trusted Firebase administration environment, complete the canonical
   moderation fields: set `status` to `active`, `verificationStatus` to
   `verified`, and set `publishedAt`, `verifiedAt`, and `updatedAt` with
   server timestamps. `profileCompleted` is transitional derived metadata only;
   do not use it as evidence for publication, verification, subscription, or
   public-read eligibility. During the current schema transition, do not treat
   legacy `isActive` or `isVerified` fields as trusted evidence.
5. Confirm that `ownerId` is the official account UID. Do not assume the
   document ID equals that UID: the website currently creates auto-ID documents
   and mobile Batch 2B2 resolves pointers, legacy UID documents, and `ownerId`
   candidates without choosing between duplicates. Resolve any conflict only
   through the future authorised audit and migration process.

After the public marketplace routes are launched, the profile should use its
stable `{businessId}` URL and the same private messaging flow as other
businesses. Those public routes are not asserted to be live by this document.
Future privileged seed tooling should make provisioning idempotent while
preserving the audit-approved owner and document identity.

## Ongoing use

The future `businessOwners/{uid}` mapping and `users/{uid}.businessId` pointer
will be trusted-only but are not backfilled or read at runtime. Full contact values
belong in `businessPrivate/{businessId}`. Hidden values in a public document are
a privacy issue even when concealed by UI. Preserve and report unknown custom
language values rather than translating or replacing them.

- Keep support copy focused on feedback, questions, and onboarding help.
- Direct moderation and trust/safety concerns to **Report Business**.
- Handle formal complaints privately through `hello@holalocal.es`.
- Never expose reports, reporter identities, or moderation state on this public
  profile.
