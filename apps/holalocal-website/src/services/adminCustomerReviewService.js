import {createAdminReviewService} from '../utils/adminCustomerReviewModel.js'
import {customerReviewsEnabled} from '../utils/customerReviewsFlag.js'
export function adminCustomerReviewService(authorize){
  return createAdminReviewService({enabled:customerReviewsEnabled,authorize,invoke:async(name,payload)=>{
    const {callCustomerReview}=await import('../firebase/customerReviewClient.js')
    return callCustomerReview(name,payload)
  }})
}
