# Review hosting deep links

Focused follow-up to the disabled integration release. The React routes existed but Vercel did not rewrite direct requests to the SPA. Add explicit /my-reviews, /admin/customer-reviews and /admin/customer-review-reports rewrites to /index.html in the authoritative website vercel.json.

No catch-all rewrite, route-guard change, review activation, Firebase change or production data is included. Existing Services review display uses /services/:businessId, which already has a rewrite. There are no additional standalone review detail/edit routes.

Verification: tests/browser/reviewHosting.mjs builds the application in production mode with synthetic local configuration, serves the actual rewrite list through a test-only static adapter, and blocks all external browser requests. Direct navigation and reloading all three routes pass at390px and1440px. Disabled /my-reviews redirects to /services; anonymous admin routes redirect to /login; no review requests or review sections appear; unknown routes remain404. Website lint and fresh build pass.

This local adapter is not Vercel infrastructure. Check these same direct/reloaded paths on the PR preview before merge. Authenticated moderator behaviour and active reviews are not enabled by this configuration change; existing guards remain byte-for-byte unchanged.

Website-only deployment after separate approval, through the existing Vercel Git integration. No Firebase deployment needed. Original production rollout source/tree remains unchanged in its own isolated worktree.
