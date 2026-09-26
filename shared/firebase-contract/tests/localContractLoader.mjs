// Test-only: resolve this checkout's contract even when dependencies are borrowed.
export async function resolve(specifier, context, next) {
  if (specifier === '@holalocal/firebase-contract') {
    return { url: new URL('../index.js', import.meta.url).href, shortCircuit: true }
  }
  const subpath = specifier.replace('@holalocal/firebase-contract/', '')
  if (['customerReviewContracts', 'customerReviewLifecycle', 'customerReviewTranslation'].includes(subpath)) {
    return { url: new URL('../' + subpath + '.js', import.meta.url).href, shortCircuit: true }
  }
  if (context.parentURL?.endsWith('/holalocal-website/src/services/userService.js')) {
    if (specifier === '../firebase/firestoreClient.js') {
      return { url: 'data:text/javascript,export const db = globalThis.__legalTestDatabase', shortCircuit: true }
    }
    if (specifier === '../firebase/functionsClient.js') {
      return { url: 'data:text/javascript,export const finalizeProfileMediaCallable = () => { throw new Error("Unexpected callable") }; export const prepareProfileMediaUploadCallable = finalizeProfileMediaCallable; export const updateAccountRoleCallable = finalizeProfileMediaCallable', shortCircuit: true }
    }
  }
  return next(specifier, context)
}
