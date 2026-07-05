# HolaLocal website and app parity

## Shared backend

`holalocal-app` and `holalocal-website` use the same Firebase project and the
same environment-variable contract. They share:

- Firebase Authentication accounts
- Firestore user profiles in `users/{uid}`
- Firestore business profiles in `businesses/{businessId}`
- Firebase Storage configuration for future shared media

Users can register or log in on either platform with the same email/password
account. Firebase maintains sessions independently on each device or browser.

## Shared profile flows

Both clients use compatible user and business document structures. Profile,
onboarding, language-preference, and business-profile changes written on one
platform are available to the other platform after its profile data refreshes.

The shared flows include:

- Authentication and password reset
- User profile completion
- Customer, business, or combined account onboarding
- Business profile creation and editing
- Preferred UI locale (`preferredLocale`) and business primary language
- Custom subcategories, service areas, and spoken languages

## Current boundaries

The website retains its own responsive marketing and account UI; it does not
reuse the mobile navigation presentation. Marketplace search, messaging,
reviews, paid subscriptions, media uploads, and automatic translation remain
outside the current parity scope.

Future schema changes must be implemented compatibly in both clients before
deployment so either platform can safely read documents written by the other.

Stage 1 makes `DATABASE_SCHEMA.md` canonical for new website writes. Existing
documents using legacy website fields require an explicit migration before the
new rules are deployed. The mobile app has not been changed in this stage.
