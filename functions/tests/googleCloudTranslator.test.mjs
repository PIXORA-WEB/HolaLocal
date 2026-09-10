import test from 'node:test'
import assert from 'node:assert/strict'
import {
  GOOGLE_TRANSLATION_MIME_TYPE,
  createGoogleCloudTranslator,
  mapGoogleCloudTranslationError,
} from '../src/providers/googleCloudTranslator.js'
import {
  TRANSLATION_PROVIDER_CONFIG,
  createTranslationProvider,
  normalizeProviderName,
} from '../src/providers/providerFactory.js'

function createFakeClient(responseOrError, calls = []) {
  return {
    async translateText(request) {
      calls.push(request)
      if (responseOrError instanceof Error) throw responseOrError
      return [responseOrError]
    },
  }
}

test('google provider builds the Cloud Translation v3 request without an API key', async () => {
  const calls = []
  const translator = createGoogleCloudTranslator({
    projectId: 'holalocal-491c9',
    client: createFakeClient({
      translations: [{
        translatedText: 'Hola',
        detectedLanguageCode: 'en-US',
      }],
    }, calls),
  })

  const result = await translator.translateText({
    text: 'Hello',
    targetLanguage: 'es',
    sourceLanguageHint: 'en',
    requestId: 'safe-request-id',
  })

  assert.deepEqual(calls, [{
    parent: 'projects/holalocal-491c9/locations/global',
    contents: ['Hello'],
    mimeType: GOOGLE_TRANSLATION_MIME_TYPE,
    targetLanguageCode: 'es',
    sourceLanguageCode: 'en',
  }])
  assert.deepEqual(result, {
    translatedText: 'Hola',
    sourceLanguage: 'en',
    targetLanguage: 'es',
  })
  assert.equal(JSON.stringify(calls).includes('key'), false)
  assert.equal(JSON.stringify(calls).includes('credential'), false)
})

test('missing source hint allows provider language detection', async () => {
  const calls = []
  const translator = createGoogleCloudTranslator({
    projectId: 'holalocal-491c9',
    client: createFakeClient({
      translations: [{
        translatedText: 'Bonjour',
        detectedLanguageCode: 'EN',
      }],
    }, calls),
  })

  const result = await translator.translateText({
    text: 'Hello',
    targetLanguage: 'fr',
    sourceLanguageHint: null,
  })

  assert.equal(calls[0].sourceLanguageCode, undefined)
  assert.equal(result.sourceLanguage, 'en')
  assert.equal(result.targetLanguage, 'fr')
})

test('unsupported source hint is omitted safely', async () => {
  const calls = []
  const translator = createGoogleCloudTranslator({
    projectId: 'holalocal-491c9',
    client: createFakeClient({
      translations: [{ translatedText: 'Hallo' }],
    }, calls),
  })

  await translator.translateText({
    text: 'Hello',
    targetLanguage: 'de',
    sourceLanguageHint: 'xx-unknown',
  })

  assert.equal(calls[0].sourceLanguageCode, undefined)
})

test('malformed provider responses fail safely without returning raw response', async () => {
  const missing = createGoogleCloudTranslator({
    projectId: 'holalocal-491c9',
    client: createFakeClient({ translations: [] }),
  })

  await assert.rejects(
    () => missing.translateText({ text: 'Hello', targetLanguage: 'es' }),
    (error) => error.safeReason === 'provider_rejected'
      && error.safeCategory === 'terminal_invalid_request'
      && error.retryable === false,
  )

  const empty = createGoogleCloudTranslator({
    projectId: 'holalocal-491c9',
    client: createFakeClient({ translations: [{ translatedText: '   ' }] }),
  })

  await assert.rejects(
    () => empty.translateText({ text: 'Hello', targetLanguage: 'es' }),
    (error) => error.safeReason === 'provider_rejected',
  )
})

test('provider errors are classified without raw provider details', () => {
  const unavailable = mapGoogleCloudTranslationError(Object.assign(new Error('private text: Hola'), { code: 14 }))
  assert.equal(unavailable.safeCategory, 'retryable_service_unavailable')
  assert.equal(unavailable.safeReason, 'provider_unavailable')
  assert.equal(unavailable.retryable, true)
  assert.equal(unavailable.message.includes('Hola'), false)

  const quota = mapGoogleCloudTranslationError({ code: 8, message: 'quota detail' })
  assert.equal(quota.safeCategory, 'retryable_quota')
  assert.equal(quota.retryable, true)

  const invalid = mapGoogleCloudTranslationError({ code: 3, message: 'bad request with source text' })
  assert.equal(invalid.safeCategory, 'terminal_invalid_request')
  assert.equal(invalid.safeReason, 'provider_rejected')
  assert.equal(invalid.retryable, false)

  const config = mapGoogleCloudTranslationError({ code: 7, message: 'service account detail' })
  assert.equal(config.safeCategory, 'terminal_provider_configuration')
  assert.equal(config.safeReason, 'provider_unavailable')
  assert.equal(config.retryable, false)
})

test('provider selection fails closed unless explicitly configured server-side', async () => {
  assert.equal(TRANSLATION_PROVIDER_CONFIG, 'MESSAGE_TRANSLATION_PROVIDER')
  assert.equal(normalizeProviderName(undefined), 'disabled')
  assert.equal(normalizeProviderName('unexpected'), 'disabled')

  const unknown = createTranslationProvider({
    providerName: 'unexpected',
    projectId: 'holalocal-491c9',
    env: { NODE_ENV: 'production' },
  })
  await assert.rejects(
    () => unknown.translateText({ text: 'Hello', targetLanguage: 'es' }),
    (error) => error.safeReason === 'provider_unavailable',
  )
})

test('mock provider is allowed only in emulator or test runtime', async () => {
  const productionMock = createTranslationProvider({
    providerName: 'mock',
    projectId: 'holalocal-491c9',
    env: { NODE_ENV: 'production' },
  })
  await assert.rejects(
    () => productionMock.translateText({ text: 'Hello', targetLanguage: 'es' }),
    (error) => error.safeReason === 'provider_unavailable',
  )

  const emulatorMock = createTranslationProvider({
    providerName: 'mock',
    projectId: 'demo-holalocal-functions',
    env: { FUNCTIONS_EMULATOR: 'true' },
  })
  const result = await emulatorMock.translateText({ text: 'Hello', targetLanguage: 'es' })
  assert.equal(result.translatedText, '[es] Hello')
})

test('demo projects cannot activate the Google provider', async () => {
  const calls = []
  const provider = createTranslationProvider({
    providerName: 'google_cloud',
    projectId: 'demo-holalocal-functions',
    env: { NODE_ENV: 'production' },
    googleClient: createFakeClient({ translations: [{ translatedText: 'Hola' }] }, calls),
  })

  await assert.rejects(
    () => provider.translateText({ text: 'Hello', targetLanguage: 'es' }),
    (error) => error.safeReason === 'provider_unavailable',
  )
  assert.equal(calls.length, 0)
})


test('EU probe pins endpoint region and NMT model with bounded RPC and no retries', async () => {
  const calls = []
  const translator = createGoogleCloudTranslator({
    projectId: 'holalocal-491c9', location: 'europe-west1', apiEndpoint: 'translate-eu.googleapis.com', requestTimeoutMs: 10000,
    client: { async translateText(request, options) { calls.push({request, options}); return [{translations:[{translatedText:'Hola'}]}] } },
  })
  await translator.translateText({text:'Hello', targetLanguage:'es', sourceLanguageHint:'en'})
  assert.equal(calls[0].request.parent, 'projects/holalocal-491c9/locations/europe-west1')
  assert.equal(calls[0].request.model, 'projects/holalocal-491c9/locations/europe-west1/models/general/base')
  assert.deepEqual(calls[0].options, {timeout:10000, retry:null})
})

test('EU configuration fails closed for global or unsupported regions and arbitrary hosts', () => {
  for (const options of [
    {apiEndpoint:'translate-eu.googleapis.com'},
    {apiEndpoint:'translate-eu.googleapis.com', location:'us-central1'},
    {apiEndpoint:'untrusted.example', location:'europe-west1'},
  ]) assert.throws(() => createGoogleCloudTranslator({projectId:'holalocal-491c9', ...options}), error => error.safeCategory === 'terminal_provider_configuration')
})

test('EU provider failure does not retry or fall back to global', async () => {
  let calls = 0
  const translator = createGoogleCloudTranslator({projectId:'holalocal-491c9', location:'europe-west1', apiEndpoint:'translate-eu.googleapis.com', requestTimeoutMs:10000,
    client:{async translateText(){calls++; throw Object.assign(new Error('private detail'), {code:14})}}})
  await assert.rejects(()=>translator.translateText({text:'Hello', targetLanguage:'es'}), error => error.safeCategory === 'retryable_service_unavailable')
  assert.equal(calls, 1)
})


test('same-language normalization returns exact original without SDK call', async () => {
 const provider=createGoogleCloudTranslator({projectId:'holalocal-491c9',client:{translateText:()=>assert.fail('must not call Google')}})
 for(const sourceLanguageHint of ['en','en-US']) assert.deepEqual(await provider.translateText({text:'  Original text.  ',sourceLanguageHint,targetLanguage:'en'}),{translatedText:'  Original text.  ',sourceLanguage:'en',targetLanguage:'en'})
})

test('internal diagnostics distinguish RPC rejection from response validation without sensitive strings', async () => {
 for(const [client,phase] of [
  [{translateText:async()=>{throw Object.assign(new Error('SECRET review text'),{code:3,details:'SECRET',metadata:{authorization:'SECRET'}})}},'provider_rpc'],
  [{translateText:async()=>[{translations:[]}]},'response_validation'],
 ]) {
  const provider=createGoogleCloudTranslator({projectId:'holalocal-491c9',client})
  await assert.rejects(()=>provider.translateText({text:'SECRET',targetLanguage:'es',sourceLanguageHint:'en'}),error=>{
   assert.equal(error.providerDiagnostics.phase,phase)
   if(phase==='provider_rpc'){assert.equal(error.providerDiagnostics.code,3);assert.equal(error.providerDiagnostics.status,'INVALID_ARGUMENT')}
   assert.ok(!JSON.stringify(error.providerDiagnostics).includes('SECRET'))
   assert.ok(!JSON.stringify(error).includes('providerDiagnostics'))
   assert.equal(error.message,'Translation provider failed safely.');return true
  })
 }
})
