# Remove the automatic policy-update banner

Website-only branch based on main fff2d32ecac597fad4ff065f73e276b41af4845b. No production changes performed.

Removed the automatic notice from the original SiteLayout, its authentication/policy imports, local dismissal state and notice-only links/button. Removed the exclusive notice translations in all 17 languages, the policyUpdateNotice module, unused locale-factory code argument and unused website hasCurrentLegalConsent re-export. The authoritative shared contract helper remains intact. No CSS changes: the banner used shared form-message and button styles required elsewhere. No substitute popup, dismissal storage or acceptance write.

Unchanged: historical acknowledgments/access, new-registration Terms acceptance and Privacy acknowledgment, published policy versions/dates/content, footer policy links, Analytics consent/controls, backend and all feature settings. This supersedes the earlier informational-banner presentation without changing the nonblocking policy-version transition.

## Verification

- 29 legal/access/Analytics unit tests pass (Analytics VM tests use --experimental-vm-modules).
- 34 registration locale/viewport checks at 390/1440, 14 pre-signup service guard rejections and two real Auth/Firestore emulator registrations/reloads pass. Missing either acknowledgment keeps submission blocked; created profiles record published versions 1.1 without fabricated historical records.
- Existing synthetic account with versions 1.0 logs in/reloads; banner remains absent, historical versions/timestamps preserved. Existing account-deletion eligibility assertion remains intact and passes on isolated synthetic records.
- Both signed-in header widths checked, footer Terms/Privacy links retained; no overflow. Independent Analytics bar remains present. All browser external requests blocked; no production or measurement traffic.
- Lint, parity for all 17 languages, fresh build and unchanged budget pass: 190.13 kB initial gzip (main 190.31), limit 200 kB.
- Existing seven broad compatibility failures remain separate baseline work; this change does not edit their assertions or affected translations/legal content.

Browser harness: tests/browser/registrationAge.mjs. Removed its obsolete synthetic publication-date transform and old notice-dismissal expectations, replacing them with absence/reload/record-preservation checks and stronger individual registration-acknowledgment checks. Fixtures and screenshots are not production assets.

[Desktop](desktop.png) · [Mobile](mobile.png)

Automatic Vercel preview is permitted. Production merge is not approved. Deployment scope is website only; no Firebase, settings or data changes required. Production authenticated flows have not been exercised for this candidate.
