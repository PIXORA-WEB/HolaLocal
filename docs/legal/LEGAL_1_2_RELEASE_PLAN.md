# Legal 1.2 coordinated release — NOT AUTHORIZED

Local target: Privacy 1.2 and Terms 1.2, effective 2026-09-27. If publication misses that date, STOP and deliberately revise all current metadata/fixture/test owners together before release. Production stays 1.1 until authorized publication. LEGAL REVIEW RECOMMENDED; internal LIA is a draft.

## Separate server support

Use isolated server commit 1997116b54871d220d8489d16b97984f8a5b2bc2, separately reviewed and NOT cherry-picked into this branch. Do not edit/deploy cumulative functions/src/legalConsent.js or the cumulative Functions tree. Existing persisted field names are termsVersion/privacyVersion with termsAccepted/privacyAccepted and timestamps; notice fields are independent. Do not introduce parallel acceptedPrivacyVersion aliases or migrate history.

Deploy all four named isolated exports with gates absent/1.1: acceptLegalConsent, requestAccountDeletion, finalizeAccountDeletion, recoverAccountDeletions. Verify runtime/identity/scaling, dormant recovery and unchanged Scheduler. Stored 1.2 recognition then exists without admitting new 1.2 acceptance through the callable. No new application IAM is required for this server support.

## Rules and client preparation

Capture actual production Rules and rollback source immediately before release. Deploy/verify bounded 1.2-compatible Rules first; retain currentRejection, preference/cutoff and notice protections. Rules retain bounded historical registration compatibility. This is capability preparation, not authority for early 1.2 registration. Trusted release must finish all server pre-support before any 1.2 writes become possible.

Build/test this website and mobile source in advance but DO NOT deploy this website bundle as capability-only while documents remain 1.1: current metadata, public legal bodies and new-registration versions change together. The same concern applies to a mobile binary compiled from this branch. Stage immutable build artifacts without exposing them as production.

Older clients lacking notice capability cannot receive this notice. Clients bounded only through 1.1 ignore a 1.2 registry. Decide mobile readiness/minimum-client and communication/opt-out availability before publication/activation. No mobile preference UI is added here; verify an accessible web Profile opt-out path and communicate it before activation.

## Publication window — deliberate short registration pause

The public website bundle and Functions environment gates cannot be atomically updated by this source change. Do NOT advance acceptance gates before actual legal publication merely to avoid a short registration interruption.

1. Under separately authorized release procedure pause new registration/legal recovery using an explicitly reviewed operational mechanism. This repository does not implement a global maintenance switch; choosing/testing that mechanism is a release prerequisite. Existing historical users keep access.
2. Publish the approved website 1.2 legal/client bundle and verify Privacy/Terms bodies, versions and dates. Do not expose a new mobile 1.2 registration path before this point.
3. Immediately advance the isolated acceptLegalConsent publication gates independently to 1.2 using its reviewed Functions-managed environment update, preserving other env/settings. Verify new 1.2 callable acceptance; do not mutate existing acceptance records. If publication fails, do not advance gates.
4. Read legalPublications/current, verify bounded monotonic order, and advance both documents to 1.2/2026-09-27 using trusted transaction/precondition. Do not overwrite a concurrently newer version. Fixture: shared/firebase-contract/fixtures/legalPublications.current.json. No client write.
5. Verify returning historical 1.0/1.1 accounts with absent notice fields see a combined update notice. “I've seen the update” changes only notice versions; deferral writes nothing. Existing acceptance timestamps/versions remain intact.
6. Verify website/mobile current registration stores canonical 1.2/1.2 and notice baselines 1.2/1.2, then reopen registration. Release the prepared mobile update according to the readiness decision. Verify critical historical recovery/deletion paths remain compatible.

## Translation activation — only after legal/client prerequisites

Deploy the isolated translation worker with provider disabled; verify trigger/runtime identity and service-level max 20. Apply separately approved narrow Translation IAM, then provider activation and controlled-account production tests/monitoring following the translation runbook. No private customer-message inspection. Minimise the publication-to-activation interval, but missing legal/client/server safeguards are hard stops, not reasons to bypass sequencing.

## Rollback eras

Before ANY 1.2 evidence exists, original server-validator rollback may be used if otherwise safe. After ANY 1.2 evidence (or uncertainty), never restore the 1.0/1.1-only validator. Use the tested 1.2-recognition-compatible fallback and reset new-acceptance gates as needed, accounting for revision propagation/in-flight requests. Coordinate registration availability with gate reset.

Public legal registry versions MUST NOT be downgraded as ordinary rollback. Legal text/publication rollback requires a separately reviewed procedure. Preserve the existing Rules/source snapshots and website rollback artifact. No deployment, gate change, registry write, IAM or provider activation is authorized by this document.
