import { validateBrowserTestSafety } from '../firebase/browserTestSafety.js'
export function isCustomerReviewsEnabled(environment={}) {
  if(environment.VITE_CUSTOMER_REVIEWS_ENABLED!=='true')return false
  if(environment.PROD===true)return environment.MODE==='production'
    && environment.VITE_FIREBASE_PROJECT_ID==='holalocal-491c9'
    && ['VITE_USE_FIREBASE_EMULATORS','VITE_BROWSER_TEST_RUNNER','VITE_FIREBASE_AUTH_EMULATOR_URL','VITE_FIRESTORE_EMULATOR_URL','VITE_FUNCTIONS_EMULATOR_URL','VITE_STORAGE_EMULATOR_URL'].every(key=>!environment[key])
  const configuration=validateBrowserTestSafety({mode:environment.MODE,production:environment.PROD,environment})
  return configuration?.projectId==='demo-holalocal-functions'
}
export const customerReviewsEnabled=isCustomerReviewsEnabled(import.meta.env??{})
