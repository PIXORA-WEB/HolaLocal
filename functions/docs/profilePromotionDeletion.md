# Profile promotion and account deletion coordination

Local implementation, awaiting review/release. No worker/gate activation is part
of this change. Storage production timing is not established by emulator probes.

## Durable record and transitions

The existing `mediaUploadSessions/profile_{uid}` record remains authoritative.
`requestId`, principal, source generation, canonical destination and destination
precondition are retained. `promotionProtocol: 1` and `promotionObligation` add:

- `copying`: transactionally admitted; fresh user must be active and unrestricted.
  Only the invocation which made this transition may dispatch the single-attempt
  rewrite. Another finalization, preparation, deletion or expiry cannot release it.
- `copied`: the adapter returned a verified generation and Firestore durably saved
  it. The copy is no longer outstanding. An atomic user/session transaction either
  publishes the descriptor and settles, or chooses compensation permanently.
- `compensating`: only that exact destination generation may be removed. Failed
  removal or checkpointing retains the obligation. Owner finalization or the
  existing authorized deletion retry can resume; no recovery worker is enabled.
- `settled`: publication completed, or known-generation compensation acknowledged.
  Pre-copy cleaning rejection can also settle back to `uploaded` for safe retry.

Deletion restriction writes the user document read by admission. Deletion checks
restriction and session before listing Storage; any unresolved copy prevents the
media checkpoint, later review/profile/Auth removal and completion. The existing
finalizer lease/version and `profile_media_cleanup_failed` / `failed_retryable`
contract is unchanged. Counts include acknowledged compensation operations as well
as listed-object/session operations; they do not prove prior existence or bytes.

Publication and compensation cannot both win. Context removal occurs only after
publication; it is best effort and exact-generation conditional. Old-image and
staging removal retain the existing behavior. Only coordinated profile rewrites
disable SDK request retries; business media behavior is unchanged.

## Ambiguity and compatibility

A lost copy response, incomplete rewrite, failed generation checkpoint, or crashed
invocation leaves `copying` indefinitely. Expiry, cancellation, timeout and current
object absence are not settlement evidence. Request/destination/source evidence
and the Storage promotion context remain available; there is no automatic re-copy,
expiry deletion or force-complete escape. Cancellation can clear the account
restriction under existing rules but cannot replace an unresolved upload session.

Prepared/uploaded legacy sessions can enter the protocol. Completed legacy sessions
are settled. Legacy `promoting`/`promoted`, or unsuccessful sessions already bearing
a promoted generation, remain blocked: the old protocol cannot establish the new
single-attempt guarantee. These require authorized reconciliation, not a backfill.

**Missing capability:** no operator endpoint/tool currently proves remote rewrite
termination and durably reconciles ambiguous or legacy obligations. Existing retries
handle known generations only. Before operational release, define an authorized,
auditable reconciliation procedure capable of proving termination and attribution;
a one-time object lookup is insufficient. Until then such accounts may stay blocked
indefinitely. No reconciliation was performed by this patch.

## Release and rollback requirements (not executed)

Deploy the coordinated profile finalizer, prepare/session helpers, deletion cleanup
and staging sweeper together. Drain/quiesce old profile-finalization invocations
before relying on this invariant; mixed old/new writers cannot supply it. An old
finalizer can still use its stale authorization snapshot. Do not roll back session
writers/sweepers while protocol obligations exist without a reviewed compatibility
plan. No rules, policies, acknowledgments, Analytics choice or recovery gates change.

## Evidence limits

Adapter tests cover exact-generation replacement preservation and fault boundaries.
Firestore emulator tests cover real persisted transactions/checkpoints and real
Auth/deletion flow. Its Storage implementation ignores rewrite generation
preconditions and drops promotion contexts; its synchronous rewrite is not production
timing evidence. A supported save/delete scenario tests known-generation resumption
but does not certify conditional deletion. Request-construction assertions separately
check production preconditions and retry settings. Cloud timing/generation acceptance
and Functions HTTP invocation of this new protocol remain unexecuted.

## Default-closed cutover compatibility controls

This additional local compatibility candidate is not deployed. It does not control
old binaries or retroactively cancel remote operations. The externally verified
containment and mixed-version cutover described above are still prerequisites.

Authoritative Firestore document: `mediaCutoverControls/current`:

```
{
  schemaVersion: 1,
  version: <positive integer>,
  updatedAt: <Firestore timestamp>,
  provenance: <nonempty evidence/change reference, maximum 500 characters>,
  profileAdmission: <boolean>,
  profileSettlement: <boolean>,
  accountDeletion: <boolean>,
  stagingProcessing: <boolean>
}
```

Every field is required. Missing/malformed documents or failed reads close access.
All permissions must explicitly be true for their respective operation; there is
no environment fallback or cached open decision. This module supplies no control
mutation endpoint. A future authorized control writer must compare the observed
version transactionally, increment it, and preserve an auditable before/after
record. Blind replacement or restoring an old configuration snapshot is unsafe.

| Permission | Closed behavior |
| --- | --- |
| profileAdmission | No profile preparation/session replacement or new copy admission. Existing returned-copy checkpoints may still be persisted; this does not authorize another copy. |
| profileSettlement | No publication or owner-driven compensation. `copying` may save its returned exact generation as `copied`; an already-issued compensation may save its truthful settlement checkpoint. Closed is not cancellation of an already-dispatched operation. |
| accountDeletion | No new finalizer execution/lease, including internal recovery; no subsequent destructive step, profile minimization, canonical-session deletion or completion. Failure/evidence checkpoints may persist. Existing completed responses do not grant further work. |
| stagingProcessing | Events are durably deferred, scheduled processing does no cleanup, and sessions/objects are retained. This also pauses the shared business staging processor; business callable promotion logic is otherwise unchanged. Profile finalization's own authorized cleaning is governed by its profile control. |

When `accountDeletion` is open it independently authorizes known-generation
compensation as a deletion prerequisite, even if owner-driven `profileSettlement`
is closed. An account hold blocks both. Each bounded core stage is authorized before
dispatch; closure cannot recall an issued Storage/Auth/batch request. An admitted
subordinate cleanup stage may finish its internal batch requests; the next stage
and terminal transactions recheck controls/holds. This is not a kill switch. Transactional
admission, user minimization, canonical-session deletion and final completion read
controls/holds in the same transaction as their writes. A hold installed after an
external request was dispatched prevents later completion, not that request's effect.
No deployment procedure may mistake these controls for instantaneous quiescence.

### Account-scoped holds

`mediaCutoverHolds/{uid}` is independent of `mediaUploadSessions/profile_{uid}`:

```
{
  schemaVersion: 1, uid: <matching account ID>, state: "held",
  version: <positive integer>, reason: <bounded reason>,
  provenance: <evidence reference>, createdAt: <timestamp>, updatedAt: <timestamp>
}
```

Any existing hold blocks work unless it is a structurally valid reserved `released`
record: matching uid, schema 1, version >= 2, reason/provenance/releaseEvidence
(nonempty strings <= 500 characters), createdAt/updatedAt/releasedAt timestamps.
**No release writer or endpoint is implemented.** Structural validity is not a
reconciliation procedure or permission to fabricate release evidence. A future
release implementation must prove termination/attribution, use transactional
version checks and preserve the original evidence. Do not delete a hold to resume.

Absent hold documents permit an otherwise authorized account. This is not evidence
that a legacy account is safe: production inventory/hold creation is still missing.
A default-closed global control is necessary until inventory coverage is established.
Cancellation changes only the existing user/request records and cannot release a
hold. Session replacement, expiry and successful deletion do not delete holds.
Existing rules' default deny prevents client reads/writes, including client-admin
claims, for controls, holds and the deferred-event collection. No rules change is
needed. Admin SDK authority is separate; this patch cannot protect against an
out-of-band privileged overwrite/deletion.

### Durable staging intake and replay

`mediaStagingDeferredEvents/{sha256([bucket-or-null, path, generation])}` records the
minimal source identity and upload-session marker before processing/acknowledgment.
Records have schemaVersion/version, pending/completed state, provenance and original
createdAt/updatedAt. Duplicate intake never resets a completed record or replaces
its evidence. Completion increments the version transactionally. Rows are retained;
no TTL, deletion, hold release or promotion reconciliation is introduced.

Closed/held/unavailable control reads return `deferred` only after durable intake.
Processing failures leave the row pending. A compatible open `sweepStagingMedia`
replays one page of at most 50 pending rows, explicitly ordered by document ID.
`maintenanceProgress/stagingDeferredReplay` owns `{schemaVersion: 1, revision,
cursor, updatedAt}`. Cursor is the last attempted document ID, or null after a
short/empty page. Pending held, failed and unattributable events are not discarded.

Each worker reads persisted progress, queries `state == pending` ordered by document
ID, and attempts that page before transactionally advancing the cursor. Advancement
compares the original revision; a concurrent/stale worker cannot rewind newer
progress, including after wraparound (revision never resets). Concurrent attempts
can duplicate processing; existing exact-generation/idempotent processing remains
authoritative. The cursor is not an authorization or an exclusive processing lease.

Query failure never advances progress. Checkpoint failure or a crash repeats a page;
a lost checkpoint response is resolved by reading the durable revision next time.
A deleted/completed cursor document remains a valid scalar boundary. Insertions
behind the cursor are visited on the next cycle; insertions ahead can join this
cycle. A full final page takes one subsequent empty query to wrap. No process-local
state is required. Never reset/delete the progress revision while workers may be
in flight; no reset endpoint is provided. Progress uses the existing server-only maintenance collection.
No new composite index is required: the automatic ascending `state` index includes
the document-ID tie-breaker used by this equality query.

Replay is bounded to one progress read, one <=50-document page query, <=50 handler
attempts and one progress transaction per sweep (plus bounded SDK transaction
retries and the existing separate expiry/conflict pages). Fair visitation assumes
recurring successful sweeps/checkpoints, terminating attempts, and a backlog/growth
rate that permits reaching the end. Permanent failures cannot monopolize the first
page. Continuous unbounded arrivals or repeated infrastructure failures provide no
unconditional completion deadline. Authorization or successful cleanup is never
implied by fair scheduling. Unknown promotion outcomes remain blocked.

Completed event records still retain UID-bearing paths/markers indefinitely.
Approved retention/minimization and its implementation remain a release blocker;
this correction does not choose a retention period or delete evidence.

If intake itself cannot persist, the event invocation fails. `cleanStagingMediaObject`
now explicitly requests trigger retry (`retry: true`) in source. This is a deployment
configuration change, not an activation performed locally. Event retention is finite;
prolonged Firestore failure or pre-cutover dropped events still require an authorized
inventory/recovery capability. Neither quiet logs nor eventual object absence proves
that all event work was captured. Retry/backlog behavior needs later production
read-only confirmation; the local emulator does not certify Eventarc delivery.

### Compatibility rollback and release surface

Affected exports: `prepareProfileMediaUpload`, `finalizeProfileMedia`,
`finalizeAccountDeletion`, `cleanStagingMediaObject`, `sweepStagingMedia`, and
`recoverAccountDeletions` (which remains independently disabled). The unmodified
`requestAccountDeletion`/`cancelAccountDeletion` contract still supplies restrictions;
neither clears holds. Core checks also cover internal recovery calls and direct
finalizer calls. The shared media-session preparation helper gates profile sessions
only. Website, rules, policy, acknowledgments and Analytics resources are unchanged.

A reviewed build of this candidate with controls closed can become a compatibility
rollback target because it retains obligations, holds and deferred work. It is not
safe to roll back to 668d174 or earlier while depending on cutover holds: those
binaries do not read them. A rollback is still unsafe if old invocations remain,
control state is accidentally open, required schema versions become unsupported,
or event intake/delivery cannot preserve work. Closed controls do not prove remote
termination, undo partial deletion, or make a non-atomic deployment safe.

Missing: verified exclusion of old executable paths, comprehensive uncertainty
inventory/production holds, authorized evidence-based reconciliation, and approved
outage/backlog/indefinite-hold operator procedures. Automatic deletion recovery stays
disabled. No production control documents, holds, reconciliation or gate changes
were made by this implementation.
