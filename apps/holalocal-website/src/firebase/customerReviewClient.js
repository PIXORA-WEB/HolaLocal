import { customerReviewCallable } from './functionsClient.js'
export async function callCustomerReview(name,payload) { return (await customerReviewCallable(name)(payload)).data }
