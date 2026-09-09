# One sanitized deletion capture, only if needed

The existing logs do not identify a failed deletion request. Before clicking Delete again:

1. Open your business editor on a desktop browser, signed into your own account. Open Developer Tools > Network, enable Preserve log, clear the list. Do not export HAR or copy a request as cURL.
2. Note whether the selected image is one of the three newly uploaded images or an older image. Click Delete only once on an image you already intend to remove. Do not retry or change status.
3. Inspect the request to `manageBusinessMedia`, if present. Report ONLY request action (expected `remove-gallery`), HTTP status, and response `error.status`, `error.message`, `error.details.reason` when present. Do not copy the whole request, business ID, image URL, request ID, headers, cookies or tokens.
4. If there is no media callable, filter for `firestore.googleapis.com`; inspect a `Commit` request or WebChannel `Write/channel` response. HTTP 200 can contain a Firestore error. Report ONLY the embedded error code/status and generic message, such as `PERMISSION_DENIED` / `Missing or insufficient permissions`. Do not copy document contents or raw channel responses.
5. Also note whether any Storage DELETE request occurred; report only HTTP status and error code (not URL/object name). Report the time with timezone and whether refreshing changed the image list. Do not perform a second attempt.

Never share Authorization, Cookie, X-Firebase-AppCheck, ID/refresh tokens, session markers, signed download URLs, contact fields or raw console/network dumps. Existing server snapshots are retained separately. No production instrumentation or status changes are required for this capture.
