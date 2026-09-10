import { Timestamp } from 'firebase-admin/firestore'
// A single consistent snapshot per request, with no write operations exposed.
export function createCustomerReviewReadFirestore(firestore) {
  return {
    readSnapshot: callback => firestore.runTransaction(native => callback({
      get: async path => {
        const snapshot = await native.get(firestore.doc(path))
        return snapshot.exists ? snapshot.data() : null
      },
      query: async ({ collection, filters, order, after, limit }) => {
        let query = firestore.collection(collection)
        for (const [field, value] of filters) query = query.where(field, '==', value)
        for (const [field, direction] of order) query = query.orderBy(field, direction)
        if (after) query = query.startAfter(new Timestamp(after[0].seconds, after[0].nanoseconds), after[1])
        const snapshot = await native.get(query.limit(limit))
        return snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }))
      },
    }), { readOnly: true }),
  }
}
