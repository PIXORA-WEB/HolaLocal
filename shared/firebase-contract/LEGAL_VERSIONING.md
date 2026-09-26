# Legal version changes

Current Terms and Privacy remain independently versioned at 1.1, effective
2026-09-13. This foundation adds no renewal requirement or persistence field.

## Three separate questions

- `CURRENT_*_VERSION` / `CURRENT_*_EFFECTIVE_DATE`: which text is published now?
- `SUPPORTED_*_VERSIONS`, `hasValidTermsAcceptance`,
  `hasValidPrivacyAcknowledgment`, `hasHistoricalLegalEvidence`: is the stored
  version recognized evidence with the required flag and timestamp?
- `LEGAL_ACCESS_VERSION_REQUIREMENTS` / `hasValidLegalConsent`: does that
  evidence meet today's access requirements?

`hasCurrentLegalConsent` answers only whether both stored versions equal the
current publication. It is not the website access policy. The missing-evidence
recovery callable uses historical evidence; it does not renew valid evidence.

Existing users' version values/timestamps are never migrated by a publication
change or login. Terms and Privacy remain separate fields. Legacy client
requests without explicit version fields still identify the documents those
clients displayed; they are not silently relabelled as current.

## Always required for a future publication (for example 1.2)

1. Approve legal bodies and all affected translations, versions and actual
   effective dates. Update each changed document's canonical current constants.
2. Deliberately add the approved version to its supported evidence list without
   dropping previous recognized evidence. Mirror the bounded list in
   `supportedTermsVersion` / `supportedPrivacyVersion` in `firestore.rules`.
   The contract test checks parity; Rules cannot import JavaScript.
3. Verify server acceptance validation and all server consumers of the shared
   contract use a compatible packaged version. Updating website source does
   not update deployed server dependencies. Plan any releases separately;
   cumulative Functions deployment remains blocked.
4. Website and mobile registration already import the independent canonical
   current versions. Rebuild/release them in a coordinated order with compatible
   Rules/server support first. Do not add literal versions to either client.
5. Test current registration, supported mixed pairs, unknown-version rejection,
   historical evidence preservation, missing-evidence recovery, profile/login
   preservation, and access behavior for old and current clients.

## Policy-dependent, unresolved

Decide separately whether existing users need no action, a notice, a read
acknowledgement or renewed agreement. Any change to access requirements, route
gating, document-specific renewal UI or trusted evidence writer needs its own
review. Do not implement renewal by deleting historical versions from evidence
recognition. Do not mislabel a notice dismissal or translation preference as
legal acceptance. A future access-policy decision does not authorize recovery
to overwrite valid historical evidence.

No migration, automatic acceptance upgrade, legal-copy change, new prompt,
version bump or deployment is authorized by this foundation.
