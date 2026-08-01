# HolaLocal shared Firebase contract

This dependency-free ESM package defines the approved Phase 1A target contract.
It contains controlled values, field classifications, compatibility adapters,
normalisers, contact projections, lookup result models, validators, and stable
machine-readable issue codes.

The modules are pure: they do not import Firebase, read documents, perform
writes, log contact values, or change either client's runtime behavior.

`ISSUE_CODES` is the authoritative list of report codes and
`ISSUE_CODE_DESCRIPTIONS` documents their meaning. `ISSUE_CODE_METADATA`
classifies each code by category and severity so future tooling never needs to
parse English text. Codes are append-only once used by an audit or migration
report.

The target contract is version `1`. This version describes a planned contract;
it does not assert that production data, deployed rules, or either client have
already migrated.

## Consumption

The package exposes one browser-safe public entry point through `exports["."]`.
It has no runtime dependencies, Node-only imports, side effects, Firebase
access, or subpath API. Both Vite clients can consume it later by declaring a
workspace or local `file:` dependency; that integration and resulting lockfile
changes belong to a later batch. No source copying is required. Until such a
dependency is declared, package-name imports are intentionally unavailable.

Contract field access and visibility classifications apply to every descendant
of a map field unless a child override is explicitly documented. This makes,
for example, every `subscription.*` field trusted-only and every public-contact
projection field derived.

Compatibility adapters are analysis/read models (`writeSafe: false`), not
migration decisions or Firestore payload builders. A non-empty canonical value
takes precedence over its legacy equivalent; fallback use and conflicts are
reported. Canonical contact maps remain separate from top-level legacy contact
candidates, and legacy media URLs are never synthesized into canonical media
metadata.

Custom identifiers use a normalized label, a fixed namespace, a bounded
readable prefix, and a deterministic 64-bit non-cryptographic fingerprint.
They are stable in browsers, Capacitor and Node, and are suitable for matching
compatibility values. As with any finite fingerprint, collision risk is not
zero; future audit/migration tooling must retain the original label and report
an identifier associated with more than one distinct normalized label.

Array bounds are defensive document-size ceilings, not UI entitlements:
`roles: 2` follows the two approved roles and `galleryImages: 8` matches the
current website limit. The manager, language, category and service-area limits
are intentionally above current UI choices and must be reviewed before rules
enforce them; clients may impose smaller limits.

`holalocal`, `phone`, `email`, and `whatsapp` are the current preferred-contact
methods. Website is a separately visible public contact value, not a preferred
method in current product code.
