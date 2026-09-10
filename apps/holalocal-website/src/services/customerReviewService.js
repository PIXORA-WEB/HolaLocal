import { customerReviewsEnabled } from '../utils/customerReviewsFlag.js'
export const customerReviewCallables = Object.freeze({translate:'translatePublishedCustomerReview',listPublic:'listPublishedCustomerReviews',getOwn:'getOwnCustomerReview',
  listOwn:'listOwnCustomerReviews',submit:'submitCustomerReview',edit:'editCustomerReview',withdraw:'withdrawCustomerReview',
  report:'submitCustomerReviewReport',summaries:'getCustomerReviewRatingSummaries'})
export function createCustomerReviewService({enabled,invoke}) {
  return Object.fromEntries(Object.entries(customerReviewCallables).map(([method,name])=>[method,async payload=>{
    if(!enabled)throw new Error('customer-reviews-disabled')
    return invoke(name,payload)
  }]))
}
export const customerReviewService=createCustomerReviewService({enabled:customerReviewsEnabled,
  invoke:async(name,payload)=>{
    const {callCustomerReview}=await import('../firebase/customerReviewClient.js')
    return callCustomerReview(name,payload)
  }})
