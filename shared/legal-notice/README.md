# Legal update notice foundation — not a release authorization

This local release candidate publishes Privacy and Terms 1.2, effective 2026-09-27, only after separate release authorization. Production remains 1.1 until that coordinated release. See ../../docs/legal/LEGAL_1_2_RELEASE_PLAN.md. Notice introduction remains fixed at 1.1.

## State and publication contract

`users/{uid}.privacyNoticeVersion` and `termsNoticeVersion` are optional private
notice state, never legal acceptance. Explicit acknowledgement writes the displayed
current version only; new registration initializes a baseline from current documents
actually accepted. That initialization is not a record of clicking an update notice.
Missing/malformed notice state uses fixed 1.1 introduction baselines for due logic;
no migration or login/repair write occurs. Privacy/Terms remain independent.

`legalPublications/current` is a single public GET-only registry, no client writes.
Its exact four-field schema/proposed 1.2 publication values are in
`../firebase-contract/fixtures/legalPublications.current.json`. This fixture is NOT
published by the application. Admin/trusted release tooling must inspect existing state and advance it only after publication. For an initial foundation bootstrap, use 1.1/2026-09-13 for both documents, not this proposed 1.2 fixture.
Current supported version ordering comes from the bounded shared legal contract;
unknown, malformed, missing, older-than-bundled or same-version/different-date
registries are ignored, not turned into notices. The snapshot subscription retries
terminal read failures after 30 seconds and cleans up on logout/unmount. Normal
access is not blocked. No timestamp is synthesized for a publication.

This foundation deliberately does not accept arbitrary future registry versions.
A future legal release MUST extend bounded shared/Rules version support and release
compatible clients in advance. The current foundation alone will not display a
registry version it cannot validate. Synthetic future values exist only in tests.
Registry changes discover supported publications in running clients without forcing
a reload. Never reuse an existing version identifier for a changed document.

## Presentation and persistence

One coordinator is mounted above routes on each surface. Root wrappers keep it
mounted during profile refresh; UID changes/unmount clear deferral and pending state.
It waits for a usable active profile/authentication, avoids recovery/legal routes,
and can appear during authenticated onboarding without blocking its state permanently.
Remind later, Escape and backdrop close only defer for this in-memory session and
publication pair; they do not persist. Opening legal links is optional and never
counts as acknowledgement. Recognized notice versions never regress: a newer stored
acknowledgement is preserved if the registry rolls back, and is not shown as due.
A combined acknowledgement may advance the other document independently. Successful saves update local baseline only after commit.
If a newer publication appears during saving, a stale displayed version is rejected.
The existing public legal-page URLs are linked; no version-pinned archive is introduced.

Client transactions re-read the profile and registry. Only selected notice fields
and existing required `updatedAt: serverTimestamp()` are written. Acceptance flags,
versions/timestamps and all other fields are untouched. Rules reject mixed
notice/acceptance or unrelated-profile writes. `updatedAt` is normal write metadata,
not a notice timestamp or consent evidence. No Functions/callable/server deployment
is required for this notice mechanism. Admin access bypasses client Rules.

Website uses 17 notice translations; mobile renders only its existing six supported
UI locales: en, es, fr, de, nl, pt. The shared copy module does not expand mobile's
language selector or full-app localization. Both reuse the same dialog/client logic.

## Future release sequence — document only

1. Review shared contract, Rules, both clients, focused test/browser evidence.
2. Under separate authorization establish registry at 1.1/1.1 through trusted tooling.
   Client writes remain denied. No account notice-state migration.
3. Deploy and verify compatible Rules before notice-capable clients register/write.
4. Deploy website, release mobile, verify no false retrospective 1.1 notice.
5. Assess sufficient client readiness. Older pre-notice apps cannot receive notices;
   future requirements may need a minimum mobile version or another communication
   method. This v1 promises notice on return to a compatible notice-capable client,
   not email/push delivery to inactive accounts.
6. Before a future version, deliberately coordinate bounded shared/Rules support,
   legal body/date/publication metadata, registration and server acceptance consumers.
   Cumulative Functions deployment remains blocked; this foundation does not resolve
   that separate release dependency. Do not publish an unsupported registry version.
7. Publish approved legal content before changing the registry pointer; verify both
   clients receive a notice. Registry and canonical current metadata must agree.
   Decide future renewal/access policy separately. Notice is not an acceptance gate.

Several missed versions are represented by the current changed document notice,
not individual historical delivery receipts. No per-release receipt ledger, policy
archive, reacceptance, analytics, proactive outreach or translation behavior is added.
No production registry exists as a result of this work. Translation/provider remain
disabled. No Rules, website, mobile or Functions deployment is authorized here.

## Monotonic publication safeguard

LEGAL PUBLICATION REGISTRY MUST NEVER BE DOWNGRADED. Before a trusted publication
update, re-read the currently published registry and compare each proposed version
using the bounded per-document ordering. Stop if either proposal is older. Apply
the publication update with a transaction/precondition so a concurrent publication
cannot be overwritten by an older one. Registry rollback is not a normal recovery
mechanism. Rolling back legal content/version requires a separately reviewed
procedure; do not simply decrement the registry. Shared supported ordering and the
Rules notice-rank maps must be extended together for any future approved version.
