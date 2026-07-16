export class FakeSnapshot {
  constructor(id, data) {
    this.id = id
    this.exists = data !== undefined
    this._data = data
  }

  data() {
    return this._data
  }
}

class FakeDocRef {
  constructor(database, path) {
    this.database = database
    this.path = path
    this.id = path.split('/').pop()
  }

  collection(name) {
    return new FakeCollectionRef(this.database, `${this.path}/${name}`)
  }

  get() {
    return Promise.resolve(this.database.snapshot(this.path))
  }
}

class FakeCollectionRef {
  constructor(database, path) {
    this.database = database
    this.path = path
    this.filters = []
    this.limitCount = Infinity
  }

  doc(id) {
    return new FakeDocRef(this.database, `${this.path}/${id}`)
  }

  where(field, operator, value) {
    const next = new FakeCollectionRef(this.database, this.path)
    next.filters = [...this.filters, { field, operator, value }]
    next.limitCount = this.limitCount
    return next
  }

  limit(count) {
    const next = new FakeCollectionRef(this.database, this.path)
    next.filters = this.filters
    next.limitCount = count
    return next
  }

  async get() {
    let documents = [...this.database.store.entries()]
      .filter(([path]) => path.startsWith(`${this.path}/`) && !path.slice(this.path.length + 1).includes('/'))
      .map(([path, data]) => new FakeSnapshot(path.split('/').pop(), data))
    for (const filter of this.filters) {
      documents = documents.filter((snapshot) => {
        const value = snapshot.data()?.[filter.field]
        if (filter.operator === '==') return value === filter.value
        if (filter.operator === 'array-contains') return Array.isArray(value) && value.includes(filter.value)
        throw new Error(`Unsupported fake query operator: ${filter.operator}`)
      })
    }
    documents = documents.slice(0, this.limitCount)
    return {
      docs: documents,
      empty: documents.length === 0,
      size: documents.length,
    }
  }
}

class FakeTransaction {
  constructor(database) {
    this.database = database
  }

  async get(reference) {
    return this.database.snapshot(reference.path)
  }

  set(reference, data) {
    this.database.store.set(reference.path, data)
  }

  update(reference, update) {
    const current = this.database.store.get(reference.path)
    if (!current) throw new Error(`Missing document: ${reference.path}`)
    this.database.store.set(reference.path, { ...current, ...update })
  }
}

export class FakeFirestore {
  constructor(seed = {}) {
    this.store = new Map(Object.entries(seed).map(([path, data]) => [path, structuredClone(data)]))
  }

  doc(path) {
    return new FakeDocRef(this, path)
  }

  collection(path) {
    return new FakeCollectionRef(this, path)
  }

  snapshot(path) {
    return new FakeSnapshot(path.split('/').pop(), this.store.get(path))
  }

  async runTransaction(callback) {
    return callback(new FakeTransaction(this))
  }

  data(path) {
    return this.store.get(path)
  }
}
