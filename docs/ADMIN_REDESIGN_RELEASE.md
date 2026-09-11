# Admin redesign — release preparation, not production deployed

Approved appearance: `b7856325e98fb69b6c21b9b6365e3b970ac1e395`.
Verified main baseline: `34afd18be7fcba89e66c7c1e8e44c653769ddbbe` (PR #41).
Release branch: `release/admin-redesign`, durable worktree `~/Projects/HolaLocal-worktrees/admin-redesign-release`.

The approved commit applied without conflicts. Runtime source matches the approved preview exactly except for main's already-released `base.css` tap-highlight rule. That rule is byte-for-byte unchanged from main. All prior production fixes remain ancestors of this branch. The original approved preview worktree and recovery backups are preserved.

## Focused scope

Original Admin shell/navigation, overview/list/detail styles, account-deletion page/dialog, customer-review/report pages and their shared styles. No replacement pages or appended override stylesheet. Removed duplicate review navigation, hidden decorative plan indicator, unused heading modifier, duplicate textarea declaration and second deletion-dialog lifecycle. Original handlers, ownership checks, moderation/subscription contracts and feature gates remain intact. The single deletion dialog retains explicit confirmation and fixes Cancel → Close focus return.

Additional integration changes are documentation and test-only output directory selection, so new test evidence does not overwrite the approved preview screenshots. No additional runtime redesign or behavior was introduced during integration.

## Verification

New evidence: `../review-evidence/admin-redesign-release/`.

- 33 affected unit/contract/source tests passed.
- Real isolated-emulator moderation browser journey passed (42.6 seconds): route claims, rejection, owner resubmission, approval, privacy and responsive UI.
- Real synthetic account-deletion request, populated queue, details/confirmation, Cancel, focus restoration, finalization and reload passed.
- Real Admin pages captured at 390 and 1440px: Overview, Businesses, business detail, deletions and closed-gate review route. No horizontal overflow; mobile menu Escape returns focus; touch styles inspected.
- Lint, 17-locale parity and fresh production build passed. Parity is not native-speaker editorial verification; existing general Admin fallback wording remains English.
- Existing bundle-budget failure remains visible: 205.61 kB gzip / unchanged 200 kB. Main is already over budget; no limit change or bypass.
- Production assets checked: new synthetic fixture/test markers absent, released transparent tap-highlight rule present.
- Previously passed approved-source review/report/customer browser journeys and subscription/permission tests remain applicable: their runtime code is unchanged. These results are reused, not described as newly rerun. See ADMIN_VISUAL_PREVIEW.md and original evidence.

## Preview and release boundaries

The Vercel PR preview uses the normal production build with existing route guards and closed review feature behavior. It contains no synthetic preview accounts, emulator configuration or demo pages. Authenticated interactions there may use the configured Firebase environment; moderation/deletion tests were performed only in local emulators, never against production records.

Automatic PR preview deployment is authorised. Merge and production deployment are not authorised for this batch. A future approved release is website-only through the existing Vercel workflow; no Firebase Functions, rules, indexes, Storage, IAM, provider or activation changes are needed or included.

## Tap-highlight acceptance

User explicitly confirmed the mobile blue highlight resolved on their phone after PR #41. Recorded in MOBILE_TAP_HIGHLIGHT.md and durable tap release evidence. The Admin release preserves that fix. Original upload/finalization investigation and reviews activation work remain separate.
