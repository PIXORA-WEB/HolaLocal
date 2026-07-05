# Website Firebase setup

The HolaLocal website uses the same Firebase project as `holalocal-app`. This
shared backend will allow users to use the same Firebase Authentication account
and access the same permitted Firestore data, Storage files, and conversations
from either platform.

## Environment configuration

Firebase web configuration is supplied through Vite environment variables.
Copy `.env.example` to `.env` and populate every `VITE_FIREBASE_*` value with
the configuration for the shared HolaLocal Firebase web app.

Never commit `.env`. The file is ignored by git and each deployment environment
must provide its own values. `.env.example` contains only the required variable
names and is safe to commit.

## Firebase services

- Firebase Authentication will initially use Email/Password accounts shared
  with the mobile app.
- Cloud Firestore will provide shared access to users, businesses, categories,
  conversations, and messages, subject to future security rules.
- Firebase Storage will hold shared business logos and photos later.
- Firebase Analytics initializes only when running in a supported browser.

The files in `src/firebase` currently expose configured service instances and
extension points only. They do not implement authentication UI, database
operations, uploads, mock data, or business functionality.

## Missing business private documents

The one-time migration at `scripts/migrateBusinessPrivate.js` finds existing
`businesses/{businessId}` records that do not have a matching
`businessPrivate/{businessId}` record. It copies the available contact details
and visibility preferences into the private record without changing or deleting
anything in the public business record.

Run it from `apps/holalocal-website` with Node 20 or newer and Firebase Admin
Application Default Credentials that can access the intended project. For
example, set `GOOGLE_APPLICATION_CREDENTIALS` to a securely stored service
account credential file; never commit that file.

Always review a dry run first:

```sh
npm run migrate:business-private -- --project=your-firebase-project-id
```

The output identifies missing document IDs and lists which contact fields and
settings would be copied, without printing private contact values. A limited
dry run is also available with `--limit=20`.

After reviewing the target project and output, explicitly enable writes:

```sh
npm run migrate:business-private -- --project=your-firebase-project-id --apply --confirm=MIGRATE_BUSINESS_PRIVATE
```

The migration is idempotent: it only creates documents that are still missing,
rechecks each document in a transaction immediately before creation, and can be
run repeatedly. It never deletes legacy public contact fields. Normal business
profile saves also merge the private document, creating it when missing.

## Public contact privacy audit

Firestore cannot hide individual fields from a readable document. Rules reject
public reads of active businesses that still contain hidden contact values or
legacy top-level contact fields. After reviewing the private-document migration,
run the non-writing audit:

```sh
npm run audit:public-contacts -- --project=your-firebase-project-id
```

It reports document IDs and field names, never contact values, and skips records
without a private copy. Confirmed cleanup is separate and explicit:

```sh
npm run audit:public-contacts -- --project=your-firebase-project-id --apply --confirm=CLEAN_PUBLIC_BUSINESS_CONTACTS
```

Cleanup is idempotent. It blanks hidden public values and removes legacy top-level
phone/email/WhatsApp fields without modifying `businessPrivate`. Never use
`--apply` until both dry-run reports have been reviewed.
