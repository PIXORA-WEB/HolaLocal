# HolaLocal language and translation plan

## Scope

This document records the multilingual direction for HolaLocal. The mobile app
uses `i18next` and `react-i18next` for UI translation. It does not yet introduce
machine-translation services or translated messaging.

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

The app stores the selected UI language code locally for signed-out sessions.
For authenticated users, changing the UI language also updates
`users/{uid}.preferredLocale`, which is the user's preferred interface and
future message language.

## Business communication language

Business spoken languages are separate from the website UI language. Each
business profile stores stable language codes in a `languages` array and a code
in `primaryLanguage`. `primaryLanguage` represents the default language the
business uses for communication and must be one of the values in `languages`.
Selecting a UI language does not claim that a business speaks it.

The standard business-language list currently matches the website UI list and
also permits an explicit custom “Other” entry. Matching lists are a current
product choice, not a requirement that they remain identical.

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
