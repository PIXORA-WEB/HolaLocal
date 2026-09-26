// Test-only resolution: exercise this checkout's shared source with borrowed dependencies.
export async function resolve(specifier, context, next) {
  if (specifier === '@holalocal/firebase-contract') {
    return { url: new URL('../../../../shared/firebase-contract/index.js', import.meta.url).href, shortCircuit: true }
  }
  if (context.parentURL?.endsWith('/src/services/userService.js')) {
    if (specifier === '../firebase/firestoreClient.js') {
      return { url: 'data:text/javascript,export const db = globalThis.__preferenceTestDatabase', shortCircuit: true }
    }
    if (specifier === '../firebase/functionsClient.js') {
      return { url: 'data:text/javascript,export const finalizeProfileMediaCallable = () => { throw new Error("Unexpected callable") }; export const prepareProfileMediaUploadCallable = finalizeProfileMediaCallable; export const updateAccountRoleCallable = finalizeProfileMediaCallable', shortCircuit: true }
    }
  }
  return next(specifier, context)
}
