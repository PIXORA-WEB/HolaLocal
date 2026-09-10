export class FakeSnapshot {
  constructor(id, data, ref = null) {
    this.id = id
    this.ref = ref
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

  delete() {
    this.database.store.delete(this.path)
    this.database.writePaths.push(this.path)
    return Promise.resolve()
  }
}

class FakeCollectionRef {
  constructor(database, path) {
    this.database = database
    this.path = path
    this.filters = []
    this.orders = []
    this.limitCount = Infinity
    this.cursor = null
  }

  doc(id) {
    return new FakeDocRef(this.database, `${this.path}/${id}`)
  }

  where(field, operator, value) {
    const next = new FakeCollectionRef(this.database, this.path)
    next.filters = [...this.filters, { field, operator, value }]
    next.orders = this.orders
    next.limitCount = this.limitCount
    next.cursor = this.cursor
    return next
  }

  orderBy(field, direction = 'asc') {
    const next = new FakeCollectionRef(this.database, this.path)
    next.filters = this.filters
    next.orders = [...this.orders, { field, direction }]
    next.limitCount = this.limitCount
    next.cursor = this.cursor
    return next
  }

  limit(count) {
    const next = new FakeCollectionRef(this.database, this.path)
    next.filters = this.filters
    next.orders = this.orders
    next.limitCount = count
    next.cursor = this.cursor
    return next
  }

  startAfter(...values) {
    const next = new FakeCollectionRef(this.database, this.path)
    next.filters = this.filters
    next.orders = this.orders
    next.limitCount = this.limitCount
    next.cursor = values
    return next
  }

  async get() {
    let documents = [...this.database.store.entries()]
      .filter(([path]) => path.startsWith(`${this.path}/`) && !path.slice(this.path.length + 1).includes('/'))
      .map(([path, data]) => new FakeSnapshot(
        path.split('/').pop(), data, new FakeDocRef(this.database, path),
      ))
    for (const filter of this.filters) {
      documents = documents.filter((snapshot) => {
        const value = String(filter.field) === '__name__' ? snapshot.id : String(filter.field).split('.').reduce((value,key) => value?.[key], snapshot.data())
        if (filter.operator === '==') return value === filter.value
        if (filter.operator === '!=') return value !== filter.value
        if (filter.operator === '>=') return value >= filter.value
        if (filter.operator === '<=') return value <= filter.value
        if (filter.operator === 'array-contains') return Array.isArray(value) && value.includes(filter.value)
        throw new Error(`Unsupported fake query operator: ${filter.operator}`)
      })
    }
    const fieldValue = (snapshot, field) => String(field) === '__name__'
      ? snapshot.id
      : snapshot.data()?.[field]
    const comparable = (value) => typeof value?.toMillis === 'function' ? value.toMillis() : value
    if (this.orders.length > 0) {
      documents.sort((first, second) => {
        for (const order of this.orders) {
          const left = comparable(fieldValue(first, order.field))
          const right = comparable(fieldValue(second, order.field))
          if (left === right) continue
          return (left < right ? -1 : 1) * (order.direction === 'desc' ? -1 : 1)
        }
        return 0
      })
    }
    if (this.cursor) {
      const cursorIndex = documents.findIndex((snapshot) => this.orders.every((order, index) => (
        comparable(fieldValue(snapshot, order.field)) === comparable(this.cursor[index])
      )))
      documents = cursorIndex >= 0 ? documents.slice(cursorIndex + 1) : []
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
    this.operations = []
  }

  async get(reference) {
    if (reference instanceof FakeCollectionRef) return reference.get()
    this.database.readPaths.push(reference.path)
    return this.database.snapshot(reference.path)
  }

  set(reference, data, options = {}) {
    this.operations.push({ type: 'set', reference, data, options })
  }

  update(reference, update) {
    this.operations.push({ type: 'update', reference, data: update })
  }

  delete(reference) {
    this.operations.push({ type: 'delete', reference })
  }

  commit() {
    for (const operation of this.operations) {
      const { path } = operation.reference
      const current = this.database.store.get(path)
      if (operation.type === 'delete') {
        this.database.store.delete(path)
        this.database.writePaths.push(path)
        continue
      }
      if (operation.type === 'update' && !current) throw new Error(`Missing document: ${path}`)
      const next = operation.type === 'update' || (operation.options?.merge && current)
        ? { ...current, ...operation.data }
        : operation.data
      this.database.store.set(path, next)
      this.database.writePaths.push(path)
    }
  }
}

export class FakeFirestore {
  constructor(seed = {}) {
    this.store = new Map(Object.entries(seed).map(([path, data]) => [path, structuredClone(data)]))
    this.readPaths = []
    this.writePaths = []
    this.transactionTail = Promise.resolve()
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
    return new FakeSnapshot(path.split('/').pop(), this.store.get(path), new FakeDocRef(this, path))
  }

  async runTransaction(callback) {
    const previous = this.transactionTail
    let release
    this.transactionTail = new Promise((resolve) => { release = resolve })
    await previous
    try {
      const transaction = new FakeTransaction(this)
      const result = await callback(transaction)
      transaction.commit()
      return result
    } finally {
      release()
    }
  }

  data(path) {
    return this.store.get(path)
  }
}
