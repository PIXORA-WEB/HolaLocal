# First administrator bootstrap

This utility uses the established `admin: true` custom claim. It is not exposed through the website and defaults to a read-only dry run.

Use an already-authorised Admin SDK environment. Never add service-account JSON to this repository.

First inspect the account:

```bash
node scripts/bootstrapFirstAdmin.mjs --project-id YOUR_PROJECT_ID
```

Confirm the exact UID and existing claims, then run the separately authorised operation:

```bash
node scripts/bootstrapFirstAdmin.mjs --project-id YOUR_PROJECT_ID --expected-uid EXACT_UID_FROM_DRY_RUN --apply
```

The script aborts if the email is absent, differs from `hello@holalocal.es`, is unverified, or the UID confirmation differs. Existing claims are preserved. If `admin: true` already exists, it exits successfully without rewriting claims.

After assignment, sign out and back in (or explicitly force-refresh the Firebase ID token) before opening `/admin`.

Do not run the apply command against production without a separately reviewed and authorised production operation.
