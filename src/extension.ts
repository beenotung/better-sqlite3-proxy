export let unProxySymbol = Symbol.for('unProxy')

export function unProxy<T extends object>(row: T): T {
  if (unProxySymbol in row) {
    return (row as any)[unProxySymbol]
  }
  return row
}

export let findSymbol = Symbol.for('find')

export function find<T extends object>(
  table: T[],
  filter: Partial<T>,
): T | undefined {
  if (findSymbol in table) {
    return (table as any)[findSymbol](filter)
  }
  throw new Error(
    'expect table proxy, but got: ' + Object.prototype.toString.call(table),
  )
}

export let filterSymbol = Symbol.for('filter')

export function filter<T extends object>(table: T[], filter: Partial<T>): T[] {
  if (filterSymbol in table) {
    return (table as any)[filterSymbol](filter)
  }
  throw new Error(
    'expect table proxy, but got: ' + Object.prototype.toString.call(table),
  )
}

export let delSymbol = Symbol.for('del')

/**
 * @returns number of deleted rows
 */
export function del<T extends object>(table: T[], partial: Partial<T>): number {
  if (delSymbol in table) {
    return (table as any)[delSymbol](partial)
  }
  throw new Error(
    'expect table proxy, but got: ' + Object.prototype.toString.call(table),
  )
}

export let truncateSymbol = Symbol.for('truncate')

export function truncate<T extends object>(table: T[]): void {
  if (truncateSymbol in table) {
    return (table as any)[truncateSymbol]()
  }
  throw new Error(
    'expect table proxy, but got: ' + Object.prototype.toString.call(table),
  )
}

export let countSymbol = Symbol.for('count')

export function count<T extends object>(
  table: T[],
  partial: Partial<T>,
): number {
  if (countSymbol in table) {
    return (table as any)[countSymbol](partial)
  }
  throw new Error(
    'expect table proxy, but got: ' + Object.prototype.toString.call(table),
  )
}

export let updateSymbol = Symbol.for('update')

/**
 * @returns number of updated rows
 */
export function update<T extends object>(
  table: T[],
  id_or_filter: number | Partial<T>,
  partial: Partial<T>,
): number {
  if (updateSymbol in table) {
    return (table as any)[updateSymbol](id_or_filter, partial)
  }
  throw new Error(
    'expect table proxy, but got: ' + Object.prototype.toString.call(table),
  )
}

export let notNull = Symbol.for('not null') as any as null

export let clearCacheSymbol = Symbol.for('clearCache')

export function clearCache(proxy: object) {
  if (clearCacheSymbol in proxy) {
    return (proxy as any)[clearCacheSymbol]()
  }
  throw new Error(
    'expect table_dict or table proxy, but got: ' +
      Object.prototype.toString.call(proxy),
  )
}
