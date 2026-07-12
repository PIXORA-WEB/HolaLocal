# Contact privacy repair dry run

This tool performs a narrow read-only check for the remaining hidden website value identified by the production Firebase audit. It does not write to Firestore, Firebase Authentication, Storage or local source directories.

It verifies:

- the public business document exists;
- `businesses/{businessId}.contact.website` is present;
- the website visibility setting is hidden;
- the matching `businessPrivate/{businessId}` document exists;
- whether the private website value already exists;
- whether the public value must be preserved privately before a later removal.

The report contains document paths and must be treated as confidential operational data. It never includes contact values, emails, tokens, credentials, signed URLs, descriptions, message content or report details.

Example production dry run, after credentials are configured and approved:

```sh
npm run audit:contact-privacy-repair-readonly -- \
  --project-id holalocal-491c9 \
  --confirm-project holalocal-491c9 \
  --audit-report <private-audit-report.json> \
  --output-dir <private-output-dir>
```

Do not treat a successful dry run as authorisation to apply a repair. A later write tool must first preserve or verify the private value, confirm Craig's visibility decision, and then remove only the approved public field.
