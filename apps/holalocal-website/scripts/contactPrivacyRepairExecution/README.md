# Contact privacy repair execution

This is the controlled execution companion for the contact privacy repair dry run. It is scoped to one approved production finding: a hidden website value still present in the public `businesses` document while the matching `businessPrivate` value is already preserved.

Dry-run is the default. Applying the repair requires:

- `--apply`;
- exact `--project-id` and `--confirm-project`;
- the approved dry-run JSON report;
- the exact affected `businesses/{businessId}` path from that private report;
- `--confirm-repair "REMOVE CONFIRMED HIDDEN PUBLIC WEBSITE"`.

The only apply operation is:

- set `businesses/{businessId}.contact.website` to `""`;
- set `businesses/{businessId}.contact.websiteVisible` to `false`.

The tool does not delete documents, modify Authentication, modify Storage, change private contact values, update trust fields, or use collection-wide writes.

Reports are confidential operational data because they contain document paths. They must be written outside the repository.
