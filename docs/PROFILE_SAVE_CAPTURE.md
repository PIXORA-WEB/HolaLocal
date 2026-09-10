# Sanitized business Save capture — one intended attempt only

Production investigation is read-only. Do not change business status or invent edits. Use your own account and only changes you intend to save. If you do not want to attempt Save, report that and we will continue isolated reproduction.

1. Open browser Developer Tools → Network. Turn on Preserve log, clear the list, and filter for `firestore`, `commit`, or `cloudfunctions`. Do not export HAR or copy as cURL.
2. Record the current time/timezone and the status label shown for your business. Note only which fields you intended to change and whether you changed service selections. Do not share field values containing personal data.
3. Press Save once. Locate the failed request from that action. A Firestore transaction may show `batchGet`, `commit`, or `channel`; a callable uses its function name. Record only the service/method (for example POST Firestore documents:commit), HTTP status, and response error code/status/message. For streamed requests, a HTTP200 can contain an embedded permission error; report that error if present.
4. If you can view the commit payload safely, report only the `updateMask.fieldPaths` names, grouped by collection (`businesses` / `businessPrivate`). Do not send the request body or document IDs. If no update mask is present, report only top-level field names—no values. This step is optional.
5. Report whether the screen still shows unsaved changes. Do not reload if that would lose wanted edits. Do not repeat Save to collect more examples.

Never send Authorization headers, bearer/ID/refresh tokens, cookies, API keys, local storage, email/phone values, full image URLs, document/user IDs, raw JSON requests, HAR files or unredacted screenshots. Do not decode or share JWTs. A sign-in refresh/token timestamp can be inspected server-side, but cannot prove which token the failed browser request used.

Reply with: time/timezone; displayed business status; changed field names; service selections changed yes/no; request service/method; HTTP status; safe backend error code/message; optional update-mask field names. This capture distinguishes account/token, transaction-read and write-validation failures without weakening permissions.
