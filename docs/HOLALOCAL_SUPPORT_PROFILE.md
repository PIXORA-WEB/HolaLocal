# HolaLocal Support profile

The official support listing is a normal `businesses/{businessId}` profile. It
must have a real Firebase Authentication owner so the existing conversation
flow can route messages to an inbox. It is intended for questions, product
feedback, and onboarding help—not as a public complaints channel.

## Provisioning

This repository does not contain a privileged seed runner or Firebase Admin SDK.
Do not put admin credentials in the website to create this profile. Provision it
once through the existing authenticated onboarding flow:

1. Create the official Firebase Authentication account for
   `hello@holalocal.es`, then sign in as that account.
2. Choose **Become a business**. The existing transaction creates or resumes the
   single business document associated with that owner; rerunning onboarding
   cannot create a second profile for the same account.
3. Enter and save the following values:

   | Field | Value |
   | --- | --- |
   | Business name | `HolaLocal Support` |
   | Main category | `Platform Support` |
   | Service areas | `Costa del Sol`, `Gibraltar` |
   | Languages | `English`, `Spanish` |
   | Primary language | `English` |
   | Public email | `hello@holalocal.es` |
   | Subscription | `free` |
   | Description | `Questions, feedback and onboarding help for using HolaLocal. For trust and safety concerns about a listed business, use Report Business. Formal support requests can be sent to hello@holalocal.es.` |

4. From the trusted Firebase administration environment, complete the canonical
   moderation fields: set `status` to `active`, `verificationStatus` to
   `verified`, `profileCompleted` to `true`, and set `publishedAt`, `verifiedAt`,
   and `updatedAt` with server timestamps. During the current schema transition,
   retain the app-compatible `businessName`, `mainCategory`, `isActive`, and
   `isVerified` fields written by the editor alongside their canonical fields.
5. Confirm that `ownerId` is the official account UID. The current website uses
   that UID as the business document ID to guarantee one profile per owner; do
   not create a second auto-ID document for the same support account.

After publication, the profile is returned by the existing Services query, can
be linked at `/services/{businessId}`, and uses the same private messaging flow
as every other business. Future privileged seed tooling should migrate this
procedure into an idempotent Admin SDK task while preserving the same owner and
document identity.

## Ongoing use

- Keep support copy focused on feedback, questions, and onboarding help.
- Direct moderation and trust/safety concerns to **Report Business**.
- Handle formal complaints privately through `hello@holalocal.es`.
- Never expose reports, reporter identities, or moderation state on this public
  profile.
