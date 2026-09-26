import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { LEGAL_PUBLICATION_PATH, legalNoticeContract } from '../firebase-contract/legalNotice.js'

export function createLegalNoticeClient(db) {
  return {
    subscribe(uid, receive) {
      let profile = null, publication = null, stopped = false, subscriptions = [], retry
      const emit = () => { if (!stopped) receive({ profile, publication }) }
      function start() {
        if (stopped) return
        subscriptions.forEach(stop => stop())
        const fail = () => {
          profile = null; publication = null; emit()
          clearTimeout(retry)
          retry = setTimeout(start, 30000)
        }
        subscriptions = [
          onSnapshot(doc(db, 'users', uid), s => { profile = s.exists() ? s.data() : null; emit() }, fail),
          onSnapshot(doc(db, LEGAL_PUBLICATION_PATH), s => { publication = s.exists() ? s.data() : null; emit() }, fail),
        ]
      }
      start()
      return () => { stopped = true; clearTimeout(retry); subscriptions.forEach(stop => stop()) }
    },
    async acknowledge(uid, displayed) {
      if (!uid) throw new Error('auth-required')
      return runTransaction(db, async transaction => {
        const reference = doc(db, 'users', uid)
        const [user, registry] = await Promise.all([
          transaction.get(reference), transaction.get(doc(db, LEGAL_PUBLICATION_PATH)),
        ])
        if (!user.exists() || user.data().accountStatus !== 'active') throw new Error('notice-unavailable')
        const update = legalNoticeContract.acknowledgement(user.data(), registry.exists() ? registry.data() : null, displayed)
        if (Object.keys(update).length) transaction.update(reference, { ...update, updatedAt: serverTimestamp() })
        return update
      })
    },
  }
}
