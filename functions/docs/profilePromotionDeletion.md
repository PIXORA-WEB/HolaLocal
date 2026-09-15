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
