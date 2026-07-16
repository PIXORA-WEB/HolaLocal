# HolaLocal Release Log

This file records significant release, backup, repair and deployment events for HolaLocal.

Do not include passwords, tokens, private contact values, confidential audit JSON, service-account details or production exports in this file.

---

## 2026-07-16 – Early Access Release Candidate Preserved

### Release Candidate

- **Branch:** `feature/full-production-site`
- **Commit:** `cc7456e`
- **Commit subject:** `Prepare HolaLocal Early Access release candidate`
- **Status:** Local release candidate committed
- **Remote status at commit:** 6 commits ahead of `origin/main`
- **Worktree:** Clean
- **Pushed:** No
- **Deployed:** No

### Final Release-Readiness Audit

- **Verdict:** `CONDITIONALLY READY FOR EARLY ACCESS`
- **Release scope:** Website Early Access
- **Mobile parity required:** No
- **Translation activation required:** No
- **Remaining operational gates:**
  - verified backup/export;
  - one contact privacy repair;
  - deployment sequencing;
  - final browser and end-to-end QA.

### Production Read-Only Audit

- **Project:** `holalocal-491c9`
- **Audit status:** Complete
- **Users:** 2
- **Businesses:** 1
- **businessPrivate documents:** 1
- **Conversations:** 0
- **Reports:** 0
- **Duplicate groups:** 0
- **Privacy errors:** 1
- **Finding:** hidden public `contact.website`
- **Production modified:** No

### Firestore Backup Bucket

- **Bucket:** `gs://holalocal-491c9-firestore-backups`
- **Location:** `EUROPE-WEST1`
- **Storage class:** `STANDARD`
- **Uniform bucket-level access:** Enabled
- **Public access prevention:** Enforced
- **Soft delete:** Enabled
- **Soft-delete retention:** 7 days

### Firestore Export

- **Export prefix:** `contact-privacy-repair-20260716T173016Z`
- **Destination:** `gs://holalocal-491c9-firestore-backups/contact-privacy-repair-20260716T173016Z`
- **Collections:**
  - `businesses`
  - `businessPrivate`
- **Operation status:** `SUCCESSFUL`
- **Started:** `2026-07-16T17:30:18.662909Z`
- **Rollback point verified:** Yes
- **Production Firestore modified:** No

### Next Approved Stage

1. Revalidate the controlled privacy-repair dry-run.
2. Confirm target count remains `1`.
3. Confirm proposed mutation count remains `1`.
4. Confirm drift remains `0`.
5. Obtain separate explicit approval.
6. Execute the one-field privacy repair.
7. Immediately run a fresh read-only production audit.

---

## Release Entry Template

Copy this section for future releases.

### YYYY-MM-DD – Release Name

#### Release

- **Branch:**
- **Commit:**
- **Version/tag:**
- **Environment:**
- **Status:**

#### Changes

-

#### Production Data Work

- **Backup identifier:**
- **Repair or migration:**
- **Production audit result:**

#### Deployment

- **Indexes:**
- **Functions:**
- **Website:**
- **Firestore rules:**
- **Storage rules:**
- **Mobile:**

#### Verification

- **Browser smoke test:**
- **End-to-end test:**
- **Post-deployment audit:**
- **Known issues:**

#### Rollback

- **Rollback point:**
- **Rollback action required:** No / Yes
- **Notes:**
