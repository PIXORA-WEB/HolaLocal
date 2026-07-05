# Private report security

The website only creates reports and contains no report-listing UI. Firestore
rules must provide the actual privacy boundary: authenticated users may create a
strict initial report, while only trusted moderator/admin custom claims may read
or change moderation records.

No Firestore rules are versioned in this repository, so the following match must
be integrated into the project's deployed rules before enabling reports in
production (alongside the project's existing helper functions and rules):

```text
match /reports/{reportId} {
  allow create: if request.auth != null
    && request.resource.data.keys().hasOnly([
      'reporterId', 'targetType', 'targetId', 'parentId', 'reason', 'details',
      'evidence', 'status', 'priority', 'assignedTo', 'resolution',
      'createdAt', 'updatedAt'
    ])
    && request.resource.data.reporterId == request.auth.uid
    && request.resource.data.targetType == 'business'
    && request.resource.data.targetId is string
    && request.resource.data.targetId.size() > 0
    && request.resource.data.parentId == null
    && request.resource.data.reason in [
      'misleading_profile', 'unqualified_service', 'unsafe_behaviour',
      'poor_conduct', 'spam_or_fake_business', 'other'
    ]
    && request.resource.data.details is string
    && request.resource.data.details.size() <= 2000
    && request.resource.data.evidence is list
    && request.resource.data.evidence.size() == 0
    && request.resource.data.status == 'open'
    && request.resource.data.priority == 'normal'
    && request.resource.data.assignedTo == null
    && request.resource.data.resolution == null
    && request.resource.data.createdAt == request.time
    && request.resource.data.updatedAt == request.time;

  allow read, update, delete: if request.auth != null
    && (request.auth.token.moderator == true
      || request.auth.token.admin == true);
}
```

Do not allow reporters, business owners, or the public to query report
documents. Moderator claims are coarse platform authorization and must be issued
only from a trusted administration environment, consistent with
`DATABASE_SCHEMA.md`.

## Account roles and trusted authority

- `customer` is the ordinary account role created at registration.
- `business` is an ordinary, self-selected onboarding role. It grants access
  only to businesses the user owns or manages; it is not a staff role.
- Moderator and Admin authority comes only from trusted Firebase Authentication
  custom claims (`moderator` or `admin`). Profile fields and onboarding choices
  never grant moderation or administrative access.

Rules may allow users to choose customer/business modes, but must reject any
client attempt to add privileged roles or modify trusted claims.
