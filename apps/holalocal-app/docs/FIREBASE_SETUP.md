# Firebase setup

HolaLocal uses the Firebase v12 modular SDK. The foundation exposes shared
instances for Firebase Authentication, Cloud Firestore, Firebase Storage, and
Firebase Analytics. Firebase Cloud Messaging may be added later.

## Environment configuration

Vite exposes client configuration variables prefixed with `VITE_` through
`import.meta.env`. Copy `.env.example` to `.env`, then add the Firebase web app
values from the Firebase console.

The local `.env` file must never be committed. It is ignored by git, while
`.env.example` documents the required variable names without storing values.
Deployment environments must provide the same variables through their own
environment configuration.

## Planned services

- Firebase Authentication will initially use Email/Password authentication.
- Cloud Firestore will store `users`, `businesses`, `categories`,
  `conversations`, and `messages`.
- Firebase Storage will store business logos and photos later.
- Firebase Analytics is initialized only in supported browser environments.

The files in `src/firebase` currently provide configuration and extension
points only. Authentication flows, database operations, uploads, and other
business functionality will be implemented separately.
