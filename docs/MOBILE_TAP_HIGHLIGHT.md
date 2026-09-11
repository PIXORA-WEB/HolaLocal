# Mobile tap highlight — focused website fix, not deployed

Branch `fix/mobile-tap-highlight` is based on verified current main `e3e2b606e84ab54df7128950640930e875131aed`. It does not include the Admin redesign. The Admin preview remains clean at `b7856325e98fb69b6c21b9b6365e3b970ac1e395`. Original mixed work, paused work and backups are untouched.

## Diagnosis

Inspected the supplied local recording `1000021146.mp4` (6.675 seconds), extracting frames at 1.9/2.0/2.1 and 3.4/3.5/3.6 seconds. At 2 seconds the filled cyan rectangle extends outside the round hamburger. At 3.5 seconds a filled rectangle persists at the old menu-link position after the menu disappears. This is the native browser tap overlay, rather than the application's active-page background or keyboard focus outline.

The authoritative `SiteHeader.jsx` uses a native details/summary hamburger and NavLink links. A link click removes the details `open` attribute; route changes also close the menu. Only Escape explicitly restores focus. No handler paints an overlay, creates a blue element or moves focus on a link tap. Original CSS has rounded hover/active link backgrounds, a summary focus-visible outline, and no explicit `:active` or `-webkit-tap-highlight-color` declaration. The rectangular filled paint remaining after the menu closes is consistent with the browser overlay's lifetime.

The prior Chromium touch emulation did not reproduce the phone's cyan color: Chromium reports its default as rgba(0,0,0,0.18). The supplied recording closes that visual evidence gap. Actual suppression on the recording device still needs a phone check after an approved preview/release; local browser tests do not establish device-specific compositor behavior.

## Change

One new shared declaration in the original `src/styles/base.css`, alongside the base control styles:

- `@media (any-pointer: coarse)` includes touch-capable hybrid devices without changing fine-pointer-only rendering.
- A low-specificity semantic selector covers links, buttons, native summary menus, form controls/labels, custom buttons and listbox options.
- Only `-webkit-tap-highlight-color: transparent` changes. No outline, background, selection, active state, pointer events, touch-action or JavaScript event handling changes.

There was no existing tap-highlight rule to consolidate. No duplicate selector, appended override stylesheet, replacement control or Admin-specific patch was introduced. Application hover/active-page/pressed/selected feedback and focus-visible indicators remain authoritative.

## Verification

`node tests/browser/tapHighlight.mjs`: passed against real main-source pages served by isolated Vite, with all browser network requests restricted to loopback. No production writes or authenticated actions.

- Native hamburger open/close and menu-link navigation through Events → Services; menu closes after navigation.
- Touch context computes transparent tap highlight; fine-pointer context retains its previous translucent-black value.
- Active Events link retains its styled background and aria-current state.
- Keyboard Tab/Shift+Tab, Enter and Escape preserve visible focus and expected menu behavior, including in a touch-capable context.
- Shared semantic control fixture checks buttons, labels, checkbox, text field, select, textarea, role button and role option; selected/checked/pressed states and text selection remain intact.
- Real login form remains editable and its button receives the same shared touch rule. No form submission.
- Lint, fresh production build and git diff whitespace checks passed.
- Existing 200 kB bundle budget still fails at 205.42 kB gzip, unchanged from the released main baseline. No limit increase or bypass.

Evidence: `../review-evidence/tap-highlight/` contains recording frames, computed-style results, keyboard screenshots and build/budget logs. The supplied recording and extracted frames are not committed or bundled. Browser test code is outside the production import graph.

## Phone acceptance (not yet verified)

Once approved code is available on the phone: open Events, tap the hamburger, then tap Services; repeat after a hard refresh. Confirm neither rectangular flash appears, the menu still opens/closes and navigates, the active-page style remains, language/form buttons work, and text can still be selected. If a keyboard is connected, confirm visible Tab focus. No production data changes are needed for these checks.

Website-only release. No Firebase, IAM, review activation or retention changes. No merge or deployment performed. This fix can be reviewed/released independently of the Admin appearance work.
