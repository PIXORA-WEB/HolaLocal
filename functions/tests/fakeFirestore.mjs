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
    this.database.readPaths.push(this.path)
    return Promise.resolve(this.database.snapshot(this.path))
  }

  update(update) {
    const current = this.database.store.get(this.path)
    if (!current) throw new Error(`Missing document: ${this.path}`)
    this.database.store.set(this.path, { ...current, ...update })
    return Promise.resolve()
  }
}

class FakeCollectionRef {
  constructor(database, path) {
    this.database = database
    this.path = path
    this.filters = []
    this.order = null
    this.limitCount = Infinity
  }

  doc(id) {
    return new FakeDocRef(this.database, `${this.path}/${id}`)
  }

  where(field, operator, value) {
    const next = new FakeCollectionRef(this.database, this.path)
    next.filters = [...this.filters, { field, operator, value }]
    next.order = this.order
    next.limitCount = this.limitCount
    return next
  }

  orderBy(field, direction = 'asc') {
    const next = new FakeCollectionRef(this.database, this.path)
    next.filters = this.filters
    next.order = { field, direction }
    next.limitCount = this.limitCount
    return next
  }

  limit(count) {
    const next = new FakeCollectionRef(this.database, this.path)
    next.filters = this.filters
    next.order = this.order
    next.limitCount = count
    return next
  }

  async get() {
    let documents = [...this.database.store.entries()]
      .filter(([path]) => path.startsWith(`${this.path}/`) && !path.slice(this.path.length + 1).includes('/'))
      .map(([path, data]) => new FakeSnapshot(path.split('/').pop(), data))
    for (const filter of this.filters) {
      documents = documents.filter((snapshot) => {
        const value = String(filter.field) === '__name__' ? snapshot.id : snapshot.data()?.[filter.field]
        if (filter.operator === '==') return value === filter.value
        if (filter.operator === '!=') return value !== filter.value
        if (filter.operator === '>=') return value >= filter.value
        if (filter.operator === '<=') return value <= filter.value
        if (filter.operator === 'array-contains') return Array.isArray(value) && value.includes(filter.value)
        throw new Error(`Unsupported fake query operator: ${filter.operator}`)
      })
    }
    if (this.order) {
      const direction = this.order.direction === 'desc' ? -1 : 1
      documents.sort((first, second) => {
        const left = first.data()?.[this.order.field]
        const right = second.data()?.[this.order.field]
        const leftTime = typeof left?.toMillis === 'function' ? left.toMillis() : Number(new Date(left))
        const rightTime = typeof right?.toMillis === 'function' ? right.toMillis() : Number(new Date(right))
        return (leftTime - rightTime) * direction
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

  set(reference, data, options = {}) {
    const current = this.database.store.get(reference.path)
    this.database.store.set(reference.path, options.merge && current ? { ...current, ...data } : data)
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
    this.readPaths = []
  }

  doc(path) {
    return new FakeDocRef(this, path)
  }

  collection(path) {
    return new FakeCollectionRef(this, path)
  }

  async getAll(...references) {
    this.getAllCalls = (this.getAllCalls ?? 0) + 1
    return Promise.all(references.map((reference) => reference.get()))
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
