# Website performance guide

HolaLocal uses route-level code splitting, on-demand locale resources and feature-scoped Firebase clients.

## Validation

Run the production build before checking its initial JavaScript budget:

```bash
npm run build
npm run check:bundle
```

The initial static JavaScript budget is 200 kB gzip. The checker follows static imports from the HTML entry, confirms that an Early Access route chunk exists, and rejects eager non-English locale imports.

## Adding routes and locales

- Add full pages with `lazy(() => import(...))` in `src/routes/AppRoutes.jsx`. Keep route guards and layouts eager because they coordinate authentication and navigation.
- Add locale modules to the loader map in `src/i18n/index.js`. English is the only eagerly loaded locale; `changeAppLanguage` must load a locale before switching.
- Keep Firestore and Storage imports behind `firestoreClient.js` and `storageClient.js`. Storage operations should remain dynamic so profile and dashboard reads do not download upload code.
- Run `npm run check:locales`, `npm run lint`, `npm run build`, and `npm run check:bundle` before release.
