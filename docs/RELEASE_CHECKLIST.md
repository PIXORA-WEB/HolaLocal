# HolaLocal Early Access Release Checklist

## Release Candidate

- [x] Final Early Access release-readiness audit completed
- [x] Verdict: `CONDITIONALLY READY FOR EARLY ACCESS`
- [x] Release candidate committed locally
- [x] Release candidate commit recorded
- [x] Repository worktree confirmed clean
- [x] Release-critical untracked files preserved

## Production Safety

- [x] Fresh production read-only audit completed
- [x] Production document counts confirmed
- [x] Dedicated Firestore backup bucket created
- [x] Backup bucket security configuration verified
- [x] Firestore export completed successfully
- [x] Backup includes `businesses`
- [x] Backup includes `businessPrivate`
- [ ] Revalidate contact privacy repair dry-run for drift
- [ ] Approve the single production privacy repair
- [ ] Execute the controlled privacy repair
- [ ] Run post-repair production read-only audit
- [ ] Confirm production privacy errors are `0`

## Deployment Preparation

- [ ] Confirm final release candidate commit
- [ ] Confirm production environment variables
- [ ] Confirm moderator/admin operator account and custom claims
- [ ] Prepare moderation operator runbook
- [ ] Confirm Firestore index deployment plan
- [ ] Confirm Functions deployment plan
- [ ] Confirm website deployment plan
- [ ] Confirm Firestore and Storage rules deployment plan
- [ ] Confirm rollback steps and stop conditions

## Deployment

- [ ] Deploy Firestore indexes
- [ ] Confirm required indexes are ready
- [ ] Deploy Firebase Functions
- [ ] Smoke-test `updateAccountRole`
- [ ] Smoke-test `ensureOwnerBusiness`
- [ ] Smoke-test `sendMessage`
- [ ] Smoke-test `moderateBusiness`
- [ ] Deploy website
- [ ] Deploy Firestore rules
- [ ] Deploy Storage rules
- [ ] Leave mobile unchanged unless separately approved

## Browser and End-to-End Verification

### Customer

- [ ] Register a new customer
- [ ] Verify customer email
- [ ] Complete customer profile
- [ ] Sign out and sign back in
- [ ] Browse directory
- [ ] Open a public business detail page
- [ ] Start a conversation
- [ ] Send a message
- [ ] Retry a message and confirm no duplicate
- [ ] Confirm unread state behaves correctly

### Business Owner

- [ ] Register a new business user
- [ ] Verify business email
- [ ] Select `business` or `both`
- [ ] Create or recover the owner business
- [ ] Confirm duplicate business creation is prevented
- [ ] Edit draft profile
- [ ] Configure public and private contact visibility
- [ ] Upload supported media
- [ ] Submit the business for review
- [ ] Confirm status is displayed correctly

### Moderator

- [ ] Review a pending business
- [ ] Publish an eligible business
- [ ] Confirm the business appears publicly
- [ ] Reject a pending business
- [ ] Suspend an active business
- [ ] Restore an eligible suspended business
- [ ] Confirm invalid transitions fail safely

### General Website

- [ ] Test desktop layout
- [ ] Test mobile-width layout
- [ ] Test shared header and menu
- [ ] Test footer links
- [ ] Test legal and privacy links
- [ ] Test consent recording
- [ ] Test all important routes after browser refresh
- [ ] Confirm unpublished businesses remain unavailable
- [ ] Confirm hidden contact values are not exposed
- [ ] Confirm translation copy accurately states current availability

## Post-Deployment Verification

- [ ] Run production read-only audit
- [ ] Confirm no new critical or privacy errors
- [ ] Confirm directory queries work
- [ ] Confirm Functions logs contain no unexpected errors
- [ ] Confirm website build/version is live
- [ ] Confirm Firestore and Storage rules are active
- [ ] Confirm backup and rollback information remains available
- [ ] Record deployment details in `RELEASE_LOG.md`

## Launch

- [ ] Approve Early Access launch
- [ ] Publish launch announcement
- [ ] Monitor registrations, business creation and messaging
- [ ] Record immediate follow-up issues
- [ ] Move deferred work into the post-launch backlog
