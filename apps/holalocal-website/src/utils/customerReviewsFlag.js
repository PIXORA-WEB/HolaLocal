import { validateBrowserTestSafety } from '../firebase/browserTestSafety.js'
export function isCustomerReviewsEnabled(environment={}) {
  if(environment.VITE_CUSTOMER_REVIEWS_ENABLED!=='true'||environment.PROD===true)return false
  const configuration=validateBrowserTestSafety({mode:environment.MODE,production:environment.PROD,environment})
  return configuration?.projectId==='demo-holalocal-functions'
}
export const customerReviewsEnabled=isCustomerReviewsEnabled(import.meta.env??{})
