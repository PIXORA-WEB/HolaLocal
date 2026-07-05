# HolaLocal

HolaLocal is a multilingual Early Access marketplace for customers and local
businesses in Spain. The website and mobile application are separate projects.

## Structure

- `apps/holalocal-website` — React/Vite website deployed independently to Vercel.
- `apps/holalocal-app` — separate mobile application; never include it in the website Vercel project.
- `docs` — shared schema, language, security, and parity plans.
- `firestore.rules`, `storage.rules`, `firebase.json` — shared Firebase configuration; deployment is always manual.

## Website setup

```sh
cd apps/holalocal-website
npm ci
cp .env.example .env
npm run dev
```

Populate the local `.env` from the Firebase web-app configuration. Never commit
real environment files, service-account credentials, or private keys.

## Validation and production preview

```sh
npm run check:locales
npm run lint
npm run build
npm run check:bundle
npm run preview
```

Rules tests run entirely against Firebase emulators:

```sh
npm run test:rules
```

## Data safety scripts

Both administrative scripts default to a non-writing audit. Never add `--apply`
until the project and output have been independently reviewed:

```sh
npm run migrate:business-private -- --project=your-project-id
npm run audit:public-contacts -- --project=your-project-id
```

## Vercel

- Root Directory: `apps/holalocal-website`
- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm ci`

Add every variable from `.env.example` to Vercel. `vercel.json` provides the SPA
fallback needed for direct React Router URLs. The mobile app is outside the Vercel
root and is not built or deployed with the website.
