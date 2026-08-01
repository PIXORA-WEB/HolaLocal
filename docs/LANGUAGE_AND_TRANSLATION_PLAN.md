# HolaLocal language and translation plan

## Scope

This document records the multilingual direction for HolaLocal. The mobile app
uses `i18next` and `react-i18next` for UI translation. It does not yet introduce
machine-translation services or translated messaging.

Phase 1A Batch 1 defines pure shared normalization for the approved target.
Batch 2B1 uses it for mobile account reads and persists authenticated mobile
preferences as canonical `preferredLocale` codes. It does not change
production data, and automatic translation is not implemented.

## Interface languages

The website supports the following selectable UI language codes:

- English
- Spanish
- French
- German
- Dutch
- Portuguese
- Polish
- Romanian
- Czech
- Slovak
- Hungarian
- Ukrainian
- Italian
- Swedish
- Danish
- Finnish
- Norwegian

A user's `preferredLocale` stores a stable language/locale code such as `en`,
`es`, `pl`, or `uk`; translated display names are never stored as preference
values. The website uses this preference for authenticated users and a local
selection fallback for visitors.

The approved codes are `en`, `es`, `fr`, `de`, `nl`, `pt`, `pl`, `ro`, `cs`,
`sk`, `hu`, `uk`, `it`, `sv`, `da`, `fi`, and `no`. Locale variants and known
translated labels normalize to these codes. Unknown values are preserved with
a deterministic custom identifier and their original trimmed label; they are
never silently replaced with English or “other”.

Both website and mobile account writes now store codes in `preferredLocale`.
Mobile reads still interpret legacy `preferredLanguage` labels without writing
them back. Signed-out mobile UI language remains local device/browser state.
Batch 2B2 canonical mobile edits write standard business languages as stable
codes. Already-canonical custom identifiers and existing label maps are
preserved without rewriting those maps. A legacy free-text custom language
must be replaced with a supported code before mobile Save can proceed; it is
never silently converted to English.

Batch 3 read-only audit tooling can report legacy labels, locale variants,
unknown custom values, missing custom labels, duplicate values, and invalid
primary-language state for future operator review. It has not been run against
production and does not migrate or rewrite language data.

The mobile interface currently bundles six translated UI resources: English,
Spanish, French, German, Dutch, and Portuguese. This is separate from the 17
canonical codes that account preference controls can store. For those controls,
`Intl.DisplayNames` supplies localized labels where the WebView supports it;
deterministic English labels are the fallback. The presence of a selectable
preference code does not mean the complete mobile interface is translated into
that language.

## Business communication language

Business spoken languages are separate from the website UI language. The
website and supported Batch 2B2 mobile edits write stable identifiers, while
mobile compatibility reads still understand legacy display labels. In the
approved target, each business profile stores stable
identifiers in `languages`, with standard languages represented by codes, and
stores a member of that array in `primaryLanguage`. Selecting a UI language
does not claim that a business speaks it.

The standard business-language list currently matches the website UI list and
also permits an explicit custom “Other” entry. Matching lists are a current
product choice, not a requirement that they remain identical.

`primaryLanguage` must be a member of `languages`. Compatibility normalization
may repair it to the first preserved language only while returning the stable
`LANGUAGE_PRIMARY_REPAIRED` issue code. Production migration has not happened.

## Future message translation

Messaging translation should compare the sender's preferred or primary
language with the recipient's preferred or primary language. Translation may
be offered when those languages differ, while preserving the original message
and clearly indicating translated content.

Automatic message translation may eventually support more source and target
languages than the website UI. Translation-provider capabilities must not be
used to determine which interface translations are offered.

Future provider options include Google Cloud Translation and DeepL. Provider
selection, consent behavior, privacy review, caching, language detection,
failure handling, and costs must be designed before implementation.

No automatic message translation or paid translation API is integrated at this
stage.

## Translation review status

English fallback resources currently back Polish, Romanian, Czech, Slovak,
Hungarian, Ukrainian, Italian, Swedish, Danish, Finnish, and Norwegian. This
prevents missing keys while the interface is developed, but it does not count
as a completed translation. Every newly added locale requires native-speaker
review, terminology review, layout testing, and approval before public launch.
