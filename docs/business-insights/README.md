# Business insights: contact availability and honest metrics

Website-only candidate from main 6ba0d27212319699197a18306b7bbf47b69f7681. No backend, permission, contact-setting, tracking, Analytics or activation changes.

## What the counters mean

- Profile views: recorded eligible public-profile view events, with the existing session token/deduplication and rate limits. Not a count of unique people.
- New conversations: `countCreatedConversation` in `functions/src/businessInsights.js`, invoked by the existing conversation-created trigger, counts a newly created business conversation once. It does not count sent messages or prove a genuine enquiry. Reopening a conversation is not a new conversation.
- Former “HolaLocal messages”: contact_action/holalocal increments when the Message business button is tapped. Now labelled “Message button clicks”. Phone/email/WhatsApp/website counts are likewise clicks, not confirmed contact or delivery.
- Callback availability has no corresponding collected metric; this change does not invent one.

## Authoritative implementation

`firebaseCompatibility.js` derives the owner's read-only `publicContact` projection from the raw business document using the existing shared `isPublicBusinessEligible` and existing public-contact projector. Private owner contact overrides cannot make a channel available in insights. Invalid, unpublished, suspended and deletion-pending public profiles have no available public contacts.

`BusinessInsightsPanel.jsx` receives that projection from the existing dashboard. It shows a channel if available now OR if its selected-period count is positive. Historical activity on unavailable channels is labelled. Unavailable zero-count channels and empty breakdown sections are absent. Selected-period contact-click totals and all-time totals remain supplied by the existing service, including historical counts, without recomputation/filtering.

Three compact summary cards show Profile views, New conversations and Contact clicks. They stack as compact rows on mobile. The heading and date selector share a responsive header; the selected-period box is removed and coverage is secondary text, with partial coverage explicit.

Daily activity now shows one selected metric using dependency-free SVG bars, zero heights for recorded zero counts, dates and a numerical scale. The chart observes the full available panel width, keeping axis text at a readable size. Dates before the known UTC collection-start day are hatched and labelled “Not recorded” in the exact-value table. The collection-start day retains actual recorded values (the existing partial-coverage notice accounts for a mid-day start). Unknown start metadata is not used to invent an unavailable interval. All totals remain unchanged. Native disclosures remain collapsed by default and keyboard accessible. The expanded table includes every returned date in a labelled, keyboard-scrollable region. Contact channels are compact icon/list rows with right-aligned counts. All-time totals are a quiet bottom section.

Removed obsolete summed-chart helpers, old bar-grid styles, per-day label helpers, selected-period box rules and contact/all-time tile rules. Original style rules are consolidated; no override layer or replacement component.

Affected metric wording is translated in all 17 original locale resources. Existing unrelated labels retain their current translations/fallback behaviour. Automated locale/layout verification is not native-speaker editorial review.

## Verification

- 45 insights/date-picker/locale-composition tests pass.
- The new actual managed/public projection regression passes, including private overrides, hidden values, lifecycle and deletion state.
- Full compatibility suite: 30 pass, 7 fail. Unchanged main-equivalent source with the same dependencies: 29 pass, the same 7 fail. These are existing broader locale manifest/composition/legal assertions; no coverage suppressed or changed to mask them.
- 50 local browser checks: 390/1440 widths, messaging-only, populated, sparse, historical channels, inactive business, empty/error, period changes/reload, all three metric selections, exact daily values, mixed/entirely unrecorded periods, preserved zero bar heights, full-width chart sizing, default-closed keyboard disclosures and table End-key scrolling, 17-language wrapping. Fixtures render the actual BusinessDashboardPage within SiteLayout and BusinessLayout. All external requests blocked; zero external requests occurred.
- Lint, locale parity (17), fresh production build and unchanged 200 kB budget pass. Local initial JS: 190.31 kB gzip; Vercel's configured preview build may differ.

Synthetic fixtures exist only in `tests/browser/businessInsights.mjs`, loaded by a programmatic test server. They are not imported into runtime pages or the production build. Run from apps/holalocal-website:

```
node tests/browser/businessInsights.mjs
node tests/browser/businessInsights.mjs --serve
```

Interactive local preview: http://127.0.0.1:4198/insights-preview?scenario=historical
Other scenarios: messaging, populated, sparse, inactive, empty, error. Locale uses the existing local UI-language preference.

[Full actual dashboard — desktop](dashboard-desktop.png) · [mobile](dashboard-mobile.png)

![Mobile insights detail](mobile.png)
![Desktop insights detail](desktop.png)

[Historical channel](historical-mobile.png) · [Empty selected period](empty-mobile.png) · [Entirely unrecorded period](unrecorded-mobile.png)

## Release boundary

Appearance approval and production merge remain pending. The PR's automatic Vercel preview uses actual guarded application routes, without synthetic fixtures. No production tracking traffic was generated. No Firebase deployment is required. Preserve current production environment and review/translation/retention/Analytics settings. Original mixed workspace, older insights branch and backups remain untouched.

## Shared Metric dropdown

The original panel uses SelectField with the existing select-field--form class, as the date-range selector does. Removed the native select styling; only the surrounding layout specifies a responsive 18rem maximum-width container. Existing labels in all 17 languages are reused unchanged. No new component or design variant.

Browser checks exercise all three choices by keyboard in all 17 languages at both widths, menu overflow, Escape/focus return, and matching computed font family/size/weight, minimum height, padding and radius against the date-range control. Existing metric/table/coverage checks continue to pass.

[Open Metric menu — mobile](metric-mobile.png) · [desktop](metric-desktop.png)

## Shared custom-date calendar

The original From/To controls now use one reusable `DatePicker`, with UTC civil-date helpers and the existing `SelectField` month control and standard buttons. The previous native-date input rules and markup were replaced directly; there is no alternate insights page or override layer. No dependency was added.

Manual entry accepts the locale's displayed format or ISO YYYY-MM-DD. Invalid dates have a labelled error; the existing range validator still controls Apply, ordering, future dates and the 366-day limit. Selection changes only the draft range until Apply. Selected dates, today and unavailable future dates have separate styles and accessible state. Arrow keys, Home/End, Page Up/Down (Shift for years), month selection, editable year, Escape and focus return are supported. The nonmodal popup stays inside the viewport and dismisses when focus leaves it.

Calendar names/format/week starts use Intl in all 17 supported languages. Original locale resources contain the eight shared labels, with no parallel translations. Local synthetic browser checks cover desktop/mobile, all 17 calendars and month menus, manual invalid dates, reversed ranges, future rejection, actual selection/Apply, month/year keyboard navigation, and focus return. Translation parity is automated verification, not native-speaker certification. Device-specific virtual-keyboard and assistive-technology checks remain a useful follow-up.

[Calendar open — mobile](calendar-mobile.png) · [desktop](calendar-desktop.png)

Final calendar verification: 50 full browser scenarios plus 36 focused calendar/locale scenarios passed, with zero external requests. Initial JavaScript changed from 190.24 to 190.31 kB gzip, below the unchanged 200 kB limit. No production fixtures are imported by the application build.

## Custom-date alignment

The original desktop range grid now shares four rows with both date pickers through CSS subgrid: labels, input/calendar controls, format hints, and validation errors. Apply explicitly occupies the controls row. Removed the old bottom alignment; no positional offsets or override layer. The original mobile stack is unchanged. No date, label, validation or submission logic changed.

Verification: 34 local browser cases across desktop/mobile and all 17 locales, with visible invalid-date/range messages and deliberately long wrapping labels; exact top/bottom control alignment; labels/hints remain above/below their controls; no horizontal overflow or external requests. 37 affected unit tests, lint and fresh build/budget pass (190.31 kB / 200 kB).

[Aligned desktop](dates-aligned-desktop.png) · [Stacked mobile](dates-aligned-mobile.png) · [Desktop errors](dates-errors-desktop.png) · [Mobile errors](dates-errors-mobile.png)
