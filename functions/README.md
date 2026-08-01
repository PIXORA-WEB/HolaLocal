# HolaLocal Functions

Local-only Firebase Functions scaffolding for backend-controlled message translation.

## Current status

Automatic translation is not deployed or live. The checked-in trigger uses a disabled provider by default, and tests inject a deterministic mock provider. A Google Cloud Translation v3 adapter exists for future production use, but it is not active unless a server-side Functions parameter explicitly selects it.

## Local emulator intent

The Firestore trigger listens for:

```text
conversations/{conversationId}/messages/{messageId}
```

It is explicitly pinned to region `europe-west1`, matching the Firestore database location. The trigger does not read a region from environment variables and does not rely on Firebase's default region.

When a valid text message is created, the processor:

1. Reads the parent conversation.
2. Confirms it is a customer-to-owner conversation.
3. Resolves the recipient.
4. Reads the recipient user language preference.
5. Claims translation work with an attempt ID and finite lease.
6. Calls the injected translator outside the claim transaction.
7. Writes backend-managed translation metadata only if the attempt is still current.

## Translation schema

The original `text` field remains unchanged. Backend code may add:

```js
translation: {
  status: 'processing' | 'completed' | 'not_required' | 'failed',
  sourceLanguage: string | null,
  targetLanguage: string | null,
  translatedText: string | null,
  reason: string | null,
  processingStartedAt: timestamp | null,
  processingLeaseUntil: timestamp | null,
  attemptId: string | null,
  updatedAt: timestamp
}
```

Clients may read this field when they can read the message, but Firestore rules do not allow browser clients to create or update it.

## Provider model

`src/providers/mockTranslator.js` is deterministic and used for tests. `src/providers/disabledTranslator.js` fails safely and remains the default.

`src/providers/googleCloudTranslator.js` implements the server-side Google Cloud Translation v3 request shape with `TranslationServiceClient`. It sends one plain-text message per request using:

```text
parent: projects/{projectId}/locations/global
mimeType: text/plain
```

The Cloud Function remains pinned to `europe-west1`; the Translation API parent uses `global`, which is the supported provider location for this adapter. The adapter relies on Application Default Credentials or the deployed Function service identity. No API key, service-account JSON, credential path, or website-provided credential is supported.

Provider selection is controlled only by the server-side `MESSAGE_TRANSLATION_PROVIDER` environment/config value:

- `disabled` is the default and fails safely.
- `mock` is allowed only under emulator/test runtime checks.
- `google_cloud` creates the real provider adapter, refuses demo project IDs, and requires a real runtime project ID.
- Unknown values fail closed to `disabled`.

Provider code must not log message text, expose credentials, store provider raw errors, or run from browser code. Raw provider responses are mapped to `{ translatedText, sourceLanguage, targetLanguage }` only; safe retryable or terminal categories are used for failures.

## Running local tests

From `functions/`:

```sh
npm test
npm run test:emulator
npm run check:syntax
npm run lint
```

The Functions emulator script uses demo project `demo-holalocal-functions`. Local tests use injected fake clients and the mock provider only; they must not contact Google Cloud Translation or use ADC for provider calls. The wider Firestore rules test remains under the website package and should run against a demo project through the Firebase emulator.

## Production prerequisites

Before any production use, Craig must separately approve Cloud Functions deployment, Translation API enablement, billing, runtime service-account IAM permissions, quotas and budget alerts, and setting `MESSAGE_TRANSLATION_PROVIDER=google_cloud`. Rollback is to set the provider back to `disabled` and redeploy the Function configuration after approval.
