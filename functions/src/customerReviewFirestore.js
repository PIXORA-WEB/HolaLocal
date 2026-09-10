import { Timestamp } from 'firebase-admin/firestore'
// No SDK initialization or package-source fallback. Caller supplies Admin Firestore/Auth instances.
export function createCustomerReviewFirestoreDatabase(firestore) {
  const data = snapshot => snapshot.exists ? snapshot.data() : null
  return {
    timestampFromMillis: millis => Timestamp.fromMillis(millis),
    get: async path => data(await firestore.doc(path).get()),
    runTransaction: callback => firestore.runTransaction(async native => {
      let writing = false
      const assertReading = () => { if (writing) throw new Error('customer-review-read-after-write') }
      return callback({
        get: async path => { assertReading(); return data(await native.get(firestore.doc(path))) },
        hasPublishedReview: async businessId => {
          assertReading()
          return !(await native.get(firestore.collection('customerReviewsPublic').where('businessId', '==', businessId).limit(1))).empty
        },
        set: (path, value) => { writing = true; native.set(firestore.doc(path), value) },
        create: (path, value) => { writing = true; native.create(firestore.doc(path), value) },
        delete: path => { writing = true; native.delete(firestore.doc(path)) },
      })
    }),
  }
}

export async function readCustomerReviewFirestoreEligibility(tx, { authorUid, businessId }) {
  const account = await tx.get(`users/${authorUid}`)
  const business = await tx.get(`businesses/${businessId}`)
  return { account: account && { ...account, uid: authorUid }, business: business && { ...business, businessId } }
}

// Takes a raw ID token supplied by the future authenticated boundary, never a decoded client object.
export function createCustomerReviewAuthAdapter(auth) {
  const identity = user => {
    if (user.disabled) throw new Error('authentication-required')
    return { uid: user.uid, emailVerified: user.emailVerified === true, admin: user.customClaims?.admin === true }
  }
  return {
    resolveActor: async token => {
      if (typeof token !== 'string' || !token) throw new Error('authentication-required')
      const decoded = await auth.verifyIdToken(token, true)
      return identity(await auth.getUser(decoded.uid))
    },
    loadAuthorIdentity: async uid => identity(await auth.getUser(uid)),
  }
}
