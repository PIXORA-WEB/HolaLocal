// Synthetic transaction model only: no Firebase SDK, sockets, clock or persistence.
import assert from 'node:assert/strict'
export class CustomerReviewFakeDatabase {
  constructor() { this.data = new Map(); this.retryNext = false; this.callbacks = 0; this.commits = 0; this.readPaths = [] }
  timestampFromMillis(millis) { return { seconds: Math.floor(millis / 1000), nanoseconds: (millis % 1000) * 1000000 } }
  async get(path) { return structuredClone(this.data.get(path) ?? null) }
  async runTransaction(callback) {
    const attempt = async () => {
      this.callbacks++
      const snapshot = structuredClone(this.data)
      const writes = []
      const read = path => { this.readPaths.push(path); assert.equal(writes.length, 0, 'read after write'); return structuredClone(snapshot.get(path) ?? null) }
      const tx = {
        get: async path => read(path),
        hasPublishedReview: async businessId => {
          read('read-order-sentinel')
          return [...snapshot].some(([path, value]) => path.startsWith('customerReviewsPublic/') && value.businessId === businessId)
        },
        set: (path, value) => writes.push(['set', path, structuredClone(value)]),
        create: (path, value) => writes.push(['create', path, structuredClone(value)]),
        delete: path => writes.push(['delete', path]),
      }
      return { outcome: await callback(tx), writes }
    }
    if (this.retryNext) {
      this.retryNext = false
      await attempt() // discarded callback, no writes commit
      if (this.beforeRetry) { const hook = this.beforeRetry; this.beforeRetry = null; await hook() }
    }
    const { outcome, writes } = await attempt()
    const next = structuredClone(this.data)
    for (const [operation, path, value] of writes) {
      if (operation === 'create') assert.equal(next.has(path), false, 'immutable create collision')
      if (operation === 'delete') next.delete(path)
      else next.set(path, value)
    }
    this.data = next
    this.commits++
    return outcome
  }
}
